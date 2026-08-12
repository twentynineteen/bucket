//! Watermark analysis against synthetic fixtures (issue #180, stage 2).
//!
//! Everything here decodes a real video, so everything here needs ffmpeg. The
//! fixtures are **generated in the test** and nothing is committed: the repository
//! is public, and a 20-second fixture takes 0.2s to build against a 30-second
//! suite budget. Real brand assets and real renders are for manual verification
//! only and never appear in a committed test.
//!
//! Every test skips cleanly when ffmpeg is absent, so the suite stays green on a
//! machine without it.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};
use tokio::sync::watch;

use super::discovery::{probe_binary_path, resolve_ffmpeg_tools, FfmpegAvailability};
use super::error::QcError;
use super::ffmpeg::{run_frames, RunError};
use super::geometry::Corner;
use super::watermark::{analyse, AnalysisRequest, Phase, WatermarkOutcome, WatermarkReport};

/// The toolchain, or `None` when this machine has no ffmpeg.
fn tools() -> Option<(String, String)> {
    match resolve_ffmpeg_tools(None, probe_binary_path) {
        FfmpegAvailability::Ready { ffmpeg, ffprobe } => Some((ffmpeg, ffprobe)),
        _ => None,
    }
}

/// Skips the test body when ffmpeg is not installed.
macro_rules! require_ffmpeg {
    () => {
        match tools() {
            Some(tools) => tools,
            None => {
                eprintln!("skipping: ffmpeg is not installed on this machine");
                return;
            }
        }
    };
}

const FRAME_WIDTH: u32 = 640;
const FRAME_HEIGHT: u32 = 360;
const MARK: u32 = 64;

/// Builds an RGBA reference canvas shaped like the real brand assets.
///
/// The real assets are a **single flat colour** plus a structured, partly
/// transparent alpha map: the Black variant is luma 0 everywhere and the White
/// variant luma 255 everywhere, and both carry the same alpha map peaking at 137 of
/// 255. So the structure lives entirely in alpha, and these fixtures put it there
/// too — a reference whose alpha is a plain filled square would let the matcher pass
/// on a template it will never see in practice.
///
/// `drawbox` does not touch the alpha plane, so the colour and the mask are drawn
/// separately and combined with `alphamerge`.
fn make_reference(ffmpeg: &str, dir: &Path, name: &str, x: u32, colour: &str) -> PathBuf {
    let path = dir.join(name);
    let y = 20;

    // 0x89 is 137, the peak alpha measured on the real assets: the mark is never
    // more than 54% opaque, so the backdrop always shows through it.
    let graph = format!(
        "[0:v]format=gbrp[mark];\
[1:v]drawbox=x={x}:y={y}:w={MARK}:h={MARK}:color=0x898989:t=fill,\
drawbox=x={inner_x}:y={inner_y}:w={inner}:h={inner}:color=black:t=fill,\
drawbox=x={dot_x}:y={dot_y}:w={dot}:h={dot}:color=0x898989:t=fill,format=gray[mask];\
[mark][mask]alphamerge,format=rgba[out]",
        inner_x = x + 12,
        inner_y = y + 12,
        inner = MARK - 24,
        dot_x = x + 24,
        dot_y = y + 24,
        dot = MARK - 48,
    );

    let status = Command::new(ffmpeg)
        .args([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            &format!("color=c={colour}:s={FRAME_WIDTH}x{FRAME_HEIGHT}:d=1"),
            "-f",
            "lavfi",
            "-i",
            &format!("color=c=black:s={FRAME_WIDTH}x{FRAME_HEIGHT}:d=1"),
            "-filter_complex",
            &graph,
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-y",
        ])
        .arg(&path)
        .status()
        .expect("ffmpeg should run");

    assert!(status.success(), "building the reference failed");
    path
}

/// The Black variant, which is what most fixtures need.
fn make_black_reference(ffmpeg: &str, dir: &Path, name: &str, x: u32) -> PathBuf {
    make_reference(ffmpeg, dir, name, x, "black")
}

/// Renders a fixture with the given watermark overlays.
///
/// Each overlay is a reference PNG plus an `enable` expression saying when it is
/// visible, which is how absence, gaps and a mid-video corner change are all
/// expressed with the same helper.
fn make_fixture(
    ffmpeg: &str,
    dir: &Path,
    name: &str,
    seconds: u32,
    overlays: &[(&PathBuf, &str)],
) -> PathBuf {
    let path = dir.join(name);

    let mut args: Vec<String> = vec![
        "-v".into(),
        "error".into(),
        "-f".into(),
        "lavfi".into(),
        "-i".into(),
        format!("testsrc=size={FRAME_WIDTH}x{FRAME_HEIGHT}:rate=10:duration={seconds}"),
    ];

    for (reference, _) in overlays {
        args.push("-i".into());
        args.push(reference.to_string_lossy().to_string());
    }

    let mut graph = String::new();
    let mut label = "0:v".to_string();
    for (index, (_, enable)) in overlays.iter().enumerate() {
        let output = format!("v{}", index);
        graph.push_str(&format!(
            "[{label}][{}:v]overlay=0:0:enable='{enable}'[{output}];",
            index + 1
        ));
        label = output;
    }

    if graph.is_empty() {
        graph = "[0:v]null[out]".to_string();
    } else {
        graph.pop();
        graph.push_str(&format!(";[{label}]null[out]"));
    }

    args.extend([
        "-filter_complex".into(),
        graph,
        "-map".into(),
        "[out]".into(),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "ultrafast".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-y".into(),
        path.to_string_lossy().to_string(),
    ]);

    let output = Command::new(ffmpeg)
        .args(&args)
        .output()
        .expect("ffmpeg should run");

    assert!(
        output.status.success(),
        "building the fixture failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    path
}

/// Runs the analysis, discarding progress.
fn run(
    ffmpeg: &str,
    ffprobe: &str,
    video: &Path,
    references: &[&PathBuf],
) -> Result<WatermarkReport, QcError> {
    let (_tx, cancel) = watch::channel(false);

    analyse(
        &AnalysisRequest {
            video_path: video.to_string_lossy().to_string(),
            ffmpeg: ffmpeg.to_string(),
            ffprobe: ffprobe.to_string(),
            reference_files: references
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect(),
            match_threshold: None,
            dip_start_seconds: None,
        },
        &cancel,
        &mut |_, _, _| {},
    )
}

#[test]
fn b3_1_and_b4_1_passes_a_render_carrying_the_watermark_throughout() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    let video = make_fixture(&ffmpeg, dir.path(), "present.mp4", 30, &[(&right, "1")]);

    let report = run(&ffmpeg, &ffprobe, &video, &[&right]).expect("the run should complete");

    assert_eq!(report.outcome, WatermarkOutcome::Pass, "{:?}", report);
    assert_eq!(report.corner, Some(Corner::TopRight));
    assert_eq!(report.gaps, vec![], "a clean render has no gaps");
    assert_eq!(report.matched_reference.as_deref(), Some("right.png"));
    assert!(
        report.best_confidence >= report.threshold,
        "confidence {} should clear the threshold {}",
        report.best_confidence,
        report.threshold
    );
}

#[test]
fn b10_1_and_b10_4_writes_nothing_to_disk_and_keeps_evidence_in_memory() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    // Absent for the whole run, so the report is as evidence-heavy as it gets.
    let video = make_fixture(&ffmpeg, dir.path(), "absent.mp4", 30, &[]);

    let before = listing(dir.path());
    let report = run(&ffmpeg, &ffprobe, &video, &[&right]).expect("the run should complete");

    assert_eq!(report.outcome, WatermarkOutcome::Fail);
    assert!(
        !report.thumbnails.is_empty(),
        "a failure has to come with evidence"
    );
    assert!(
        report.thumbnails.len() <= super::thresholds::MAX_THUMBNAILS,
        "retained thumbnails must be capped, got {}",
        report.thumbnails.len()
    );
    assert!(
        report
            .thumbnails
            .iter()
            .all(|t| t.jpeg.starts_with(&[0xff, 0xd8])),
        "thumbnails should be JPEG bytes held in memory"
    );
    assert_eq!(
        listing(dir.path()),
        before,
        "a run must write nothing to disk of its own accord"
    );
}

#[test]
fn b3_3_fails_a_render_with_no_watermark_in_either_corner() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    let left = make_black_reference(&ffmpeg, dir.path(), "left.png", 20);
    let video = make_fixture(&ffmpeg, dir.path(), "none.mp4", 30, &[]);

    let report = run(&ffmpeg, &ffprobe, &video, &[&right, &left]).expect("the run completes");

    assert_eq!(report.outcome, WatermarkOutcome::Fail);
    assert_eq!(report.corner, None);
    assert_eq!(report.matched_samples, 0);
    assert_eq!(
        report.gaps.len(),
        1,
        "one gap covering the span, not one per sample: {:?}",
        report.gaps
    );

    // The score is reported even when nothing matched. On real footage this is how a
    // wrong-resolution watermark is told apart from no watermark at all: one comes
    // close, the other does not.
    assert!(
        report.best_reference.is_some(),
        "the closest reference must be named even on a total failure"
    );
    assert!(
        report.gaps[0].best_reference.is_some(),
        "a gap must name what came closest inside it"
    );
    assert!(
        report.best_confidence >= report.weakest_confidence,
        "best {} cannot be below weakest {}",
        report.best_confidence,
        report.weakest_confidence
    );
}

#[test]
fn b4_2_reports_a_mid_video_gap_as_a_measured_time_range() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    // 40s, so the approximated span is [0, 28) and coarse samples land at 0, 10 and
    // 20. The absence runs 6s to 17s: longer than the coarse interval, so a coarse
    // sample is certain to fall inside it. An absence shorter than the interval can
    // hide between samples, which is a documented property of coarse sampling
    // rather than something this test should pretend away.
    let video = make_fixture(
        &ffmpeg,
        dir.path(),
        "gapped.mp4",
        40,
        &[(&right, "not(between(t,6,17))")],
    );

    let report = run(&ffmpeg, &ffprobe, &video, &[&right]).expect("the run completes");

    assert_eq!(report.outcome, WatermarkOutcome::Fail);
    assert_eq!(report.gaps.len(), 1, "got {:?}", report.gaps);

    let gap = &report.gaps[0];
    assert!(
        gap.end_seconds > gap.start_seconds,
        "a gap is a range, not one timestamp: {:?}",
        gap
    );
    assert!(
        gap.start_seconds >= 5.0 && gap.start_seconds <= 7.0,
        "the gap should start at the real absence, got {:?}",
        gap
    );
    assert!(
        gap.end_seconds >= 16.0 && gap.end_seconds <= 18.0,
        "the gap should end at the real absence rather than at the window edge, got {:?}",
        gap
    );
    assert!(
        report.span.approximated,
        "stage 2 has no dip detection, so the span end is an assumption and must say so"
    );
}

#[test]
fn b3_7_fails_naming_the_corner_change_and_when_it_happened() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    // The pool holds the Black variants; the render's left-corner mark is the White
    // one. They carry the same alpha map, so matching is colour-agnostic and this
    // must still be read as a corner change rather than as a missing watermark.
    // The White variant is used deliberately: `testsrc`'s top-left corner is pure
    // black, and a black mark at 54% opacity over black footage is genuinely
    // invisible — a real physical limit of a semi-transparent overlay, not something
    // the matcher can recover.
    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    let left = make_black_reference(&ffmpeg, dir.path(), "left.png", 20);
    let left_white = make_reference(&ffmpeg, dir.path(), "left-white.png", 20, "white");

    // 60s so the approximated span is [0, 48) and coarse samples land either side
    // of the switch at 25s.
    let video = make_fixture(
        &ffmpeg,
        dir.path(),
        "moved.mp4",
        60,
        &[(&right, "lt(t,25)"), (&left_white, "gte(t,25)")],
    );

    let report = run(&ffmpeg, &ffprobe, &video, &[&right, &left]).expect("the run completes");

    assert_eq!(report.outcome, WatermarkOutcome::Fail, "{:?}", report);
    assert_eq!(
        report.corner,
        Some(Corner::TopRight),
        "the earliest samples establish the corner"
    );
    assert!(
        !report.corner_changes.is_empty(),
        "the change has to be reported"
    );

    let change = report.corner_changes[0];
    assert_eq!(change.expected, Corner::TopRight);
    assert_eq!(change.found, Corner::TopLeft);
    assert!(
        change.at_seconds >= 25.0,
        "the timestamp must be when the mark moved, got {}",
        change.at_seconds
    );
}

#[test]
fn b11_1_reports_phases_with_a_percentage_that_never_goes_backwards() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    let video = make_fixture(
        &ffmpeg,
        dir.path(),
        "progress.mp4",
        40,
        &[(&right, "not(between(t,6,17))")],
    );

    let (_tx, cancel) = watch::channel(false);
    let mut seen: Vec<(Phase, f64)> = Vec::new();

    analyse(
        &AnalysisRequest {
            video_path: video.to_string_lossy().to_string(),
            ffmpeg: ffmpeg.clone(),
            ffprobe: ffprobe.clone(),
            reference_files: vec![right.to_string_lossy().to_string()],
            match_threshold: None,
            dip_start_seconds: None,
        },
        &cancel,
        &mut |phase, percentage, _| seen.push((phase, percentage)),
    )
    .expect("the run completes");

    assert!(seen.iter().any(|(phase, _)| *phase == Phase::Probe));
    assert!(seen.iter().any(|(phase, _)| *phase == Phase::Watermark));
    assert!(
        seen.iter().any(|(phase, _)| *phase == Phase::Refine),
        "a gapped render refines, so the refine phase must be reported"
    );
    assert!(
        seen.windows(2).all(|pair| pair[1].1 >= pair[0].1),
        "progress went backwards: {:?}",
        seen
    );
    assert_eq!(seen.last().map(|(_, p)| *p), Some(100.0));
}

#[test]
fn b12_1_reports_a_file_with_no_video_stream_rather_than_analysing_it() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let dir = tempfile::tempdir().unwrap();

    let right = make_black_reference(&ffmpeg, dir.path(), "right.png", FRAME_WIDTH - MARK - 20);
    let audio = dir.path().join("audio-only.m4a");
    let status = Command::new(&ffmpeg)
        .args([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=mono:d=2",
            "-c:a",
            "aac",
            "-y",
        ])
        .arg(&audio)
        .status()
        .expect("ffmpeg should run");
    assert!(status.success());

    let result = run(&ffmpeg, &ffprobe, &audio, &[&right]);

    match result {
        Err(QcError::Probe { message }) => {
            assert!(message.contains("no video stream"), "got {}", message)
        }
        other => panic!("expected a probe error, got {:?}", other),
    }
}

#[test]
fn b13_3_refuses_an_out_of_range_threshold_before_spawning_anything() {
    let (ffmpeg, ffprobe) = require_ffmpeg!();
    let (_tx, cancel) = watch::channel(false);

    let result = analyse(
        &AnalysisRequest {
            // Deliberately not a real file: validation must happen first, so this
            // never gets as far as being opened.
            video_path: "/definitely/not/a/real/render.mp4".to_string(),
            ffmpeg,
            ffprobe,
            reference_files: vec![],
            match_threshold: Some(4.2),
            dip_start_seconds: None,
        },
        &cancel,
        &mut |_, _, _| {},
    );

    match result {
        Err(QcError::Threshold { message }) => assert!(message.contains("4.2"), "got {}", message),
        other => panic!("expected a threshold rejection, got {:?}", other),
    }
}

#[test]
fn b11_2_kills_the_child_on_cancellation_and_leaves_no_orphan() {
    let (ffmpeg, _) = require_ffmpeg!();

    // A synthetic source long enough that the run is certainly still going when it
    // is cancelled. The unusual frame size is what identifies this particular child
    // in `ps` afterwards: it appears verbatim on the command line and nothing else
    // on the machine will be using it.
    const MARKER_SIZE: &str = "1281x721";
    let args: Vec<String> = vec![
        "-v".into(),
        "error".into(),
        "-f".into(),
        "lavfi".into(),
        "-i".into(),
        format!("testsrc=size={MARKER_SIZE}:rate=30:duration=600"),
        "-f".into(),
        "rawvideo".into(),
        "-".into(),
    ];

    let (tx, cancel) = watch::channel(false);
    let cancel_for_run = cancel.clone();
    let ffmpeg_for_run = ffmpeg.clone();

    let handle = std::thread::spawn(move || {
        run_frames(
            &ffmpeg_for_run,
            &args,
            1281 * 721,
            &cancel_for_run,
            |_, _| {},
        )
    });

    std::thread::sleep(Duration::from_millis(400));
    tx.send(true).unwrap();

    let started = Instant::now();
    let result = handle.join().expect("the runner thread should not panic");

    assert!(
        matches!(result, Err(RunError::Cancelled)),
        "expected a cancellation, got {:?}",
        result
    );
    assert!(
        started.elapsed() < Duration::from_secs(5),
        "cancellation should return promptly, took {:?}",
        started.elapsed()
    );

    // The child is killed and reaped by the runner, so nothing using the marker
    // frame size should still be running.
    let survivors = Command::new("/bin/ps")
        .args(["-Ao", "command"])
        .output()
        .map(|out| {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|line| line.contains(MARKER_SIZE) && line.contains("testsrc"))
                .count()
        })
        .unwrap_or(0);

    assert_eq!(survivors, 0, "an ffmpeg child outlived its cancellation");
}

/// Sorted names of everything in a directory, for asserting nothing was written.
fn listing(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .expect("the fixture directory should be readable")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();
    names.sort();
    names
}
