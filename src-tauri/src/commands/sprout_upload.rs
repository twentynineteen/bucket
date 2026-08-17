use crate::build_project::OperationRegistry;
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
use tauri::{command, AppHandle, State};
use tokio::io::{AsyncRead, AsyncReadExt, BufReader};
use tokio::sync::watch;

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

/// Starts an upload and returns the id it can be addressed by.
///
/// Returning the id is what makes cancellation possible at all: before #225 this
/// command returned `()`, so a running upload could not be named, let alone
/// stopped, and dismissing the dialog left a multi-gigabyte transfer running with
/// nowhere to watch it. The registry is the same `OperationRegistry` BuildProject's
/// file transfers use - reused rather than reinvented.
#[command]
pub async fn upload_video(
    app_handle: AppHandle,
    registry: State<'_, OperationRegistry>,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<String, String> {
    let (operation_id, cancel_rx) = registry.register().await;

    let gate = TerminalGate::new(app_handle.clone(), operation_id.clone());
    let progress = Arc::new(UploadProgress::new());

    let upload_gate = gate.clone();
    let upload_progress = progress.clone();
    let upload_operation = operation_id.clone();
    let upload = tauri::async_runtime::spawn(async move {
        let outcome = upload_video_task(
            app_handle,
            file_path,
            api_key,
            folder_id,
            title,
            upload_progress,
            upload_gate.clone(),
            upload_operation,
        )
        .await;

        // Every exit from the task reports itself, including the `?` paths that
        // used to vanish into a bare `println!`. The gate makes a second report
        // impossible, so the supervisor and this arm cannot both be heard.
        if let Err(err) = outcome {
            upload_gate.fail(err);
        }
    });

    // Deliberately its own task rather than a `select!` inside the upload task: a
    // watchdog that shares the task it is watching cannot fire when that task is
    // blocked inside a syscall, which is one of #150's candidate causes. The same
    // reasoning applies to cancellation - a cancel must be actioned even when the
    // upload task is wedged, which is precisely when a user reaches for it.
    tauri::async_runtime::spawn(supervise_upload(
        upload,
        progress,
        gate,
        cancel_rx,
        registry.inner().clone(),
        operation_id.clone(),
    ));

    Ok(operation_id)
}

/// Signals cancellation for a running upload.
///
/// Extracted from the command so it can be tested against a real registry without
/// a Tauri runtime. Returns false when the operation is not running: a dialog is
/// routinely dismissed a moment after the upload finished, and "nothing to
/// cancel" is not a failure.
pub async fn signal_cancel(registry: &OperationRegistry, operation_id: &str) -> bool {
    if !registry.has_operation(operation_id).await {
        log::info!(
            "[Sprout] Upload {} is not running; nothing to cancel",
            operation_id
        );
        return false;
    }

    let signalled = registry.cancel(operation_id).await;
    if signalled {
        log::info!("[Sprout] Cancellation signalled for upload {}", operation_id);
    }
    signalled
}

/// Cancels an in-flight upload. Mirrors `cancel_file_transfer`.
///
/// `Ok(false)` means the operation was not found, which is the normal outcome when
/// the upload had already finished.
#[command]
pub async fn cancel_upload(
    registry: State<'_, OperationRegistry>,
    operation_id: String,
) -> Result<bool, String> {
    Ok(signal_cancel(registry.inner(), &operation_id).await)
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

/// When the non-terminal "this looks stalled" warning is raised.
///
/// The terminal verdict at `STALL_WINDOW` answers "is it dead?"; the question a
/// user actually has while watching a frozen bar is "wait, or cancel?", and until
/// #225 nothing answered that before the transfer was already over. Half the
/// window gives the user the whole second half to act on it.
///
/// Derived from `STALL_WINDOW` rather than written as its own literal, so raising
/// one cannot silently leave the other behind. Note the contrast with #154, which
/// declined a soft warning below the 5 GB limit because warning about a
/// legitimately uploadable file is noise: a stall is not a legitimate state. The
/// warning is non-terminal precisely because a recoverable TCP backoff *is*
/// legitimate for tens of seconds - it informs, it does not act.
pub const STALL_WARNING_AFTER: Duration = Duration::from_secs(STALL_WINDOW.as_secs() / 2);

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

        let since_last_advance = self.silence(now);
        if since_last_advance >= self.window {
            StallCheck::Stalled { since_last_advance }
        } else {
            StallCheck::Advancing
        }
    }

    /// How long since the last qualifying advance.
    ///
    /// The soft warning reads the same clock the terminal verdict does rather than
    /// starting a second one, so the two can never disagree about how quiet the
    /// transfer has been.
    pub fn silence(&self, now: Duration) -> Duration {
        now.saturating_sub(self.anchor_at)
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
struct TerminalGate {
    once: TerminalOnce,
    app_handle: AppHandle,
    operation_id: String,
}

impl TerminalGate {
    fn new(app_handle: AppHandle, operation_id: String) -> Self {
        TerminalGate {
            once: TerminalOnce::default(),
            app_handle,
            operation_id,
        }
    }

    fn is_settled(&self) -> bool {
        self.once.is_settled()
    }

    /// Emits `upload_complete`, unless something already reported.
    fn succeed(&self, video: Value) {
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
    fn fail(&self, message: String) {
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
    fn cancel(&self, bytes_sent: u64, total_bytes: u64) {
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
    fn warn_stall(&self, event: UploadStallWarningEvent) {
        if self.once.is_settled() {
            return;
        }
        let _ = self.app_handle.emit("upload_stall_warning", event);
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

    fn set_total(&self, total: u64) {
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

    fn elapsed(&self) -> Duration {
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

/// Watches a transfer for a stall, watches for the user cancelling it, and tears
/// it down for either reason.
///
/// Detection lives here rather than in the frontend for three reasons the
/// frontend cannot match: it can stop the transfer, it knows the byte offset, and
/// it can measure a rate rather than an event gap. What it cannot see is bytes
/// acknowledged on the wire -- it watches source-file reads, which reqwest's
/// backpressure keeps within the ~5 MB of hyper queue plus kernel socket buffer
/// measured in #150. So it detects "the transfer stopped", never "the transfer is
/// being discarded".
///
/// Cancellation shares this task rather than getting one of its own for the same
/// reason the watchdog is not a `select!` inside the upload task: a cancel has to
/// be actioned even when the upload task is wedged in a syscall, which is exactly
/// the situation in which a user reaches for it.
async fn supervise_upload(
    upload: tauri::async_runtime::JoinHandle<()>,
    progress: Arc<UploadProgress>,
    gate: TerminalGate,
    mut cancel_rx: watch::Receiver<bool>,
    registry: OperationRegistry,
    operation_id: String,
) {
    let mut monitor = StallMonitor::new(Duration::ZERO);
    // Whether the soft warning is currently showing. Latched here so
    // `warning_transition` stays pure and the user is told once, not once a second.
    let mut warned = false;
    // The watch sender is dropped when the operation is deregistered. That is not
    // a cancellation, and `changed()` would then return `Err` immediately forever,
    // spinning the loop - so stop selecting on it once it has closed.
    let mut watching_cancel = true;

    loop {
        if watching_cancel {
            tokio::select! {
                _ = tokio::time::sleep(STALL_POLL_INTERVAL) => {}
                changed = cancel_rx.changed() => {
                    if changed.is_err() {
                        watching_cancel = false;
                    }
                }
            }
        } else {
            tokio::time::sleep(STALL_POLL_INTERVAL).await;
        }

        if OperationRegistry::is_cancelled(&cancel_rx) {
            let bytes_sent = progress.bytes_sent();
            log::info!(
                "[Sprout] Upload {} cancelled by the user at {} bytes",
                operation_id,
                bytes_sent
            );
            gate.cancel(bytes_sent, progress.total_bytes());
            // Reporting a cancellation without tearing the request down is the
            // orphaned-upload defect with a nicer message. The abort drops the
            // reqwest future, which closes the socket.
            upload.abort();
            break;
        }

        // The operation reported for itself, so there is nothing left to watch.
        if gate.is_settled() {
            break;
        }

        let bytes_sent = progress.bytes_sent();
        let now = progress.elapsed();
        match monitor.observe(bytes_sent, now) {
            StallCheck::Stalled { since_last_advance } => {
                let message = stall_message(bytes_sent, progress.total_bytes(), since_last_advance);
                log::warn!("{}", message);
                gate.fail(message);
                // Reporting without tearing down would leave a dead upload holding
                // the socket, and its progress events would interleave with a
                // retry's.
                upload.abort();
                break;
            }
            StallCheck::Advancing => {
                let silence = monitor.silence(now);
                let transition = warning_transition(warned, silence);
                if transition != WarningTransition::Unchanged {
                    warned = transition == WarningTransition::Raise;
                    gate.warn_stall(UploadStallWarningEvent {
                        operation_id: operation_id.clone(),
                        bytes_sent,
                        total_bytes: progress.total_bytes(),
                        silent_for_seconds: silence.as_secs(),
                        message: if warned {
                            Some(stall_warning_message(
                                bytes_sent,
                                progress.total_bytes(),
                                silence,
                            ))
                        } else {
                            None
                        }
                    });
                }
            }
        }
    }

    // Unconditional and in one place: any terminal path that skipped this would
    // leak the operation and leave a stale id the user could still "cancel".
    registry.complete(&operation_id).await;
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
                        percentage
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
        operation_id
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
