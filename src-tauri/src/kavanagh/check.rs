//! One whole run: probe, tail, sting, watermark, verdict (D9).
//!
//! The order is forced by a circular dependency and is the reason this module
//! exists rather than the work living in `watermark`. The watermark is not
//! expected over the closing dip - checking it there reports a gap on every
//! correct render - but the dip is found by the tail analysis. So the tail runs
//! first and hands the watermark pass the point to stop at.
//!
//! When no dip is found, both problems are reported rather than one hiding the
//! other: the watermark span falls back to a fixed window and the report says
//! it was approximated (B5.10). An operator should learn everything wrong with
//! a render in one run, not fix one fault to discover the next.

use serde::Serialize;
use tokio::sync::watch;

use super::error::KavanaghError;
use super::ffmpeg::{run_capture, run_frames};
use super::parsing::{parse_signalstats, LumaSample, VideoProbe};
use super::sting::{assess, default_threshold, StingOutcome, StingReference, StingReport};
use super::tail::{analyse_tail, TailAnalysis};
use super::thresholds::{
    resolve_match_confidence, STING_COMPARISON_HEIGHT, STING_COMPARISON_WIDTH, STING_SAMPLE_FPS,
    STING_SETTLED_OFFSET_SECONDS, TAIL_WINDOW_SECONDS,
};
use super::verdict::{overall, Verdict};
use super::watermark::{
    analyse_with_probe, probe_video, AnalysisRequest, Phase, WatermarkReport,
};

/// Everything one run concluded, with each check's own result intact (B7.2).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReport {
    pub verdict: Verdict,
    pub watermark: WatermarkReport,
    pub tail: TailAnalysis,
    /// `None` when no white peak was found, so no sting could be located.
    pub sting: Option<StingReport>,
    /// One sentence per fault, ready to render.
    ///
    /// Written here rather than in the frontend because every one of them
    /// carries a measurement - "the dip to white takes 0.25s, expected 0.40s
    /// (0.32-0.48s)" - and the numbers, their formatting and the tolerances
    /// they are quoted against all live on this side. Duplicating that in
    /// TypeScript would be two places to keep in step for no gain.
    pub problem_messages: Vec<String>,
    /// Caveats about the run as a whole, as opposed to either check.
    pub notes: Vec<String>,
}

/// Runs both checks over one video and reduces them to a verdict.
pub fn run_check(
    request: &AnalysisRequest,
    cancel: &watch::Receiver<bool>,
    progress: &mut dyn FnMut(Phase, f64, &str),
) -> Result<CheckReport, KavanaghError> {
    // First, before any process is spawned, for the same reason as in
    // `watermark::analyse`: a rejected threshold must not arrive disguised as a
    // file error (B13.3).
    resolve_match_confidence(request.match_threshold)
        .map_err(|message| KavanaghError::Threshold { message })?;

    progress(Phase::Probe, 2.0, "Reading the video");
    let probe = probe_video(request, cancel)?;

    progress(Phase::Tail, 6.0, "Checking the closing transition");
    let samples = tail_luma(request, &probe, cancel)?;
    let tail = analyse_tail(&samples, probe.end_seconds(), probe.duration_seconds);

    let sting = match tail.peak_at_seconds {
        Some(peak_at) => {
            progress(Phase::Tail, 14.0, "Checking the closing sting");
            let frames = sting_frames(request, peak_at, cancel)?;
            let references = prepare_sting_references(request, cancel);
            Some(assess(&frames, &references, default_threshold()))
        }
        None => None,
    };

    let mut notes = Vec::new();
    if tail.peak_at_seconds.is_none() {
        notes.push(format!(
            "No dip to white was found, so the watermark was checked over the first {:.0}s less the closing {:.0}s rather than up to a measured dip. The span is approximate.",
            probe.duration_seconds, TAIL_WINDOW_SECONDS
        ));
    }

    // The watermark pass starts where the dip does, so it is not asked to find a
    // mark that is already dissolving (B4.6).
    let watermark_request = AnalysisRequest {
        dip_start_seconds: tail.dip_start_seconds(),
        ..request.clone()
    };

    let watermark = analyse_with_probe(&watermark_request, &probe, cancel, progress)?;
    let verdict = overall(watermark.outcome, &tail, sting.as_ref());

    // Both checks contribute, whichever one decided the verdict (B7.2).
    let mut problem_messages: Vec<String> =
        tail.problems.iter().map(|problem| problem.message()).collect();
    if let Some(report) = sting.as_ref() {
        if report.outcome != StingOutcome::Matched {
            problem_messages.push(report.message());
        }
    }

    Ok(CheckReport {
        verdict,
        watermark,
        tail,
        sting,
        problem_messages,
        notes,
    })
}

/// Streams per-frame luma statistics over the closing window.
///
/// `-copyts` is load-bearing: with a plain `-ss` the printed `pts_time` restarts
/// at zero from the seek point, and every structural measurement is made
/// against absolute time. Verified against real output rather than assumed.
fn tail_luma(
    request: &AnalysisRequest,
    probe: &VideoProbe,
    cancel: &watch::Receiver<bool>,
) -> Result<Vec<LumaSample>, KavanaghError> {
    let start = (probe.end_seconds() - TAIL_WINDOW_SECONDS).max(0.0);

    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-copyts".to_string(),
        "-ss".to_string(),
        format!("{:.3}", start),
        "-i".to_string(),
        request.video_path.clone(),
        "-vf".to_string(),
        "signalstats,metadata=print:file=-".to_string(),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ];

    let (stdout, run) = run_capture(&request.ffmpeg, &args, cancel).map_err(super::watermark::run_error)?;

    if !run.exit_ok {
        return Err(KavanaghError::Ffmpeg {
            message: "ffmpeg could not read the closing section of this video.".to_string(),
            stderr: run.stderr_tail,
        });
    }

    Ok(parse_signalstats(&String::from_utf8_lossy(&stdout)))
}

/// Extracts the settled sting frames, greyscale at the comparison size.
///
/// Sampling starts half a second after the peak because the still's opening
/// half second is underneath the fade from white; matching there would compare
/// a part-white frame against the reference JPG (A6).
fn sting_frames(
    request: &AnalysisRequest,
    peak_at: f64,
    cancel: &watch::Receiver<bool>,
) -> Result<Vec<Vec<u8>>, KavanaghError> {
    let from = peak_at + STING_SETTLED_OFFSET_SECONDS;
    let frame_size = (STING_COMPARISON_WIDTH * STING_COMPARISON_HEIGHT) as usize;

    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-ss".to_string(),
        format!("{:.3}", from),
        "-i".to_string(),
        request.video_path.clone(),
        "-vf".to_string(),
        format!(
            "fps={},scale={}:{},format=gray",
            STING_SAMPLE_FPS, STING_COMPARISON_WIDTH, STING_COMPARISON_HEIGHT
        ),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-pix_fmt".to_string(),
        "gray".to_string(),
        "-".to_string(),
    ];

    let mut frames: Vec<Vec<u8>> = Vec::new();
    let run = run_frames(&request.ffmpeg, &args, frame_size, cancel, |_, frame| {
        frames.push(frame.to_vec());
    })
    .map_err(super::watermark::run_error)?;

    if !run.exit_ok && frames.is_empty() {
        return Err(KavanaghError::Ffmpeg {
            message: "ffmpeg could not read the closing sting from this video.".to_string(),
            stderr: run.stderr_tail,
        });
    }

    Ok(frames)
}

/// Decodes every sting reference to greyscale at the comparison size.
///
/// A reference that cannot be read is skipped rather than failing the run, as
/// in the watermark pool: one corrupt file in a folder should not make the
/// whole check unavailable. An empty result is reported as an unavailable pool
/// by the sting check itself (B6.4), which is why this returns no error.
fn prepare_sting_references(
    request: &AnalysisRequest,
    cancel: &watch::Receiver<bool>,
) -> Vec<StingReference> {
    let expected = (STING_COMPARISON_WIDTH * STING_COMPARISON_HEIGHT) as usize;
    let mut references = Vec::new();

    for path in &request.sting_reference_files {
        let args = vec![
            "-v".to_string(),
            "error".to_string(),
            "-i".to_string(),
            path.clone(),
            "-vf".to_string(),
            format!(
                "scale={}:{},format=gray",
                STING_COMPARISON_WIDTH, STING_COMPARISON_HEIGHT
            ),
            "-frames:v".to_string(),
            "1".to_string(),
            "-f".to_string(),
            "rawvideo".to_string(),
            "-pix_fmt".to_string(),
            "gray".to_string(),
            "-".to_string(),
        ];

        let Ok((pixels, run)) = run_capture(&request.ffmpeg, &args, cancel) else {
            continue;
        };

        if !run.exit_ok || pixels.len() < expected {
            continue;
        }

        references.push(StingReference {
            path: path.clone(),
            pixels,
        });
    }

    references
}

