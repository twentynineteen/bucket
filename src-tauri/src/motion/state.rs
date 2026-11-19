//! Managed state holding active render sessions.
//!
//! Only one render may run at a time; a second `motion_render_start` while one
//! is active returns `MotionError { kind: "busy" }`.
//!
//! S9 fix: the registry lock is never held across blocking I/O. Each render
//! lives in a `RenderSlot` whose `render` field is `Option` - taken out during
//! a frame write and returned afterwards. Cancel can proceed immediately by
//! setting `cancel_requested` on the slot; the writer checks this on return.

use std::collections::HashMap;
use std::sync::Mutex;

use super::commands::MotionError;
use super::encoder::{ActiveRender, ChildProcess};

/// A slot in the registry. While a frame write is in progress, `render` is
/// `None` and the slot stays in the map so cancel can set the flag.
struct RenderSlot {
    render: Option<Box<dyn ActiveRenderDyn + Send>>,
    cancel_requested: bool,
}

/// Result of a successful frame write.
#[derive(Debug)]
pub struct WriteFrameResult {
    pub frames_written: u32,
    pub total_frames: u32,
}

/// Managed state holding active renders keyed by render ID.
///
/// Uses type-erased trait objects so the state type does not carry the
/// spawner's generic parameter into Tauri managed-state registration.
pub struct RenderRegistry {
    active: Mutex<HashMap<String, RenderSlot>>,
}

impl RenderRegistry {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }

    /// Insert a render. Returns Err(busy) if one is already running.
    pub fn insert(
        &self,
        id: String,
        render: Box<dyn ActiveRenderDyn + Send>,
    ) -> Result<(), MotionError> {
        let mut map = self.active.lock().unwrap();
        if !map.is_empty() {
            return Err(MotionError {
                kind: "busy".to_string(),
                message: "a render is already in progress".to_string(),
            });
        }
        map.insert(
            id,
            RenderSlot {
                render: Some(render),
                cancel_requested: false,
            },
        );
        Ok(())
    }

    /// Remove and return the render with the given ID.
    ///
    /// Used by `motion_render_finish`. Fails if the render is currently out
    /// for a frame write or does not exist.
    pub fn remove(&self, id: &str) -> Result<Box<dyn ActiveRenderDyn + Send>, MotionError> {
        let mut map = self.active.lock().unwrap();
        let slot = map.get_mut(id).ok_or_else(|| MotionError {
            kind: "unknownRender".to_string(),
            message: format!("no active render with id: {}", id),
        })?;
        match slot.render.take() {
            Some(render) => {
                map.remove(id);
                Ok(render)
            }
            None => Err(MotionError {
                kind: "busy".to_string(),
                message: "frame write in progress, cannot remove".to_string(),
            }),
        }
    }

    /// Request cancellation of a render.
    ///
    /// If the render is available (not mid-write), takes it out and returns
    /// it for the caller to cancel directly. If the render is out for a
    /// frame write, sets `cancel_requested` and returns `None` - the write
    /// thread will cancel the render when it returns.
    pub fn cancel_render(
        &self,
        id: &str,
    ) -> Result<Option<Box<dyn ActiveRenderDyn + Send>>, MotionError> {
        let mut map = self.active.lock().unwrap();
        let slot = map.get_mut(id).ok_or_else(|| MotionError {
            kind: "unknownRender".to_string(),
            message: format!("no active render with id: {}", id),
        })?;
        if let Some(render) = slot.render.take() {
            map.remove(id);
            Ok(Some(render))
        } else {
            // Render is out for a write - set cancel flag
            slot.cancel_requested = true;
            Ok(None)
        }
    }

    /// Write a frame without holding the registry lock during I/O.
    ///
    /// Takes the render out under the lock, performs the write outside the
    /// lock, then returns the render. If cancel was requested while the write
    /// was in flight, cancels the render and returns a cancelled error.
    pub fn write_frame(&self, id: &str, png_data: &[u8]) -> Result<WriteFrameResult, MotionError> {
        // 1. Take the render out under the lock
        let mut render = {
            let mut map = self.active.lock().unwrap();
            let slot = map.get_mut(id).ok_or_else(|| MotionError {
                kind: "unknownRender".to_string(),
                message: format!("no active render with id: {}", id),
            })?;
            slot.render.take().ok_or_else(|| MotionError {
                kind: "busy".to_string(),
                message: "frame write already in progress".to_string(),
            })?
        };
        // Lock released here

        // 2. Write the frame (blocking I/O, no lock held)
        let result = render.write_frame(png_data);

        // 3. Re-acquire lock and return the render or handle cancel/error
        let mut map = self.active.lock().unwrap();
        match result {
            Ok(()) => {
                let info = WriteFrameResult {
                    frames_written: render.frames_written(),
                    total_frames: render.total_frames(),
                };
                if let Some(slot) = map.get_mut(id) {
                    if slot.cancel_requested {
                        map.remove(id);
                        let _ = render.cancel();
                        return Err(MotionError {
                            kind: "cancelled".to_string(),
                            message: "render cancelled during frame write".to_string(),
                        });
                    }
                    slot.render = Some(render);
                } else {
                    // Slot was removed (shouldn't happen, but handle gracefully)
                    let _ = render.cancel();
                }
                Ok(info)
            }
            Err(e) => {
                // Write failed - remove the slot entirely
                map.remove(id);
                Err(e)
            }
        }
    }
}

/// Type-erased trait for an active render, so the state doesn't carry generics.
pub trait ActiveRenderDyn {
    fn write_frame(&mut self, png_data: &[u8]) -> Result<(), MotionError>;
    fn finish(self: Box<Self>) -> Result<String, MotionError>;
    fn cancel(self: Box<Self>) -> Result<(), MotionError>;
    fn frames_written(&self) -> u32;
    fn total_frames(&self) -> u32;
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::motion::encoder::tests::FakeChild;
    use std::sync::{Arc, Condvar};
    use std::time::Duration;

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

        let err = registry.write_frame("nonexistent", &[0x89]).unwrap_err();
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

        // Original render should still be there (remove succeeds)
        assert!(registry.remove("render-1").is_ok());
    }

    // ---------------------------------------------------------------
    // S9 - cancel must complete while a write is in flight (the
    // registry lock must NOT be held across the blocking stdin write)
    // ---------------------------------------------------------------
    /// A render whose `write_frame` signals `entered`, then blocks until
    /// `unblock` is set - a stand-in for a slow stdin write to ffmpeg.
    struct BlockingRender {
        entered: Arc<(Mutex<bool>, Condvar)>,
        unblock: Arc<(Mutex<bool>, Condvar)>,
    }

    impl ActiveRenderDyn for BlockingRender {
        fn write_frame(&mut self, _png_data: &[u8]) -> Result<(), MotionError> {
            set_and_notify(&self.entered);
            let (lock, cvar) = &*self.unblock;
            let mut unblocked = lock.lock().unwrap();
            while !*unblocked {
                unblocked = cvar.wait(unblocked).unwrap();
            }
            Ok(())
        }
        fn finish(self: Box<Self>) -> Result<String, MotionError> {
            Ok(String::new())
        }
        fn cancel(self: Box<Self>) -> Result<(), MotionError> {
            Ok(())
        }
        fn frames_written(&self) -> u32 {
            0
        }
        fn total_frames(&self) -> u32 {
            10
        }
    }

    fn set_and_notify(pair: &(Mutex<bool>, Condvar)) {
        let (lock, cvar) = pair;
        *lock.lock().unwrap() = true;
        cvar.notify_one();
    }

    #[test]
    fn s9_cancel_during_write_does_not_deadlock() {
        let entered = Arc::new((Mutex::new(false), Condvar::new()));
        let unblock = Arc::new((Mutex::new(false), Condvar::new()));

        let registry = Arc::new(RenderRegistry::new());
        registry
            .insert(
                "s9-render".to_string(),
                Box::new(BlockingRender {
                    entered: Arc::clone(&entered),
                    unblock: Arc::clone(&unblock),
                }),
            )
            .unwrap();

        // Write thread: goes through the production write_frame, which
        // blocks inside the render's write.
        let reg_write = Arc::clone(&registry);
        let write_thread = std::thread::spawn(move || reg_write.write_frame("s9-render", &[0x89]));

        // Wait until the write thread is inside the render's write
        {
            let (lock, cvar) = &*entered;
            let mut started = lock.lock().unwrap();
            while !*started {
                started = cvar.wait(started).unwrap();
            }
        }

        // Cancel from another thread. With the lock not held during the
        // write, cancel_render acquires the lock immediately, sets
        // cancel_requested, and returns.
        let reg_cancel = Arc::clone(&registry);
        let cancel_thread = std::thread::spawn(move || reg_cancel.cancel_render("s9-render"));

        // Give cancel 200ms. With the fix it returns in microseconds.
        std::thread::sleep(Duration::from_millis(200));
        let finished = cancel_thread.is_finished();

        // Unblock the write so the test cleans up
        set_and_notify(&unblock);
        let write_result = write_thread.join().unwrap();
        let _ = cancel_thread.join();

        assert!(
            finished,
            "cancel_render must complete while a write is in flight, \
             but it was blocked on the registry mutex for >200ms"
        );
        // The cancel requested mid-write is honoured once the write returns.
        assert_eq!(write_result.unwrap_err().kind, "cancelled");
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
        let err = registry.write_frame("render-1", &[0x89]).unwrap_err();
        assert_eq!(err.kind, "unknownRender");
    }
}
