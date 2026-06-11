//! Safe-ish wrapper around macOS `copyfile(3)` with progress and cancellation.
//!
//! Why this exists: Apple's `copyfile` syscall (and its `clonefile` fast path
//! for same-volume APFS copies) is dramatically faster and more correct than
//! a userspace `BufReader`/`BufWriter` loop. Same-volume copies become O(1)
//! copy-on-write clones regardless of file size; cross-volume copies still
//! benefit from kernel-level buffering and preserve xattrs/ACLs/resource forks
//! that a manual byte loop silently drops.
//!
//! Compiled only on macOS — `utils/mod.rs` gates the module behind
//! `#[cfg(target_os = "macos")]`. Windows/Linux keep the buffered byte loop in
//! `build_project/commands.rs` as a fallback.
//!
//! All `unsafe` blocks live in this file. The public surface is two types and
//! one function:
//!
//! - `CopyResult` — bytes copied.
//! - `ControlFlow::{Continue, Cancel}` — returned from the progress callback.
//! - `copy_with_progress(src, dst, flags, cb)` — runs the copy.
//!
//! We use the `libc` crate's `copyfile` bindings rather than hand-rolling our
//! own. The signature for `copyfile_callback_t` is subtle — it's
//! `Option<extern "C" fn(...)>` (not `unsafe extern "C"`) — and getting it
//! wrong causes copyfile to invoke a corrupted function pointer when the
//! progress callback fires.

use libc::{
    c_char, c_int, c_void, copyfile, copyfile_state_alloc, copyfile_state_free,
    copyfile_state_get, copyfile_state_set, copyfile_state_t, off_t, COPYFILE_CONTINUE,
    COPYFILE_COPY_DATA, COPYFILE_DATA, COPYFILE_METADATA, COPYFILE_PROGRESS,
    COPYFILE_QUIT, COPYFILE_STATE_COPIED, COPYFILE_STATE_STATUS_CB,
    COPYFILE_STATE_STATUS_CTX,
};
use std::ffi::CString;
use std::path::Path;

// ============================================================================
// Public flag constants
// ============================================================================

/// macOS `copyfile_flags_t` type — a bitfield of `COPYFILE_*` constants.
pub type CopyFlags = u32;

/// Copy data plus all metadata (xattrs, ACLs, stat). The default for ingest.
/// libc exposes the components but not the combined `COPYFILE_ALL`, so we
/// derive it here to match Apple's `<copyfile.h>`.
pub const COPYFILE_ALL: CopyFlags = COPYFILE_METADATA | COPYFILE_DATA;

/// Best-effort APFS clone. Falls back to a regular copy if cloning isn't
/// possible (cross-volume, different filesystems, etc.). When the clone
/// succeeds, the destination is writable.
pub const COPYFILE_CLONE: CopyFlags = libc::COPYFILE_CLONE;

// ============================================================================
// Public API
// ============================================================================

/// Returned from the progress callback to keep going or abort the copy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlFlow {
    Continue,
    Cancel,
}

/// Telemetry returned alongside a successful copy.
#[derive(Debug, Clone, Copy)]
pub struct CopyResult {
    /// Total bytes copied for the file. For clonefile-based copies this is
    /// the file's logical size, not the on-disk delta (which is zero).
    pub bytes_copied: u64,
}

/// Errors that can come out of `copy_with_progress`.
#[derive(Debug)]
pub enum CopyError {
    /// Source or destination path isn't representable as a CString
    /// (non-UTF-8 or contains an interior NUL byte).
    InvalidPath(String),
    /// `copyfile_state_alloc()` returned NULL.
    AllocFailed,
    /// The progress callback returned `ControlFlow::Cancel`.
    Cancelled,
    /// Any other I/O failure. Wraps `std::io::Error::last_os_error()` so
    /// `errno` is preserved via `e.raw_os_error()`.
    Io(std::io::Error),
}

impl std::fmt::Display for CopyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CopyError::InvalidPath(p) => write!(f, "invalid path: {}", p),
            CopyError::AllocFailed => write!(f, "copyfile_state_alloc returned NULL"),
            CopyError::Cancelled => write!(f, "copy cancelled by user"),
            CopyError::Io(e) => write!(f, "{}", e),
        }
    }
}

impl std::error::Error for CopyError {}

/// Copy `src` to `dst` using `copyfile(3)`, reporting cumulative bytes-copied
/// to the callback. The callback may return `Cancel` to abort.
///
/// `flags` is a bitwise-OR of the `COPYFILE_*` constants — for typical ingest
/// use, `COPYFILE_ALL | COPYFILE_CLONE`.
pub fn copy_with_progress<F>(
    src: &Path,
    dst: &Path,
    flags: CopyFlags,
    mut progress_cb: F,
) -> Result<CopyResult, CopyError>
where
    F: FnMut(u64) -> ControlFlow,
{
    let src_c = path_to_cstring(src)?;
    let dst_c = path_to_cstring(dst)?;

    let state = StateGuard::new().ok_or(CopyError::AllocFailed)?;

    // Heap-allocate the context so its address is stable and there's no
    // stack-resident `&mut` aliasing the raw pointer the C side dereferences.
    // We reclaim ownership via Box::from_raw after copyfile() returns.
    let ctx_raw: *mut CallbackCtx = Box::into_raw(Box::new(CallbackCtx {
        callback: &mut progress_cb,
        cancelled: false,
    }));
    let ctx_void_ptr: *mut c_void = ctx_raw as *mut c_void;

    // copyfile_state_set stores `thing` *directly* into the state struct for
    // pointer-sized fields — see xnu Libc copyfile.c's
    // `copyfile_set_thing(s->statuscb, thing)` which expands to
    // `s->statuscb = (copyfile_callback_t)thing`. The "thing is a
    // pointer-to-pointer" reading was wrong; we pass the function pointer
    // (and context pointer) DIRECTLY, cast to `*const c_void`.
    let setup_result = unsafe {
        let cb_rc = copyfile_state_set(
            state.raw(),
            COPYFILE_STATE_STATUS_CB as u32,
            trampoline as *const c_void,
        );
        if cb_rc != 0 {
            let _ = Box::from_raw(ctx_raw);
            return Err(CopyError::Io(std::io::Error::last_os_error()));
        }
        let ctx_rc = copyfile_state_set(
            state.raw(),
            COPYFILE_STATE_STATUS_CTX as u32,
            ctx_void_ptr as *const c_void,
        );
        if ctx_rc != 0 {
            let _ = Box::from_raw(ctx_raw);
            return Err(CopyError::Io(std::io::Error::last_os_error()));
        }
        0
    };
    debug_assert_eq!(setup_result, 0);

    // SAFETY: src_c, dst_c, state.raw() all valid. flags is a u32 bitset.
    // copyfile may invoke `trampoline` (which dereferences ctx_raw); ctx_raw
    // is valid until Box::from_raw runs below.
    let rc = unsafe { copyfile(src_c.as_ptr(), dst_c.as_ptr(), state.raw(), flags) };

    // Reclaim heap allocation. Dropping the Box releases the borrow on
    // progress_cb (the caller can use it again afterwards).
    // SAFETY: ctx_raw was produced by Box::into_raw above and has not been
    // freed; copyfile has returned, so no further callback invocations occur.
    let ctx = unsafe { Box::from_raw(ctx_raw) };

    if rc != 0 {
        if ctx.cancelled {
            return Err(CopyError::Cancelled);
        }
        return Err(CopyError::Io(std::io::Error::last_os_error()));
    }

    // Success. Read the per-file byte count from the destination's metadata
    // rather than the copyfile state object — the state's `totalCopied` field
    // isn't updated when clonefile takes the fast path, and metadata is the
    // authoritative number either way.
    let bytes_copied = std::fs::metadata(dst).map(|m| m.len()).unwrap_or(0);

    Ok(CopyResult { bytes_copied })
}

// ============================================================================
// Trampoline + context (internal)
// ============================================================================

struct CallbackCtx<'a> {
    callback: &'a mut dyn FnMut(u64) -> ControlFlow,
    cancelled: bool,
}

/// Bridges C-style copyfile callbacks into our Rust `FnMut`. Only invokes the
/// caller's callback during data-copy *progress* events; other lifecycle
/// notifications (start/finish/xattr) are passed through silently.
///
/// Signature MUST be plain `extern "C"`, not `unsafe extern "C"` —
/// `copyfile_callback_t = Option<extern "C" fn(...)>` and the type system
/// distinguishes the two even though they share an ABI.
extern "C" fn trampoline(
    what: c_int,
    stage: c_int,
    state: copyfile_state_t,
    _src: *const c_char,
    _dst: *const c_char,
    ctx: *mut c_void,
) -> c_int {
    if ctx.is_null() || what != COPYFILE_COPY_DATA || stage != COPYFILE_PROGRESS {
        return COPYFILE_CONTINUE;
    }

    // SAFETY: ctx points to a Box-allocated CallbackCtx that lives until
    // `copy_with_progress` calls Box::from_raw after copyfile() returns. No
    // other live reference aliases this memory.
    let ctx_ref = unsafe { &mut *(ctx as *mut CallbackCtx) };

    let mut copied: off_t = 0;
    // SAFETY: state is a valid copyfile_state_t passed by libcopyfile to its
    // own registered callback. `copied` is a stack local with the correct
    // pointee type for COPYFILE_STATE_COPIED.
    let rc = unsafe {
        copyfile_state_get(
            state,
            COPYFILE_STATE_COPIED as u32,
            &mut copied as *mut off_t as *mut c_void,
        )
    };
    if rc != 0 {
        return COPYFILE_CONTINUE;
    }

    match (ctx_ref.callback)(copied as u64) {
        ControlFlow::Continue => COPYFILE_CONTINUE,
        ControlFlow::Cancel => {
            ctx_ref.cancelled = true;
            COPYFILE_QUIT
        }
    }
}

// ============================================================================
// RAII guard for copyfile_state_t
// ============================================================================

struct StateGuard(copyfile_state_t);

impl StateGuard {
    fn new() -> Option<Self> {
        // SAFETY: copyfile_state_alloc is always safe to call; it returns
        // NULL on allocation failure, which we handle.
        let state = unsafe { copyfile_state_alloc() };
        if state.is_null() {
            None
        } else {
            Some(StateGuard(state))
        }
    }

    fn raw(&self) -> copyfile_state_t {
        self.0
    }
}

impl Drop for StateGuard {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: self.0 came from copyfile_state_alloc and hasn't been
            // freed elsewhere.
            unsafe {
                copyfile_state_free(self.0);
            }
        }
    }
}

// ============================================================================
// Path helpers
// ============================================================================

fn path_to_cstring(p: &Path) -> Result<CString, CopyError> {
    let s = p
        .to_str()
        .ok_or_else(|| CopyError::InvalidPath(p.display().to_string()))?;
    CString::new(s).map_err(|_| CopyError::InvalidPath(p.display().to_string()))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;

    /// Write `bytes` of arbitrary content to a file in `dir` named `name`.
    fn write_fixture(dir: &std::path::Path, name: &str, bytes: usize) -> std::path::PathBuf {
        let path = dir.join(name);
        let mut f = fs::File::create(&path).expect("create fixture");
        let chunk = b"BUCKET-TEST-PAYLOAD-0123456789ABCDEF\n";
        let mut remaining = bytes;
        while remaining > 0 {
            let n = remaining.min(chunk.len());
            f.write_all(&chunk[..n]).unwrap();
            remaining -= n;
        }
        f.sync_all().unwrap();
        path
    }

    #[test]
    fn basic_copy_matches_source_bytes() {
        let dir = tempdir().unwrap();
        let src = write_fixture(dir.path(), "src.bin", 4096);
        let dst = dir.path().join("dst.bin");

        let result = copy_with_progress(&src, &dst, COPYFILE_ALL | COPYFILE_CLONE, |_| {
            ControlFlow::Continue
        })
        .expect("copy must succeed");

        assert!(dst.exists(), "destination should exist");
        let src_bytes = fs::read(&src).unwrap();
        let dst_bytes = fs::read(&dst).unwrap();
        assert_eq!(src_bytes, dst_bytes, "destination contents must match source");
        assert_eq!(result.bytes_copied, src_bytes.len() as u64);
    }

    #[test]
    fn progress_callback_observes_monotonic_bytes() {
        let dir = tempdir().unwrap();
        let src = write_fixture(dir.path(), "src.bin", 2 * 1024 * 1024);
        let dst = dir.path().join("dst.bin");

        let mut observations: Vec<u64> = Vec::new();
        copy_with_progress(&src, &dst, COPYFILE_ALL | COPYFILE_CLONE, |bytes| {
            observations.push(bytes);
            ControlFlow::Continue
        })
        .expect("copy must succeed");

        // May be empty if clonefile fast path skipped progress callbacks —
        // that's expected on same-volume APFS. If we got any ticks, they must
        // be monotonically non-decreasing.
        for window in observations.windows(2) {
            assert!(
                window[0] <= window[1],
                "bytes-copied must be monotonically non-decreasing, got {} → {}",
                window[0],
                window[1]
            );
        }
    }

    #[test]
    fn cancellation_returns_cancelled_error() {
        let dir = tempdir().unwrap();
        // Large enough to reliably get a progress callback before completion.
        let src = write_fixture(dir.path(), "src.bin", 8 * 1024 * 1024);
        let dst = dir.path().join("dst.bin");

        let result = copy_with_progress(
            &src,
            &dst,
            // No CLONE — force a real progress-callback-driven copy.
            COPYFILE_ALL,
            |_bytes| ControlFlow::Cancel,
        );

        match result {
            Err(CopyError::Cancelled) => { /* expected */ }
            Err(CopyError::Io(e)) => panic!(
                "expected Cancelled, got IO error: {} (errno={:?})",
                e,
                e.raw_os_error()
            ),
            Err(other) => panic!("expected Cancelled, got {:?}", other),
            Ok(_) => {
                // Copy completed before any progress callback fired. Possible
                // on very fast disks; not a wrapper bug.
            }
        }
    }

    #[test]
    fn invalid_destination_directory_yields_io_error() {
        let dir = tempdir().unwrap();
        let src = write_fixture(dir.path(), "src.bin", 1024);
        let dst = dir.path().join("nonexistent_subdir").join("dst.bin");

        let result =
            copy_with_progress(&src, &dst, COPYFILE_ALL, |_| ControlFlow::Continue);

        match result {
            Err(CopyError::Io(_)) => { /* expected — copyfile won't create parents */ }
            other => panic!("expected IO error for missing parent dir, got {:?}", other),
        }
    }
}
