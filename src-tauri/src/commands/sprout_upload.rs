use app_lib::media::SproutVideoDetails;
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
use tauri::Emitter;
use tauri::{command, AppHandle};
use tokio::io::{AsyncRead, AsyncReadExt, BufReader};

/// A single Sprout folder.
///
/// Field names stay snake_case deliberately. The Tauri macro camelCases command
/// *arguments* only; *return values* serialise through plain serde, so the
/// frontend reads `parent_id` as written. Renaming these for "consistency" with
/// the argument convention would break the boundary. See issue #155 §2.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub struct SproutFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// One page of folders exactly as Sprout sends it. Internal to this module.
///
/// Separate from `SproutFoldersPage` because the two have opposite needs: Sprout
/// never sends `truncated`, and the aggregate must not carry `next_page`.
#[derive(serde::Deserialize, Debug, Clone)]
pub struct SproutFoldersWirePage {
    pub folders: Vec<SproutFolder>,
    #[serde(default)]
    pub total: Option<u32>,
    /// Read ONLY as a has-more signal, never followed. Sprout's own docs show
    /// this URL carrying neither `parent_id` nor the requested `per_page`, so
    /// following it from a scoped request would return the ROOT's next page and
    /// splice foreign folders into a child listing. See issue #155 Phase 1.
    #[serde(default)]
    pub next_page: Option<String>,
}

/// Every folder at one level, aggregated across pages. The command's public
/// return type — `next_page` deliberately does not survive this boundary.
#[derive(serde::Serialize, Debug, Clone, PartialEq)]
pub struct SproutFoldersPage {
    pub folders: Vec<SproutFolder>,
    /// Sprout's `total` for THIS level, not `folders.len()`. The two diverge
    /// when `truncated` is set, which is exactly when a caller needs to know.
    pub total: Option<u32>,
    /// True when `MAX_FOLDER_PAGES` stopped us before Sprout ran out of pages.
    pub truncated: bool,
    /// `X-RateLimit-Remaining` from the last page fetched. Feeds the frontend's
    /// budget guard so it can reserve headroom for uploads. See issue #155 R5.
    pub rate_limit_remaining: Option<u32>,
    /// `X-RateLimit-Reset` (UTC epoch seconds) from the last page fetched.
    pub rate_limit_reset: Option<u64>,
}

/// Sprout's maximum page size for folder listings.
const FOLDERS_PER_PAGE: u32 = 100;

/// Stop after this many pages per level. A runaway loop against a malformed
/// response is worse than a truncated list, and `truncated` tells the caller.
const MAX_FOLDER_PAGES: u32 = 10;

/// Builds one page URL for a folder level.
///
/// `parent_id` is omitted entirely for the root level — Sprout returns root
/// folders when it is absent, and sending an empty value is not the same thing.
pub fn folders_url(parent_id: Option<&str>, page: u32, per_page: u32) -> String {
    let mut url = reqwest::Url::parse("https://api.sproutvideo.com/v1/folders")
        .expect("the folders endpoint is a valid URL");

    {
        // `query_pairs_mut` percent-encodes values, so a folder id containing
        // reserved characters cannot break out of its parameter.
        let mut query = url.query_pairs_mut();
        query.append_pair("page", &page.to_string());
        query.append_pair("per_page", &per_page.to_string());
        query.append_pair("order_by", "name");
        query.append_pair("order_dir", "asc");
        if let Some(pid) = parent_id {
            query.append_pair("parent_id", pid);
        }
    }

    url.into()
}

/// Decides one folder page's outcome from the HTTP status and raw body.
///
/// Mirrors `classify_response`: the status is checked BEFORE the body is
/// parsed, so an HTML or empty error page can never be mistaken for an empty
/// folder list. `retry_after` is rendered into the 429 message when present.
pub fn classify_folders_page(
    status: reqwest::StatusCode,
    body: &str,
    retry_after: Option<&str>,
) -> Result<SproutFoldersWirePage, String> {
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        // Sprout allows 200 requests/minute per ACCOUNT. Name the wait so the
        // caller can surface it rather than hammering a closed window.
        let wait = match retry_after {
            Some(seconds) => format!(" Try again in {} seconds.", seconds),
            None => String::new()
        };
        return Err(format!(
            "Sprout rate limit reached (HTTP 429).{} The limit is 200 requests per minute across your whole account.",
            wait
        ));
    }

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(format!(
            "Sprout rejected the folder request: HTTP {} — check your Sprout Video API key in Settings.",
            status.as_u16()
        ));
    }

    if !status.is_success() {
        return Err(format!(
            "Sprout rejected the folder request: HTTP {} — {}",
            status,
            body_excerpt(body)
        ));
    }

    // A 2xx carrying `null`, `[]` or an error object parses as JSON but is not a
    // folder listing. Requiring `folders` stops that rendering as "no subfolders".
    let parsed: Value = serde_json::from_str(body).map_err(|e| {
        format!(
            "Sprout returned HTTP {} but the folder list was not valid JSON ({}): {}",
            status,
            e,
            body_excerpt(body)
        )
    })?;

    if parsed.get("folders").is_none() {
        return Err(format!(
            "Sprout returned HTTP {} with an unexpected JSON shape (no \"folders\"): {}",
            status,
            body_excerpt(body)
        ));
    }

    serde_json::from_value(parsed).map_err(|e| {
        format!(
            "Sprout returned HTTP {} but the folder list could not be read ({}): {}",
            status,
            e,
            body_excerpt(body)
        )
    })
}

/// Reads a header as a number, tolerating absence and unparseable values.
fn header_number<T: std::str::FromStr>(
    headers: &reqwest::header::HeaderMap,
    name: &str,
) -> Option<T> {
    headers
        .get(name)?
        .to_str()
        .ok()?
        .trim()
        .parse::<T>()
        .ok()
}

/// Lists the folders directly inside `parent_id`, or the root folders when it is
/// `None`. Pagination is consumed here so the frontend never sees pages.
#[command]
pub async fn get_folders(
    api_key: String,
    parent_id: Option<String>,
) -> Result<SproutFoldersPage, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut folders: Vec<SproutFolder> = Vec::new();
    let mut total: Option<u32> = None;
    let mut rate_limit_remaining: Option<u32> = None;
    let mut rate_limit_reset: Option<u64> = None;
    let mut truncated = false;

    for page in 1..=MAX_FOLDER_PAGES {
        let url = folders_url(parent_id.as_deref(), page, FOLDERS_PER_PAGE);

        let response = client
            .get(&url)
            .header("SproutVideo-Api-Key", &api_key)
            .send()
            .await
            .map_err(|e| format!("Could not reach Sprout Video: {}", e))?;

        let status = response.status();
        let headers = response.headers().clone();
        let retry_after = headers
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        rate_limit_remaining = header_number::<u32>(&headers, "X-RateLimit-Remaining");
        rate_limit_reset = header_number::<u64>(&headers, "X-RateLimit-Reset");

        let body_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read folder response (HTTP {}): {}", status, e))?;

        let wire = classify_folders_page(status, &body_text, retry_after.as_deref())?;

        if total.is_none() {
            total = wire.total;
        }
        folders.extend(wire.folders);

        if wire.next_page.is_none() {
            break;
        }

        if page == MAX_FOLDER_PAGES {
            truncated = true;
            eprintln!(
                "get_folders: stopped at the {}-page cap for parent {:?}; more folders exist",
                MAX_FOLDER_PAGES, parent_id
            );
        }
    }

    Ok(SproutFoldersPage {
        folders,
        total,
        truncated,
        rate_limit_remaining,
        rate_limit_reset
    })
}

#[command]
pub fn upload_video(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
) {
    let gate = TerminalGate::new(app_handle.clone());
    let progress = Arc::new(UploadProgress::new());

    let upload_gate = gate.clone();
    let upload_progress = progress.clone();
    let upload = tauri::async_runtime::spawn(async move {
        let outcome = upload_video_task(
            app_handle,
            file_path,
            api_key,
            folder_id,
            title,
            upload_progress,
            upload_gate.clone(),
        )
        .await;

        // Every exit from the task reports itself, including the `?` paths that
        // used to vanish into a bare `println!`. The gate makes a second report
        // impossible, so the watchdog and this arm cannot both be heard.
        if let Err(err) = outcome {
            upload_gate.fail(err);
        }
    });

    // Deliberately its own task rather than a `select!` inside the upload task: a
    // watchdog that shares the task it is watching cannot fire when that task is
    // blocked inside a syscall, which is one of #150's candidate causes.
    tauri::async_runtime::spawn(watch_for_stall(upload, progress, gate));
}

/// How often the watchdog samples progress. Cheap: two atomic loads.
const STALL_POLL_INTERVAL: Duration = Duration::from_secs(1);

/// How long a transfer may fail to advance before it is called stalled.
///
/// The binding constraint is not the gap between chunks, it is the longest
/// silence a *recoverable* TCP connection can produce. RFC 6298 doubles the
/// retransmission timeout from a 1s minimum, so six consecutive retransmissions
/// put 1+2+4+8+16+32 = 63s between the last acknowledged byte and recovery, and
/// macOS keeps retransmitting well past six. Reporting a stall inside that window
/// means a Wi-Fi roam or a VPN re-establish costs the user a multi-gigabyte
/// upload, so the threshold sits just above the backoff ceiling with margin for
/// the client-side buffer that has to fill before source-read silence begins to
/// track wire silence.
///
/// Chunk gaps are nowhere near this: the stream pulls 64 KB per read, so the
/// steady-state gap is 64 KB / bandwidth -- 32ms at 2 MB/s, 3.2s even at an
/// abysmal 20 KB/s.
///
/// If false stalls are ever observed in the wild, raise this rather than removing
/// the check. See issue #204.
pub const STALL_WINDOW: Duration = Duration::from_secs(70);

/// The advance that counts as headway and restarts the window.
///
/// A bare "no bytes for N seconds" gap timer is defeated by a trickle: a dying
/// connection that moves one byte every 20s resets such a timer forever while
/// never completing. Requiring 1 MiB per window puts the floor at ~15 KB/s, well
/// below any bandwidth on which a multi-gigabyte upload could plausibly finish
/// and far above a trickle. A gap timer is the degenerate case of this test with
/// the minimum set to one byte, so generalising costs nothing.
pub const STALL_MIN_PROGRESS_BYTES: u64 = 1024 * 1024;

/// The verdict on one progress sample.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StallCheck {
    /// Still making headway, or still inside the current window.
    Advancing,
    /// Less than `STALL_MIN_PROGRESS_BYTES` moved across a full window.
    Stalled {
        /// How long since the last qualifying advance, for the message.
        since_last_advance: Duration,
    },
}

/// Decides whether a transfer has stalled, from progress over a sliding window.
///
/// The clock is a parameter rather than a field: every decision is a pure
/// function of (bytes so far, time so far), which is what makes the thresholds
/// unit-testable in microseconds instead of by sleeping.
pub struct StallMonitor {
    window: Duration,
    min_progress: u64,
    /// Byte count at the start of the current window.
    anchor_bytes: u64,
    /// When the current window started.
    anchor_at: Duration,
}

impl StallMonitor {
    /// A monitor with the production thresholds, anchored at `started_at`.
    pub fn new(started_at: Duration) -> Self {
        StallMonitor {
            window: STALL_WINDOW,
            min_progress: STALL_MIN_PROGRESS_BYTES,
            anchor_bytes: 0,
            anchor_at: started_at,
        }
    }

    /// Feeds one sample. `now` is elapsed time since the upload was invoked.
    pub fn observe(&mut self, bytes_sent: u64, now: Duration) -> StallCheck {
        if bytes_sent.saturating_sub(self.anchor_bytes) >= self.min_progress {
            self.anchor_bytes = bytes_sent;
            self.anchor_at = now;
            return StallCheck::Advancing;
        }

        let since_last_advance = now.saturating_sub(self.anchor_at);
        if since_last_advance >= self.window {
            StallCheck::Stalled { since_last_advance }
        } else {
            StallCheck::Advancing
        }
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

/// `TerminalOnce` bound to the handle the single event is emitted on.
#[derive(Clone)]
struct TerminalGate {
    once: TerminalOnce,
    app_handle: AppHandle,
}

impl TerminalGate {
    fn new(app_handle: AppHandle) -> Self {
        TerminalGate {
            once: TerminalOnce::default(),
            app_handle,
        }
    }

    fn is_settled(&self) -> bool {
        self.once.is_settled()
    }

    /// Emits `upload_complete`, unless something already reported.
    fn succeed(&self, video: Value) {
        if self.once.claim() {
            let _ = self.app_handle.emit("upload_complete", video);
        }
    }

    /// Emits `upload_error`, unless something already reported.
    fn fail(&self, message: String) {
        if self.once.claim() {
            let _ = self.app_handle.emit("upload_error", message);
        }
    }
}

/// Byte progress shared between the upload task and the watchdog.
///
/// Atomics rather than a `Mutex`, so the watchdog can read the count without ever
/// contending with `poll_read` -- and so the old `try_lock` arm, which silently
/// dropped a chunk's bytes whenever it lost the race, is gone. Under-counting
/// progress is exactly what a stall detector must not do.
pub struct UploadProgress {
    bytes_sent: AtomicU64,
    total_bytes: AtomicU64,
    started_at: Instant,
}

impl UploadProgress {
    fn new() -> Self {
        UploadProgress {
            bytes_sent: AtomicU64::new(0),
            total_bytes: AtomicU64::new(0),
            started_at: Instant::now(),
        }
    }

    fn set_total(&self, total: u64) {
        self.total_bytes.store(total, Ordering::Relaxed);
    }

    /// Adds a chunk and returns the new total sent.
    fn advance(&self, bytes: u64) -> u64 {
        self.bytes_sent.fetch_add(bytes, Ordering::Relaxed) + bytes
    }

    fn bytes_sent(&self) -> u64 {
        self.bytes_sent.load(Ordering::Relaxed)
    }

    fn total_bytes(&self) -> u64 {
        self.total_bytes.load(Ordering::Relaxed)
    }

    fn elapsed(&self) -> Duration {
        self.started_at.elapsed()
    }
}

/// Watches a transfer for a stall and tears it down if it finds one.
///
/// Detection lives here rather than in the frontend for three reasons the
/// frontend cannot match: it can stop the transfer, it knows the byte offset, and
/// it can measure a rate rather than an event gap. What it cannot see is bytes
/// acknowledged on the wire -- it watches source-file reads, which reqwest's
/// backpressure keeps within the ~5 MB of hyper queue plus kernel socket buffer
/// measured in #150. So it detects "the transfer stopped", never "the transfer is
/// being discarded".
async fn watch_for_stall(
    upload: tauri::async_runtime::JoinHandle<()>,
    progress: Arc<UploadProgress>,
    gate: TerminalGate,
) {
    let mut monitor = StallMonitor::new(Duration::ZERO);

    loop {
        tokio::time::sleep(STALL_POLL_INTERVAL).await;

        // The operation reported for itself, so there is nothing left to watch.
        if gate.is_settled() {
            return;
        }

        let bytes_sent = progress.bytes_sent();
        if let StallCheck::Stalled { since_last_advance } =
            monitor.observe(bytes_sent, progress.elapsed())
        {
            let message = stall_message(bytes_sent, progress.total_bytes(), since_last_advance);
            log::warn!("{}", message);
            gate.fail(message);
            // Reporting without tearing down would leave a dead upload holding
            // the socket, and its progress events would interleave with a retry's.
            upload.abort();
            return;
        }
    }
}

/// Maximum characters of a response body to quote in an error message. Enough to
/// identify an HTML error page, short enough to stay readable in a toast.
const BODY_EXCERPT_LIMIT: usize = 512;

/// Renders a response body for an error message, truncated on a char boundary so
/// multi-byte content cannot panic.
fn body_excerpt(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "(empty body)".to_string();
    }

    let excerpt: String = trimmed.chars().take(BODY_EXCERPT_LIMIT).collect();
    if trimmed.chars().count() > BODY_EXCERPT_LIMIT {
        format!("{}… (truncated)", excerpt)
    } else {
        excerpt
    }
}

/// Decides an upload's outcome from the HTTP status and the raw response body.
///
/// The body is parsed as JSON only on the success path. Sprout and the
/// intermediaries in front of it return HTML or empty bodies for 413/502/504, so
/// deserialising before checking the status throws away the status code that
/// names the actual failure — and, because that parse failure propagated with
/// `?`, it bypassed the only `upload_error` emitter entirely and left the
/// frontend waiting forever. See issue #150.
pub fn classify_response(status: reqwest::StatusCode, body: &str) -> Result<Value, String> {
    if status.is_success() {
        let parsed: Value = serde_json::from_str(body).map_err(|e| {
            format!(
                "Sprout returned HTTP {} but the response body was not valid JSON ({}): {}",
                status,
                e,
                body_excerpt(body)
            )
        })?;

        // A 2xx carrying `null`, `[]` or a bare string parses fine but is not a
        // video record. Treating it as success emits `upload_complete` with a
        // useless payload, so the user is told the upload worked and no video
        // link appears. Require the `id` the frontend actually reads.
        if parsed.get("id").is_none() {
            return Err(format!(
                "Sprout returned HTTP {} with an unexpected JSON shape (no \"id\"): {}",
                status,
                body_excerpt(body)
            ));
        }

        Ok(parsed)
    } else {
        Err(format!(
            "Sprout rejected the upload: HTTP {} — {}",
            status,
            body_excerpt(body)
        ))
    }
}

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

// Async Progress Tracking Reader using Tokio's AsyncRead API (with ReadBuf)
pub struct ProgressReader<R> {
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
                let sent = self.progress.advance(bytes_read as u64);
                let percentage = (sent as f64 / self.total_size.bytes() as f64) * 100.0;

                // Emit progress event to frontend
                if let Err(e) = self.app_handle.emit("upload_progress", percentage as u32) {
                    eprintln!("Failed to emit progress event: {}", e);
                }
            }
        }
        res
    }
}

// Upload function that streams file data with progress tracking
#[allow(clippy::too_many_arguments)]
async fn upload_video_task(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
    progress: Arc<UploadProgress>,
    gate: TerminalGate,
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
    // If a folder_id was provided, add it as a text field.
    if let Some(fid) = folder_id {
        form = form.text("folder_id", fid);
    }
    // If a title was provided, send it so Sprout doesn't derive one from the filename.
    if let Some(t) = title {
        let trimmed = t.trim().to_string();
        if !trimmed.is_empty() {
            form = form.text("title", trimmed);
        }
    }

    println!("Starting upload to SproutVideo...");

    // Send the request asynchronously
    let response = client
        .post("https://api.sproutvideo.com/v1/videos")
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

/// Fetches video metadata from Sprout Video API given a video ID
/// Feature: 004-embed-multiple-video - URL auto-fetch
#[command]
pub async fn fetch_sprout_video_details(
    video_id: String,
    api_key: String,
) -> Result<SproutVideoDetails, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("https://api.sproutvideo.com/v1/videos/{}", video_id);

    let response = client
        .get(&url)
        .header("SproutVideo-Api-Key", api_key)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = response.status();

    if !status.is_success() {
        return Err(format!("API returned error: {}", status));
    }

    let video_data: SproutVideoDetails = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(video_data)
}
