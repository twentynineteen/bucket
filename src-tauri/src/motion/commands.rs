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
///
/// Serialises with camelCase keys to match the TS `MotionRenderProgress`
/// interface: `{ renderId, framesWritten, totalFrames }`.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgress {
    pub render_id: String,
    pub frames_written: u32,
    pub total_frames: u32,
}

/// Abstraction over the event channel so the progress path is testable
/// without a running Tauri app. The production implementation calls
/// `AppHandle::emit`; tests inject a collecting sink.
pub trait ProgressSink: Send {
    fn emit(&self, progress: &RenderProgress);
}

/// Writes one frame and emits a progress event through the given sink.
///
/// This is the function the Tauri command delegates to; the only line it
/// does not cover is the `AppHandle::emit` adapter.
pub fn write_frame_with_progress(
    registry: &super::state::RenderRegistry,
    render_id: &str,
    png_data: &[u8],
    sink: &dyn ProgressSink,
) -> Result<(), MotionError> {
    let progress = registry.with_render_mut(render_id, |render| {
        render.write_frame(png_data)?;
        Ok(RenderProgress {
            render_id: render_id.to_string(),
            frames_written: render.frames_written(),
            total_frames: render.total_frames(),
        })
    });

    match progress {
        Ok(p) => {
            sink.emit(&p);
            Ok(())
        }
        Err(e) => {
            if e.kind == "encodeFailed" {
                let _ = registry.remove(render_id);
            }
            Err(e)
        }
    }
}

/// Adapter that emits progress events through a Tauri `AppHandle`.
struct TauriProgressSink {
    app: AppHandle,
}

impl ProgressSink for TauriProgressSink {
    fn emit(&self, progress: &RenderProgress) {
        let _ = self.app.emit("motion-render-progress", progress);
    }
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

    let sink = TauriProgressSink { app };
    write_frame_with_progress(&state.registry, &render_id, &png_data, &sink)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::motion::encoder::tests::FakeChild;
    use crate::motion::encoder::ActiveRender;
    use std::sync::Mutex;

    /// A collecting progress sink for tests.
    struct CollectingSink {
        events: Mutex<Vec<RenderProgress>>,
    }

    impl CollectingSink {
        fn new() -> Self {
            Self {
                events: Mutex::new(Vec::new()),
            }
        }

        fn into_events(self) -> Vec<RenderProgress> {
            self.events.into_inner().unwrap()
        }
    }

    impl ProgressSink for CollectingSink {
        fn emit(&self, progress: &RenderProgress) {
            self.events.lock().unwrap().push(progress.clone());
        }
    }

    // ---------------------------------------------------------------
    // R3.2 - three frames produce three progress events with correct
    //        renderId, framesWritten 1..3 and totalFrames, and the
    //        JSON keys are camelCase matching TS MotionRenderProgress.
    // ---------------------------------------------------------------
    #[test]
    fn r3_2_progress_events_emitted() {
        let registry = super::super::state::RenderRegistry::new();
        let fake = FakeChild::new();
        let render = ActiveRender {
            process: fake,
            output_path: std::path::PathBuf::from("/tmp/progress-test.mov"),
            total_frames: 3,
            frames_written: 0,
        };
        registry
            .insert("test-render".to_string(), Box::new(render))
            .unwrap();

        let sink = CollectingSink::new();

        // Send three frames
        for _ in 0..3 {
            write_frame_with_progress(
                &registry,
                "test-render",
                &[0x89, 0x50],
                &sink,
            )
            .unwrap();
        }

        let events = sink.into_events();
        assert_eq!(events.len(), 3, "expected 3 progress events");

        // Verify each event's content
        for (i, event) in events.iter().enumerate() {
            let n = (i + 1) as u32;
            assert_eq!(event.render_id, "test-render");
            assert_eq!(event.frames_written, n);
            assert_eq!(event.total_frames, 3);
        }

        // Verify camelCase JSON serialisation matches TS MotionRenderProgress
        let json = serde_json::to_value(&events[2]).unwrap();
        let obj = json.as_object().unwrap();
        assert!(
            obj.contains_key("renderId"),
            "expected camelCase key 'renderId', got: {:?}",
            obj.keys().collect::<Vec<_>>()
        );
        assert!(
            obj.contains_key("framesWritten"),
            "expected camelCase key 'framesWritten'"
        );
        assert!(
            obj.contains_key("totalFrames"),
            "expected camelCase key 'totalFrames'"
        );
        assert_eq!(obj.len(), 3, "expected exactly 3 keys");
    }
}
