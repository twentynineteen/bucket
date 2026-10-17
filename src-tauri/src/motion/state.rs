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
        map.insert(id, render);
        Ok(())
    }

    /// Remove and return the render with the given ID.
    pub fn remove(&self, id: &str) -> Result<Box<dyn ActiveRenderDyn + Send>, MotionError> {
        self.active
            .lock()
            .unwrap()
            .remove(id)
            .ok_or_else(|| MotionError {
                kind: "unknownRender".to_string(),
                message: format!("no active render with id: {}", id),
            })
    }

    /// Access a render mutably by ID.
    pub fn with_render_mut<F, R>(&self, id: &str, f: F) -> Result<R, MotionError>
    where
        F: FnOnce(&mut (dyn ActiveRenderDyn + Send)) -> Result<R, MotionError>,
    {
        let mut map = self.active.lock().unwrap();
        let render = map.get_mut(id).ok_or_else(|| MotionError {
            kind: "unknownRender".to_string(),
            message: format!("no active render with id: {}", id),
        })?;
        f(render.as_mut())
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

        // Original render should still be there (remove succeeds)
        assert!(registry.remove("render-1").is_ok());
    }

    // ---------------------------------------------------------------
    // S9 - cancel must complete while a write is in flight (the
    // registry lock must NOT be held across the blocking stdin write)
    // ---------------------------------------------------------------
    #[test]
    fn s9_cancel_during_write_does_not_deadlock() {
        use std::sync::{Arc, Condvar, Mutex as StdMutex};
        use std::time::Duration;

        // Blocking fake: write_stdin blocks until `unblock` is signalled.
        let pair = Arc::new((StdMutex::new(false), Condvar::new()));
        let pair_write = Arc::clone(&pair);
        // Signal that the write thread is inside write_stdin.
        let entered = Arc::new((StdMutex::new(false), Condvar::new()));
        let entered_write = Arc::clone(&entered);

        // Build a FakeChild whose write_stdin blocks
        let fake = FakeChild::new();

        let registry = Arc::new(RenderRegistry::new());
        let render: ActiveRender<FakeChild> = ActiveRender {
            process: fake,
            output_path: std::path::PathBuf::from("/tmp/s9-test.mov"),
            total_frames: 10,
            frames_written: 0,
        };
        registry
            .insert("s9-render".to_string(), Box::new(render))
            .unwrap();

        // Write thread: holds the registry lock (via with_render_mut)
        // and then blocks inside write_frame until unblocked.
        let reg_write = Arc::clone(&registry);
        let write_thread = std::thread::spawn(move || {
            reg_write.with_render_mut("s9-render", |r| {
                // Signal that we're inside the lock
                {
                    let (lock, cvar) = &*entered_write;
                    let mut started = lock.lock().unwrap();
                    *started = true;
                    cvar.notify_one();
                }
                // Block until unblocked (simulates a slow stdin write)
                {
                    let (lock, cvar) = &*pair_write;
                    let mut unblocked = lock.lock().unwrap();
                    while !*unblocked {
                        unblocked = cvar.wait(unblocked).unwrap();
                    }
                }
                r.write_frame(&[0x89])
            })
        });

        // Wait until the write thread is inside with_render_mut
        {
            let (lock, cvar) = &*entered;
            let mut started = lock.lock().unwrap();
            while !*started {
                started = cvar.wait(started).unwrap();
            }
        }
        // Small sleep to ensure the write thread has acquired the mutex
        std::thread::sleep(Duration::from_millis(10));

        // Try to remove (cancel) from the main thread with a timeout.
        // With the current code, remove() blocks on the registry mutex
        // because the write thread holds it. With the fix, the registry
        // lock is not held during the write, so remove completes fast.
        let reg_cancel = Arc::clone(&registry);
        let cancel_thread = std::thread::spawn(move || reg_cancel.remove("s9-render"));

        // Give cancel 200ms. If it hasn't returned, the lock is held
        // across the write (current code) and the test should fail.
        let cancel_done = Arc::new(StdMutex::new(false));
        let cancel_done_check = Arc::clone(&cancel_done);
        std::thread::sleep(Duration::from_millis(200));
        // Check if cancel_thread has finished
        let finished = cancel_thread.is_finished();

        // Unblock the write thread regardless so the test cleans up
        {
            let (lock, cvar) = &*pair;
            let mut unblocked = lock.lock().unwrap();
            *unblocked = true;
            cvar.notify_one();
        }
        let _ = write_thread.join();
        let _ = cancel_thread.join();

        assert!(
            finished,
            "cancel (remove) must complete while a write is in flight, \
             but it was blocked on the registry mutex for >200ms"
        );
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
