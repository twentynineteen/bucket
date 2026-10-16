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
use std::path::Path;
use tauri::{AppHandle, Emitter, State};

use super::encoder::{build_args, ActiveRender, RealSpawner, Spawner};
use super::state::RenderRegistry;

/// Request payload for `motion_render_start`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
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
/// `unknownRender`, `busy`.
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

/// Progress event payload emitted after each frame is accepted.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderProgress {
    render_id: String,
    frames_written: u32,
    total_frames: u32,
}

/// Managed state holding active render sessions.
///
/// Only one render may run at a time; a second `motion_render_start` while one
/// is active returns `MotionError { kind: "busy" }`.
pub struct MotionRenderState {
    pub registry: RenderRegistry,
}

impl MotionRenderState {
    pub fn new() -> Self {
        Self {
            registry: RenderRegistry::new(),
        }
    }
}

#[tauri::command]
pub async fn motion_render_start(
    app: AppHandle,
    state: State<'_, MotionRenderState>,
    request: MotionRenderRequest,
) -> Result<String, MotionError> {
    let _ = &app; // Used for event emission in frame command

    let output_path = Path::new(&request.output_path);
    let ffmpeg_args = build_args(
        request.ffmpeg_directory.as_deref(),
        request.width,
        request.height,
        request.fps,
        output_path,
    )?;

    let spawner = RealSpawner;
    let child = spawner.spawn(&ffmpeg_args.ffmpeg_path, &ffmpeg_args.args).map_err(|e| {
        MotionError {
            kind: "spawnFailed".to_string(),
            message: format!("failed to spawn ffmpeg: {}", e),
        }
    })?;

    let render = ActiveRender {
        process: child,
        output_path: ffmpeg_args.output_path,
        total_frames: request.total_frames,
        frames_written: 0,
    };

    let render_id = uuid::Uuid::new_v4().to_string();
    state.registry.insert(render_id.clone(), Box::new(render))?;

    Ok(render_id)
}

#[tauri::command]
pub async fn motion_render_frame(
    app: AppHandle,
    state: State<'_, MotionRenderState>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), MotionError> {
    let render_id = request
        .headers()
        .get("motion-render-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if render_id.is_empty() {
        return Err(MotionError {
            kind: "unknownRender".to_string(),
            message: "missing motion-render-id header".to_string(),
        });
    }

    let png_data = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            return Err(MotionError {
                kind: "encodeFailed".to_string(),
                message: "expected raw PNG bytes in request body".to_string(),
            });
        }
    };

    // Write the frame and collect progress info
    let progress = state.registry.with_render_mut(&render_id, |render| {
        render.write_frame(&png_data)?;
        Ok(RenderProgress {
            render_id: render_id.clone(),
            frames_written: render.frames_written(),
            total_frames: render.total_frames(),
        })
    });

    match progress {
        Ok(progress) => {
            let _ = app.emit("motion-render-progress", &progress);
            Ok(())
        }
        Err(e) => {
            // If the render errored, clean it up from the registry
            if e.kind == "encodeFailed" {
                let _ = state.registry.remove(&render_id);
            }
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn motion_render_finish(
    state: State<'_, MotionRenderState>,
    render_id: String,
) -> Result<String, MotionError> {
    let render = state.registry.remove(&render_id)?;
    render.finish()
}

#[tauri::command]
pub async fn motion_render_cancel(
    state: State<'_, MotionRenderState>,
    render_id: String,
) -> Result<(), MotionError> {
    let render = state.registry.remove(&render_id)?;
    render.cancel()
}
