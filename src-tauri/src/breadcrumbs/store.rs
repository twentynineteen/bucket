//! Locking and writing the file. Nothing here knows what the file means.

use std::collections::HashMap;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use super::TEMP_PREFIX;

/// One lock per project folder, held for a whole read-change-write so two
/// changes to the same file cannot lose each other's edits.
pub fn lock_for(project: &Path) -> Arc<Mutex<()>> {
    static LOCKS: OnceLock<Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>> = OnceLock::new();
    let key = lock_key(project);
    let mut locks = LOCKS
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    Arc::clone(locks.entry(key).or_default())
}

/// The same folder reached by different spellings must share a lock. APFS and
/// SMB volumes are case-insensitive by default, so the key is canonical and
/// lower-cased. A folder that does not exist cannot be canonicalised; it can
/// also not be written, so its plain spelling is a good enough key.
fn lock_key(project: &Path) -> PathBuf {
    let path = fs::canonicalize(project).unwrap_or_else(|_| project.to_path_buf());
    PathBuf::from(path.to_string_lossy().to_lowercase())
}

/// Replaces `target` with `contents` so a reader sees either the old file or
/// the new one, never half of each: write a sibling temp file, flush it, then
/// rename it over the target.
pub fn write_atomically(target: &Path, contents: &[u8]) -> io::Result<()> {
    write_atomically_with(target, contents, fs::File::sync_all)
}

/// [`write_atomically`] with the full flush passed in, so a test can stand in
/// for a volume that refuses it or fails it.
pub(super) fn write_atomically_with(
    target: &Path,
    contents: &[u8],
    full_sync: impl FnOnce(&fs::File) -> io::Result<()>,
) -> io::Result<()> {
    let dir = target.parent().unwrap_or(Path::new("."));
    let temp = dir.join(format!("{TEMP_PREFIX}{}", uuid::Uuid::new_v4()));

    let result = (|| {
        let mut file = fs::File::create(&temp)?;
        file.write_all(contents)?;
        flush(&file, full_sync)?;
        fs::rename(&temp, target)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

/// Puts the file's bytes on disk before it is renamed into place.
///
/// On macOS `sync_all` asks the drive itself to flush (`F_FULLFSYNC`), and
/// network shares refuse that with ENOTSUP. A plain `fsync` hands the bytes
/// to the server, which is the most such a volume offers, so it is used
/// there instead. A volume that refuses both is still written to: the bytes
/// are in the file, and failing would make every project on it read-only.
fn flush(file: &fs::File, full_sync: impl FnOnce(&fs::File) -> io::Result<()>) -> io::Result<()> {
    match full_sync(file) {
        Err(e) if flush_unsupported(&e) => match plain_fsync(file) {
            Err(e) if flush_unsupported(&e) => {
                log::warn!(
                    "breadcrumbs: this volume cannot flush on request ({e}); writing anyway"
                );
                Ok(())
            }
            result => result,
        },
        result => result,
    }
}

/// ENOTSUP is 45 on macOS and 95 on Linux; EOPNOTSUPP is 102 on macOS. Rust
/// does not map macOS's 45 to `Unsupported`, so the raw codes are checked
/// too. They are errno values, so they are only compared on Unix: the same
/// numbers mean unrelated things as Windows error codes.
fn flush_unsupported(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::Unsupported
        || (cfg!(unix) && matches!(error.raw_os_error(), Some(45 | 95 | 102)))
}

#[cfg(target_os = "macos")]
fn plain_fsync(file: &fs::File) -> io::Result<()> {
    use std::os::fd::AsRawFd;
    // SAFETY: the descriptor belongs to `file`, which stays open for the call.
    if unsafe { libc::fsync(file.as_raw_fd()) } == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

/// Only macOS has a stronger flush than `fsync`, so elsewhere `sync_all` was
/// already the plain one and there is nothing weaker to try.
#[cfg(not(target_os = "macos"))]
fn plain_fsync(_file: &fs::File) -> io::Result<()> {
    Err(io::Error::from(io::ErrorKind::Unsupported))
}
