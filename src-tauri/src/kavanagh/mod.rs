//! Kavanagh: video quality control (issue #180).
//!
//! Two defects recur in renders and are only caught by a human scrubbing the
//! timeline: a missing or partly missing corner watermark, and a wrong closing
//! transition. This module is the native half of checking both.
//!
//! Stage 1 (`discovery`) finds the ffmpeg toolchain. Stage 2 (everything else
//! here) checks the watermark. The tail and sting analysis of stage 3 slots in
//! beside `watermark`, sharing `ffmpeg`, `parsing` and `thresholds`.
//!
//! `discovery` lived at `kavanagh/discovery.rs` in stage 1 and moved here when the
//! feature outgrew one file, following the precedent of `baker/` and
//! `build_project/` rather than accumulating a second `kavanagh_*.rs` beside it.

pub mod check;
pub mod commands;
pub mod discovery;
pub mod error;
pub mod evidence;
pub mod ffmpeg;
pub mod geometry;
pub mod matching;
pub mod parsing;
pub mod sampling;
pub mod sting;
pub mod tail;
pub mod thresholds;
pub mod verdict;
pub mod watermark;

#[cfg(test)]
mod integration_tests;

pub use commands::{
    kavanagh_cancel_run, kavanagh_run_check, kavanagh_run_watermark_check, kavanagh_save_evidence,
    KavanaghRunState,
};
pub use discovery::kavanagh_detect_ffmpeg;
