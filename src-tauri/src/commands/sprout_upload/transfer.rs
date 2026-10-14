//! The upload task: file streaming, progress tracking, size gate and terminal
//! event arbitration.

use bytes::Bytes;
use futures_util::stream::unfold;
use futures_util::TryStreamExt;
use reqwest::multipart;
use reqwest::{Body, Client};
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri::Emitter;
use tokio::io::{AsyncRead, AsyncReadExt, BufReader};

use super::response::classify_response;
use super::supervisor::{STALL_WARNING_AFTER, STALL_WINDOW};
use super::target::{endpoint, text_fields, UploadTarget};

// ---- IPC event types ----

/// One `upload_progress` sample.
///
/// A percentage alone cannot tell 3% of 200 MB from 3% of 12 GB, which is exactly
/// the judgement a user makes when deciding whether a slow upload is worth
/// waiting for. The stall path has always known the byte offset; the progress path
/// now reports it too. `percentage` is a float rather than the old truncated
/// `u32`, so 1% of a 3 GB file is no longer 30 MB of invisible movement.
/// See issue #225.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UploadProgressEvent {
    pub operation_id: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
    pub percentage: f64,
}

/// A successful upload, with the Sprout video record.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UploadCompleteEvent {
    pub operation_id: String,
    pub video: Value,
}

/// A failed upload. `message` is already user-facing prose, classified by
/// `classify_response`, the size gate or the stall watchdog.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UploadErrorEvent {
    pub operation_id: String,
    pub message: String,
}

/// A user-cancelled upload.
///
/// Its own channel rather than an `upload_error` carrying a "cancelled" message:
/// cancellation is not a failure and must not raise a destructive toast, and
/// deciding that from the text would be the string sniffing #152 removed.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UploadCancelledEvent {
    pub operation_id: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
}

/// The non-terminal "this looks stalled" signal, and its all-clear.
///
/// `message` is `None` when a warning is being withdrawn because progress
/// resumed. Nothing about this event ends the upload - that is the whole point of
/// it, and why it does not go through `TerminalOnce`.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UploadStallWarningEvent {
    pub operation_id: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
    pub silent_for_seconds: u64,
    pub message: Option<String>,
}

// ---- Stall and warning messages ----

/// Whether the soft warning should be showing, and whether that has just changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WarningTransition {
    /// Nothing to say: either still quiet and already warned, or still moving.
    Unchanged,
    /// Newly quiet past the soft threshold.
    Raise,
    /// Progress resumed after a warning, so the warning must be withdrawn.
    Clear,
}

/// Decides whether the soft warning changes state, given whether it is currently
/// showing and how long the transfer has been quiet.
///
/// Latching is the caller's job, which is what keeps this a pure function: the
/// supervisor samples every second, so an unlatched warning would fire 35 times
/// across one silent period and read as a stream of failures rather than one piece
/// of information.
pub fn warning_transition(warned: bool, silence: Duration) -> WarningTransition {
    match (warned, silence >= STALL_WARNING_AFTER) {
        (false, true) => WarningTransition::Raise,
        (true, false) => WarningTransition::Clear,
        _ => WarningTransition::Unchanged,
    }
}

/// Renders a byte count for a user-facing message, in the decimal units macOS
/// shows in Finder so the figure is one the user can verify.
fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_000_000_000 {
        format!("{:.2} GB", bytes as f64 / 1_000_000_000.0)
    } else if bytes >= 1_000_000 {
        format!("{:.1} MB", bytes as f64 / 1_000_000.0)
    } else {
        format!("{} bytes", bytes)
    }
}

/// The message a stalled upload reports.
///
/// It names the offset, the total and the silence, because "stopped at 1.68 GB of
/// 4.10 GB, silent for 71s" is what tells the user whether to keep waiting or
/// cancel -- which is the question the old "timed out after 45 minutes" could not
/// answer. It deliberately says neither "timed out" nor "45 minutes": a stall is
/// a different condition from a deadline, and from the failures #152 and #154
/// already classify.
pub fn stall_message(bytes_sent: u64, total_bytes: u64, since_last_advance: Duration) -> String {
    let position = if bytes_sent == 0 {
        "The transfer never started sending".to_string()
    } else {
        let percentage = if total_bytes > 0 {
            format!(
                " ({:.0}%)",
                (bytes_sent as f64 / total_bytes as f64) * 100.0
            )
        } else {
            String::new()
        };
        format!(
            "The transfer stopped at {} of {}{}",
            format_bytes(bytes_sent),
            format_bytes(total_bytes),
            percentage
        )
    };

    format!(
        "Stalled after {}s with no data reaching Sprout. {}. That is a dropped \
         connection rather than a slow one, so waiting will not help. Check your \
         network and start the upload again.",
        since_last_advance.as_secs(),
        position
    )
}

/// The message the non-terminal warning carries.
///
/// It must not read like `stall_message`. That one is a verdict - the transfer is
/// over and waiting will not help. This one is a heads-up on something that may
/// still come back, and its job is to put the choice in front of the user while
/// there is still a choice to make. It names cancelling because cancelling is what
/// #225 made possible: a warning with no available action attached would be closer
/// to taunting than helping.
pub fn stall_warning_message(bytes_sent: u64, total_bytes: u64, silence: Duration) -> String {
    let position = if bytes_sent == 0 {
        "Nothing has been sent yet".to_string()
    } else {
        let percentage = if total_bytes > 0 {
            format!(
                " ({:.0}%)",
                (bytes_sent as f64 / total_bytes as f64) * 100.0
            )
        } else {
            String::new()
        };
        format!(
            "The transfer is at {} of {}{}",
            format_bytes(bytes_sent),
            format_bytes(total_bytes),
            percentage
        )
    };

    format!(
        "No data has reached Sprout for {}s. {}. A connection this quiet may recover \
         on its own, so this is not a failure yet - the upload is given up on at {}s. \
         Cancel it now if you would rather start again.",
        silence.as_secs(),
        position,
        STALL_WINDOW.as_secs()
    )
}

// ---- Terminal event arbitration ----

/// One-shot arbitration for the terminal event.
///
/// The watchdog and the upload task race by construction: a stall can be detected
/// in the same instant the request completes. Without this, an operation could
/// emit both an `upload_error` and an `upload_complete` and the user would be
/// told two contradictory things. #154 established one terminal event per
/// operation; this is what enforces it.
#[derive(Clone, Default)]
pub struct TerminalOnce(Arc<AtomicBool>);

impl TerminalOnce {
    /// True for exactly one caller, however many race.
    pub fn claim(&self) -> bool {
        self.0
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }

    /// Whether the operation has already reported. The watchdog stops polling on
    /// this rather than being aborted from elsewhere.
    pub fn is_settled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// `TerminalOnce` bound to the handle the single event is emitted on, and to the
/// operation every event names.
#[derive(Clone)]
pub(super) struct TerminalGate {
    once: TerminalOnce,
    app_handle: AppHandle,
    operation_id: String,
}

impl TerminalGate {
    pub(super) fn new(app_handle: AppHandle, operation_id: String) -> Self {
        TerminalGate {
            once: TerminalOnce::default(),
            app_handle,
            operation_id,
        }
    }

    pub(super) fn is_settled(&self) -> bool {
        self.once.is_settled()
    }

    /// Emits `upload_complete`, unless something already reported.
    pub(super) fn succeed(&self, video: Value) {
        if self.once.claim() {
            let _ = self.app_handle.emit(
                "upload_complete",
                UploadCompleteEvent {
                    operation_id: self.operation_id.clone(),
                    video,
                },
            );
        }
    }

    /// Emits `upload_error`, unless something already reported.
    pub(super) fn fail(&self, message: String) {
        if self.once.claim() {
            let _ = self.app_handle.emit(
                "upload_error",
                UploadErrorEvent {
                    operation_id: self.operation_id.clone(),
                    message,
                },
            );
        }
    }

    /// Emits `upload_cancelled`, unless something already reported.
    ///
    /// Claims the same one-shot as every other terminal arm: a cancel and a
    /// completion race by construction, and a user who cancels the instant Sprout
    /// answers must not be told both things happened.
    pub(super) fn cancel(&self, bytes_sent: u64, total_bytes: u64) {
        if self.once.claim() {
            let _ = self.app_handle.emit(
                "upload_cancelled",
                UploadCancelledEvent {
                    operation_id: self.operation_id.clone(),
                    bytes_sent,
                    total_bytes,
                },
            );
        }
    }

    /// Emits the non-terminal stall warning, or withdraws it when `message` is
    /// `None`. Deliberately outside the one-shot: this settles nothing, and an
    /// operation may raise and withdraw it repeatedly across one upload.
    pub(super) fn warn_stall(&self, event: UploadStallWarningEvent) {
        if self.once.is_settled() {
            return;
        }
        let _ = self.app_handle.emit("upload_stall_warning", event);
    }
}

// ---- Progress tracking ----

/// Byte progress shared between the upload task and the watchdog.
///
/// Atomics rather than a `Mutex`, so the watchdog can read the count without ever
/// contending with `poll_read` -- and so the old `try_lock` arm, which silently
/// dropped a chunk's bytes whenever it lost the race, is gone. Under-counting
/// progress is exactly what a stall detector must not do.
pub struct UploadProgress {
    bytes_sent: AtomicU64,
    total_bytes: AtomicU64,
    /// Microseconds since `started_at` at the last emitted progress event, or
    /// `NEVER_EMITTED` before the first one.
    last_emit_micros: AtomicU64,
    started_at: Instant,
}

/// Sentinel for "no progress event has been emitted yet", so the first read
/// reports immediately instead of waiting out an interval.
const NEVER_EMITTED: u64 = u64::MAX;

/// How often at most an `upload_progress` event is emitted.
///
/// Unthrottled, a 64 KB read emitted one event, so a 4 GB upload produced roughly
/// 65,000 of them. Carrying byte counts makes each payload larger, so the throttle
/// is what stops reporting bytes making the IPC flood worse. See #150 UP-05.
pub const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(100);

/// Whether a progress event is due, given when the last one went out.
pub fn is_progress_emit_due(last_emit: Duration, now: Duration) -> bool {
    now.saturating_sub(last_emit) >= PROGRESS_EMIT_INTERVAL
}

impl UploadProgress {
    pub fn new() -> Self {
        UploadProgress {
            bytes_sent: AtomicU64::new(0),
            total_bytes: AtomicU64::new(0),
            last_emit_micros: AtomicU64::new(NEVER_EMITTED),
            started_at: Instant::now(),
        }
    }

    pub(super) fn set_total(&self, total: u64) {
        self.total_bytes.store(total, Ordering::Relaxed);
    }

    /// Adds a chunk and returns the new total sent.
    ///
    /// Called on **every** read, never conditionally on whether an event is
    /// emitted. #204 moved this off `Mutex` + `try_lock` because the losing arm
    /// silently discarded a chunk's bytes, and an accumulator that under-counts is
    /// indistinguishable from a stall to the watchdog reading it. Throttling the
    /// event must not reintroduce that by throttling the count.
    pub fn advance(&self, bytes: u64) -> u64 {
        self.bytes_sent.fetch_add(bytes, Ordering::Relaxed) + bytes
    }

    pub fn bytes_sent(&self) -> u64 {
        self.bytes_sent.load(Ordering::Relaxed)
    }

    pub fn total_bytes(&self) -> u64 {
        self.total_bytes.load(Ordering::Relaxed)
    }

    pub fn elapsed(&self) -> Duration {
        self.started_at.elapsed()
    }

    /// Takes the right to emit a progress event at `now`, if one is due.
    ///
    /// `compare_exchange` rather than load-then-store so two readers could never
    /// both consider themselves due for the same interval. Only the emit slot is
    /// contended - `advance` above is unconditional.
    pub fn claim_emit_slot(&self, now: Duration) -> bool {
        let stamp = u64::try_from(now.as_micros()).unwrap_or(NEVER_EMITTED - 1);
        let mut last = self.last_emit_micros.load(Ordering::Relaxed);

        loop {
            let due =
                last == NEVER_EMITTED || is_progress_emit_due(Duration::from_micros(last), now);
            if !due {
                return false;
            }

            match self.last_emit_micros.compare_exchange_weak(
                last,
                stamp,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => return true,
                Err(actual) => last = actual,
            }
        }
    }
}

impl Default for UploadProgress {
    fn default() -> Self {
        Self::new()
    }
}

// ---- Size gate ----

/// The pre-flight size gate.
///
/// It lives in its own module so `CheckedUploadSize`'s field is unreachable from
/// the rest of this file: the only way to obtain one is `check_upload_size`. That
/// makes the rejection impossible to skip or reorder rather than merely
/// conventional, because `ProgressReader` cannot be built without one and so no
/// `upload_progress` event can be emitted for a file Sprout would refuse.
/// See issue #154 (UP-09a).
mod size_gate {
    /// Sprout's documented API upload ceiling. Their browser uploader allows
    /// 10 GB, but `POST /v1/videos` is capped at 5 GB and an oversized body is
    /// rejected by their edge with an HTML 413. See issue #150.
    const SPROUT_MAX_UPLOAD_BYTES: u64 = 5 * 1024 * 1024 * 1024;

    /// A file size that has passed `check_upload_size`.
    #[derive(Clone, Copy)]
    pub struct CheckedUploadSize(u64);

    impl CheckedUploadSize {
        /// The size in bytes, for the multipart content length and the progress
        /// percentage.
        pub fn bytes(&self) -> u64 {
            self.0
        }
    }

    /// Renders a byte count in decimal gigabytes, the unit macOS reports file
    /// sizes in, so the figure in the message matches what the user sees in
    /// Finder.
    fn format_gigabytes(bytes: u64) -> String {
        format!("{:.2} GB", bytes as f64 / 1_000_000_000.0)
    }

    /// Rejects files Sprout's API cannot accept, before any bytes are streamed.
    ///
    /// The limit is inclusive: a file of exactly 5 GiB is at the ceiling, not over
    /// it. The message quotes the limit as "5 GB" because that is how Sprout
    /// documents it; anything rejected here is over 5.36 decimal GB, so the two
    /// figures never read as contradictory.
    pub fn check_upload_size(file_size: u64) -> Result<CheckedUploadSize, String> {
        if file_size > SPROUT_MAX_UPLOAD_BYTES {
            return Err(format!(
                "This file is {}. Sprout Video's API accepts uploads up to 5 GB. \
                 Re-export at a lower bitrate, or upload it through the Sprout web \
                 uploader and paste the link into the \"Enter URL\" tab.",
                format_gigabytes(file_size)
            ));
        }

        Ok(CheckedUploadSize(file_size))
    }
}

pub use size_gate::{check_upload_size, CheckedUploadSize};

// ---- Async progress reader ----

/// Async Progress Tracking Reader using Tokio's AsyncRead API (with ReadBuf)
pub(super) struct ProgressReader<R> {
    inner: R,
    /// Shared with the stall watchdog, which is why this is atomic rather than a
    /// `Mutex` guarded by `try_lock`: that arm silently discarded a chunk's bytes
    /// whenever it lost the race, and a stall detector must never under-count.
    progress: Arc<UploadProgress>,
    /// A gated size, not a bare `u64`. This is what stops a reader - and the
    /// `upload_progress` events it emits - ever existing for a file Sprout's API
    /// would refuse. See `size_gate` and issue #154.
    total_size: CheckedUploadSize,
    app_handle: AppHandle,
    /// Named on every event, so a zombie operation's progress can never be
    /// mistaken for a retry's. See #150 UP-11.
    operation_id: String,
}

impl<R: AsyncRead + Unpin> AsyncRead for ProgressReader<R> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        // Record the initial filled length
        let pre_filled = buf.filled().len();
        // Poll the inner reader
        let pinned_inner = Pin::new(&mut self.inner);
        let res = pinned_inner.poll_read(cx, buf);
        if let Poll::Ready(Ok(())) = &res {
            let post_filled = buf.filled().len();
            let bytes_read = post_filled - pre_filled;
            if bytes_read > 0 {
                // Unconditional: the accumulator the stall watchdog reads must
                // never miss a chunk, whatever the throttle below decides.
                let total = self.total_size.bytes();
                let sent = self.progress.advance(bytes_read as u64);
                let percentage = (sent as f64 / total as f64) * 100.0;

                // The last read always reports, so the bar and the byte counts
                // land on the total rather than stopping a throttle-interval short.
                let due = sent >= total || self.progress.claim_emit_slot(self.progress.elapsed());
                if due {
                    let event = UploadProgressEvent {
                        operation_id: self.operation_id.clone(),
                        bytes_sent: sent,
                        total_bytes: total,
                        percentage,
                    };
                    if let Err(e) = self.app_handle.emit("upload_progress", event) {
                        log::warn!("Failed to emit progress event: {}", e);
                    }
                }
            }
        }
        res
    }
}

// ---- The upload task ----

/// Upload function that streams file data with progress tracking.
pub(super) async fn upload_video_task(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    target: UploadTarget,
    progress: Arc<UploadProgress>,
    gate: TerminalGate,
    operation_id: String,
) -> Result<(), String> {
    // Open the file
    let file = File::open(&file_path).map_err(|e| e.to_string())?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();

    // Refuse what Sprout's API cannot accept before a single byte is streamed. A
    // 12.72 GB render used to transfer for a long time only to earn an HTML 413,
    // and the size was knowable here in milliseconds. See issue #154.
    let checked_size = check_upload_size(file_size)?;
    progress.set_total(checked_size.bytes());

    // Convert the file into an async Tokio file and wrap it in a BufReader
    let file = tokio::fs::File::from_std(file);
    let reader = BufReader::new(file);

    // Set up the progress tracker
    let progress_reader = ProgressReader {
        inner: reader,
        progress: progress.clone(),
        total_size: checked_size,
        app_handle: app_handle.clone(),
        operation_id,
    };

    // Extract the original filename
    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("uploaded_video.mp4")
        .to_string();

    // No total-request deadline. It used to be 45 minutes, which killed a healthy
    // upload of a very large file over a slow connection while it was making
    // steady progress, and let a dead one sit for 44 minutes looking identical to
    // a slow one. A deadline that cannot see progress is the wrong mechanism in
    // both directions; `watch_for_stall` replaces it. See issue #204.
    //
    // `connect_timeout` stays, because a connect that has not completed is not a
    // transfer that is progressing. `tcp_keepalive` makes a wedged socket surface
    // as a transport error rather than relying on the watchdog alone (#150 T1.5).
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .tcp_keepalive(Duration::from_secs(30))
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Wrap the progress_reader into a request body.
    // Body::from_reader() is not available, so we use wrap_stream() with an adapter.
    // Here we convert the ProgressReader into a stream of byte vectors.
    let stream = unfold(progress_reader, |mut reader| async {
        let mut buf = vec![0u8; 65536]; // Increased buffer size to 64KB for better performance
        match reader.read(&mut buf).await {
            Ok(0) => None,
            Ok(n) => {
                buf.truncate(n);
                Some((Ok::<_, std::io::Error>(buf), reader))
            }
            Err(e) => Some((Err(e), reader)),
        }
    })
    // Convert each Vec<u8> into bytes::Bytes.
    .map_ok(Bytes::from);

    // Wrap the stream into a reqwest Body.
    let body = Body::wrap_stream(stream);

    let part = multipart::Part::stream_with_length(body, checked_size.bytes())
        .file_name(file_name.clone())
        .mime_str("video/mp4")
        .map_err(|e| e.to_string())?;

    let mut form = multipart::Form::new().part("source_video", part);
    // Folder and title for a new video; nothing for a replace. See `text_fields`.
    for (name, value) in text_fields(&target) {
        form = form.text(name, value);
    }

    println!("Starting upload to SproutVideo...");

    // Send the request asynchronously
    let response = client
        .post(endpoint(&target))
        .header("SproutVideo-Api-Key", api_key.to_string())
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    println!("Upload response: HTTP {}", status);

    // Read the body as text first. Deciding the outcome must never depend on the
    // body being parseable, or a non-JSON error page silently kills the upload.
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body (HTTP {}): {}", status, e))?;

    match classify_response(status, &body_text) {
        Ok(response_json) => {
            println!("Upload complete!");
            gate.succeed(response_json);
            Ok(())
        }
        Err(error_message) => Err(error_message),
    }
}
