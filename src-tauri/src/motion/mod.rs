//! Motion Marketplace: reusable motion graphics templates (issue #326).
//!
//! This module owns the video render pipeline. The four commands accept PNG
//! frames from the frontend and pipe them into ffmpeg to produce a ProRes 4444
//! `.mov` with alpha. The frontend drives the frame loop; Rust owns the
//! process lifecycle.
//!
//! Stubs created by #327 (Foundation); #334 replaces the bodies.

pub mod commands;

pub use commands::{
    motion_render_cancel, motion_render_finish, motion_render_frame, motion_render_start,
    MotionRenderState,
};
