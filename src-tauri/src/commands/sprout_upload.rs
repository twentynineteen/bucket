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
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;
use tauri::Emitter;
use tauri::{command, AppHandle};
use tokio::io::{AsyncRead, AsyncReadExt, BufReader};
use tokio::sync::Mutex;

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
    tauri::async_runtime::spawn(async move {
        match upload_video_task(app_handle, file_path, api_key, folder_id, title).await {
            Ok(_) => println!("Upload successful"),
            Err(err) => println!("Upload failed: {}", err),
        }
    });
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

// Async Progress Tracking Reader using Tokio's AsyncRead API (with ReadBuf)
pub struct ProgressReader<R> {
    inner: R,
    progress: Arc<Mutex<u64>>,
    total_size: u64,
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
                // Use try_lock but with better error handling
                match self.progress.try_lock() {
                    Ok(mut progress_guard) => {
                        *progress_guard += bytes_read as u64;
                        let percentage = (*progress_guard as f64 / self.total_size as f64) * 100.0;
                        println!("Upload progress: {:.2}%", percentage);

                        // Emit progress event to frontend
                        if let Err(e) = self.app_handle.emit("upload_progress", percentage as u32) {
                            eprintln!("Failed to emit progress event: {}", e);
                        }
                    }
                    Err(_) => {
                        // Progress update skipped due to lock contention
                        // This is acceptable for progress reporting - we'll catch up on the next read
                        eprintln!("Progress update skipped due to lock contention");
                    }
                }
            }
        }
        res
    }
}

// Upload function that streams file data with progress tracking
async fn upload_video_task(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<(), String> {
    // Open the file
    let file = File::open(&file_path).map_err(|e| e.to_string())?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();

    // Convert the file into an async Tokio file and wrap it in a BufReader
    let file = tokio::fs::File::from_std(file);
    let reader = BufReader::new(file);

    // Set up the progress tracker
    let progress = Arc::new(Mutex::new(0));
    let progress_reader = ProgressReader {
        inner: reader,
        progress: progress.clone(),
        total_size: file_size,
        app_handle: app_handle.clone(),
    };

    // Extract the original filename
    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("uploaded_video.mp4")
        .to_string();

    // Configure client with appropriate timeouts for large file uploads
    let client = Client::builder()
        .timeout(Duration::from_secs(45 * 60)) // 45 minute timeout for large files
        .connect_timeout(Duration::from_secs(30)) // 30 second connection timeout
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

    let part = multipart::Part::stream_with_length(body, file_size)
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
            let _ = app_handle.emit("upload_complete", response_json);
            Ok(())
        }
        Err(error_message) => {
            let _ = app_handle.emit("upload_error", error_message.clone());
            Err(error_message)
        }
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
