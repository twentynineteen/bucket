//! Managed state holding active render sessions.
//!
//! Only one render may run at a time; a second `motion_render_start` while one
//! is active returns `MotionError { kind: "busy" }`.

use std::collections::HashMap;
use std::sync::Mutex;

use super::commands::MotionError;
use super::encoder::{ActiveRender, ChildProcess};

/// Managed state holding active renders keyed by render ID.
///
/// Uses type-erased trait objects so the state type does not carry the
/// spawner's generic parameter into Tauri managed-state registration.
pub struct RenderRegistry {
    pub active: Mutex<HashMap<String, Box<dyn ActiveRenderDyn + Send>>>,
}

impl RenderRegistry {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if a render is currently active.
    #[allow(dead_code)]
    pub fn is_busy(&self) -> bool {
        // #334: stub
        false
    }

    /// Insert a render. Returns Err(busy) if one is already running.
    pub fn insert(
        &self,
        _id: String,
        _render: Box<dyn ActiveRenderDyn + Send>,
    ) -> Result<(), MotionError> {
        // #334: stub - always succeeds, never checks busy
        Ok(())
    }

    /// Remove and return the render with the given ID.
    pub fn remove(&self, _id: &str) -> Result<Box<dyn ActiveRenderDyn + Send>, MotionError> {
        // #334: stub - always fails
        Err(MotionError {
            kind: "notImplemented".to_string(),
            message: "remove not yet implemented (#334)".to_string(),
        })
    }

    /// Access a render mutably by ID.
    pub fn with_render_mut<F, R>(&self, _id: &str, _f: F) -> Result<R, MotionError>
    where
        F: FnOnce(&mut (dyn ActiveRenderDyn + Send)) -> Result<R, MotionError>,
    {
        // #334: stub
        Err(MotionError {
            kind: "notImplemented".to_string(),
            message: "with_render_mut not yet implemented (#334)".to_string(),
        })
    }

    /// Check whether the given ID is known.
    #[allow(dead_code)]
    pub fn contains(&self, _id: &str) -> bool {
        // #334: stub
        false
    }
}

/// Type-erased trait for an active render, so the state doesn't carry generics.
pub trait ActiveRenderDyn {
    fn write_frame(&mut self, png_data: &[u8]) -> Result<(), MotionError>;
    #[allow(dead_code)]
    fn finish(self: Box<Self>) -> Result<String, MotionError>;
    fn cancel(self: Box<Self>) -> Result<(), MotionError>;
    #[allow(dead_code)]
    fn frames_written(&self) -> u32;
    #[allow(dead_code)]
    fn total_frames(&self) -> u32;
    #[allow(dead_code)]
    fn output_path(&self) -> String;
}

impl<P: ChildProcess> ActiveRenderDyn for ActiveRender<P> {
    fn write_frame(&mut self, png_data: &[u8]) -> Result<(), MotionError> {
        ActiveRender::write_frame(self, png_data)
    }

    fn finish(self: Box<Self>) -> Result<String, MotionError> {
        ActiveRender::finish(*self)
    }

    fn cancel(self: Box<Self>) -> Result<(), MotionError> {
        ActiveRender::cancel(*self)
    }

    fn frames_written(&self) -> u32 {
        self.frames_written
    }

    fn total_frames(&self) -> u32 {
        self.total_frames
    }

    fn output_path(&self) -> String {
        self.output_path.to_string_lossy().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::motion::encoder::tests::FakeChild;

    fn make_render() -> ActiveRender<FakeChild> {
        let fake = FakeChild::new();
        ActiveRender {
            process: fake,
            output_path: std::path::PathBuf::from("/tmp/test.mov"),
            total_frames: 10,
            frames_written: 0,
        }
    }

    // ---------------------------------------------------------------
    // R3.5 - unknown render id
    // ---------------------------------------------------------------
    #[test]
    fn r3_5_unknown_render_id() {
        let registry = RenderRegistry::new();
        match registry.remove("nonexistent") {
            Err(e) => assert_eq!(e.kind, "unknownRender"),
            Ok(_) => panic!("expected unknownRender error"),
        }

        let err = registry
            .with_render_mut("nonexistent", |_r| Ok(()))
            .unwrap_err();
        assert_eq!(err.kind, "unknownRender");
    }

    // ---------------------------------------------------------------
    // R3.6 - busy when render active
    // ---------------------------------------------------------------
    #[test]
    fn r3_6_busy_when_active() {
        let registry = RenderRegistry::new();

        let render1 = make_render();
        registry
            .insert("render-1".to_string(), Box::new(render1))
            .unwrap();

        let render2 = make_render();
        let err = registry
            .insert("render-2".to_string(), Box::new(render2))
            .unwrap_err();
        assert_eq!(err.kind, "busy");

        // Original render should still be there
        assert!(registry.contains("render-1"));
    }

    // ---------------------------------------------------------------
    // R4.2 - late frame after cancel
    // ---------------------------------------------------------------
    #[test]
    fn r4_2_late_frame_after_cancel() {
        let registry = RenderRegistry::new();
        let render = make_render();
        registry
            .insert("render-1".to_string(), Box::new(render))
            .unwrap();

        // Cancel and remove
        let removed = registry.remove("render-1").unwrap();
        removed.cancel().unwrap();

        // Late frame should get unknownRender
        let err = registry
            .with_render_mut("render-1", |r| r.write_frame(&[0x89]))
            .unwrap_err();
        assert_eq!(err.kind, "unknownRender");
    }
}
