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

#[command]
pub async fn get_folders(
    api_key: String,
    folder_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    // Build the URL based on whether a folder_id is provided.
    let mut url = "https://api.sproutvideo.com/v1/folders".to_string();
    if let Some(fid) = folder_id {
        // Assuming the API supports a query parameter like `folder_id`
        url = format!("{}?folder_id={}", url, fid);
    }
    let response = client
        .get(&url)
        .header("SproutVideo-Api-Key", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[command]
pub fn upload_video(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
) {
    tauri::async_runtime::spawn(async move {
        match upload_video_task(app_handle, file_path, api_key, folder_id).await {
            Ok(_) => println!("Upload successful"),
            Err(err) => println!("Upload failed: {}", err),
        }
    });
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
    // Parse the response body as JSON.
    let response_json: Value = response.json().await.map_err(|e| e.to_string())?;
    println!("Upload Response: {:?}", response_json);

    if status.is_success() {
        println!("Upload complete!");
        let _ = app_handle.emit("upload_complete", response_json);
        Ok(())
    } else {
        let error_message = format!("Upload failed: HTTP {} - {:?}", status, response_json);
        let _ = app_handle.emit("upload_error", error_message.clone());
        Err(error_message)
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
