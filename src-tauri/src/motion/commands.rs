//! Tauri commands for the Motion render pipeline (issue #326).
//!
//! Four commands drive a single ffmpeg process that encodes PNG frames into a
//! ProRes 4444 `.mov` with alpha:
//!
//! - `motion_render_start`: spawns ffmpeg with the right arguments.
//! - `motion_render_frame`: pipes one PNG frame to ffmpeg's stdin.
//! - `motion_render_finish`: closes stdin, waits for ffmpeg, returns the path.
//! - `motion_render_cancel`: kills ffmpeg and removes the partial file.
//!
//! Stubs created by #327 (Foundation); #334 replaces the bodies.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Request payload for `motion_render_start`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // Fields are read by #334's implementation
pub struct MotionRenderRequest {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub total_frames: u32,
    pub ffmpeg_directory: Option<String>,
}

/// Error shape returned by every motion command.
///
/// Serialises as `{ kind, message }` on the wire.
/// `kind` is one of: `ffmpegMissing`, `spawnFailed`, `encodeFailed`,
/// `unknownRender`, `busy`, `notImplemented`.
#[derive(Debug, Serialize)]
pub struct MotionError {
    pub kind: String,
    pub message: String,
}

impl std::fmt::Display for MotionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.kind, self.message)
    }
}

impl std::error::Error for MotionError {}

/// Managed state holding active render sessions.
///
/// Only one render may run at a time; a second `motion_render_start` while one
/// is active returns `MotionError { kind: "busy" }`.
#[allow(dead_code)] // Used by #334's implementation
pub struct MotionRenderState {
    pub active: Mutex<HashMap<String, ()>>,
}

impl MotionRenderState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }
}

fn not_implemented(name: &str) -> MotionError {
    MotionError {
        kind: "notImplemented".to_string(),
        message: format!("not implemented: {} (#334)", name),
    }
}

#[tauri::command]
#[allow(unused_variables)]
pub async fn motion_render_start(
    app: AppHandle,
    state: State<'_, MotionRenderState>,
    request: MotionRenderRequest,
) -> Result<String, MotionError> {
    Err(not_implemented("motion_render_start"))
}

#[tauri::command]
#[allow(unused_variables)]
pub async fn motion_render_frame(
    state: State<'_, MotionRenderState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), MotionError> {
    // The render id comes from the header, the PNG bytes from the body.
    let _render_id = request
        .headers()
        .get("motion-render-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    Err(not_implemented("motion_render_frame"))
}

#[tauri::command]
#[allow(unused_variables)]
pub async fn motion_render_finish(
    state: State<'_, MotionRenderState>,
    render_id: String,
) -> Result<String, MotionError> {
    Err(not_implemented("motion_render_finish"))
}

#[tauri::command]
#[allow(unused_variables)]
pub async fn motion_render_cancel(
    state: State<'_, MotionRenderState>,
    render_id: String,
) -> Result<(), MotionError> {
    Err(not_implemented("motion_render_cancel"))
}
