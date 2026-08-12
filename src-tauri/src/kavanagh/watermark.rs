//! Watermark analysis: one coarse decode pass, then targeted refinement
//! (issue #180, stage 2, B3, B4).
//!
//! ## Why the corners are hstacked
//!
//! The obvious design - crop both top corners and pipe each as its own rawvideo
//! output - does not work and does not fail either. ffmpeg accepts
//! `-map '[tl]' -f rawvideo - -map '[tr]' -f rawvideo -` and emits an
//! interleaved, unparseable byte stream. Verified. So the two crops are `hstack`ed
//! into one frame of known size and split apart here, which is byte-exact.
//!
//! Note that an hstacked frame is **row-interleaved**, not two halves: row *r*
//! holds the left crop's row *r* followed by the right crop's row *r*. Treating
//! the first half of the buffer as the left crop yields the top half of both
//! corners stacked, which correlates against nothing and would read as a missing
//! watermark on every frame.
//!
//! ## Why timestamps come from ffmpeg
//!
//! `showinfo` prints the `pts_time` of every frame it passes. Reading those, rather
//! than assuming a sample landed where the `fps` filter was asked to put it, means
//! every timestamp in a report is a time ffmpeg really decoded a frame at, whatever
//! the keyframe spacing.
//!
//! It does **not** make a gap boundary frame-accurate: the boundary is the first and
//! last *sampled* frame that missed, so it is accurate to the fine sampling interval
//! and under-states the absence by up to that much at each end. Conservative in the
//! right direction, but not the same claim.

use serde::Serialize;
use tokio::sync::watch;

use super::error::KavanaghError;
use super::evidence::cap_evidence;
use super::ffmpeg::{run_capture, run_frames, RunError};
use super::geometry::{corner_of, place_region, scale_bbox, union, Corner, CropRegion};
use super::matching::{dedupe_by_alpha, evaluate_sample, sobel_magnitude, WatermarkTemplate};
use super::parsing::{parse_alpha_bbox, parse_probe_output, parse_showinfo_size, VideoProbe};
use super::sampling::{
    coalesce_gaps, corner_changes, establish_corner, refinement_windows, sample_times,
    watermark_span, CornerChange, Gap, Sample, Span,
};
use super::thresholds::{
    resolve_match_confidence, threshold_caveat, COARSE_INTERVAL_SECONDS,
    CORNER_ESTABLISHING_SAMPLES, FINE_INTERVAL_SECONDS, MAX_THUMBNAILS, MIN_GAP_SECONDS,
    TAIL_WINDOW_SECONDS, THUMBNAIL_WIDTH,
};

/// Which stage of a run progress refers to.
///
/// Stage 3's tail analysis adds a `Tail` variant when it starts emitting one. It
/// is not declared here in advance: an unconstructed variant is dead code, and the
/// frontend's union has to grow at the same time anyway.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Probe,
    Watermark,
    Refine,
}

/// What to analyse, and with what.
#[derive(Debug, Clone)]
pub struct AnalysisRequest {
    pub video_path: String,
    pub ffmpeg: String,
    pub ffprobe: String,
    /// Absolute paths of the watermark reference pool, listed by the frontend.
    pub reference_files: Vec<String>,
    /// An operator's advanced override, or `None` for the calibrated default.
    pub match_threshold: Option<f32>,
    /// Where the dip to white begins, once stage 3 can measure it. `None` today.
    pub dip_start_seconds: Option<f64>,
}

/// A downscaled frame kept in memory as evidence for a failure.
///
/// Nothing is written to disk unless an operator asks for it (D15), so these
/// travel over IPC as JPEG bytes and are capped in number.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Thumbnail {
    /// What this frame is evidence of, for the report and the saved filename.
    pub label: String,
    pub at_seconds: f64,
    pub jpeg: Vec<u8>,
}

/// The verdict on the watermark check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WatermarkOutcome {
    Pass,
    Fail,
}

/// Dimensions and duration, as reported, so the report can show what was judged.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub duration_seconds: f64,
}

/// Everything one watermark run concluded.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkReport {
    pub outcome: WatermarkOutcome,
    /// The corner the mark occupies, established from the earliest samples.
    pub corner: Option<Corner>,
    pub span: Span,
    pub gaps: Vec<Gap>,
    pub corner_changes: Vec<CornerChange>,
    pub coarse_samples: usize,
    pub matched_samples: usize,
    /// The highest score any sample reached, whatever the verdict.
    pub best_confidence: f32,
    /// The lowest score any sample reached, whatever the verdict.
    ///
    /// Reported alongside the best because the pair is the diagnostic: 0.98 down to
    /// 0.97 is a stable match, 0.98 down to 0.10 is a video that changes part-way,
    /// and 0.39 down to 0.38 is a threshold argument rather than a missing mark.
    pub weakest_confidence: f32,
    /// The reference that scored best anywhere, whether or not it ever passed.
    ///
    /// Populated even on a total failure: knowing which asset came closest is what
    /// distinguishes a wrong-resolution watermark from no watermark at all.
    pub best_reference: Option<String>,
    /// The reference that produced a passing match, or `None` if none did.
    pub matched_reference: Option<String>,
    pub threshold: f32,
    /// False when an override was applied, so the report can say so (D18).
    pub threshold_is_default: bool,
    pub references_used: usize,
    pub video: VideoInfo,
    pub thumbnails: Vec<Thumbnail>,
    /// Caveats worth stating alongside the verdict.
    pub notes: Vec<String>,
}

/// Keeps a reported percentage from ever going backwards.
///
/// Progress that jumps back looks like a restart and makes a long run feel
/// broken. Refinement is the reason it could: the number of neighbourhoods is
/// unknown until the coarse pass has finished (B11.1).
#[derive(Debug, Default)]
pub struct MonotonicPercentage {
    highest: f64,
}

impl MonotonicPercentage {
    pub fn next(&mut self, percentage: f64) -> f64 {
        let clamped = percentage.clamp(0.0, 100.0);
        if clamped > self.highest {
            self.highest = clamped;
        }
        self.highest
    }
}

/// Splits one `hstack`ed frame into its left and right halves.
///
/// Row-interleaved, so this walks row by row. The buffer is `2 * width * height`
/// bytes for two crops of `width x height`.
pub fn split_hstacked(frame: &[u8], width: usize, height: usize) -> (Vec<u8>, Vec<u8>) {
    let stride = width * 2;
    let mut left = Vec::with_capacity(width * height);
    let mut right = Vec::with_capacity(width * height);

    for row in 0..height {
        let start = row * stride;
        if start + stride > frame.len() {
            break;
        }
        left.extend_from_slice(&frame[start..start + width]);
        right.extend_from_slice(&frame[start + width..start + stride]);
    }

    (left, right)
}

/// A reference pool prepared for one video: templates plus the regions to crop.
#[derive(Debug, Clone)]
pub struct PreparedReferences {
    pub templates: Vec<WatermarkTemplate>,
    /// The region to crop per corner, all of exactly the same size.
    pub regions: Vec<(Corner, CropRegion)>,
    pub region_width: u32,
    pub region_height: u32,
}

/// Builds the filter graph for a sampling pass.
///
/// One corner needs no `hstack`; two corners must be combined into a single frame
/// because two rawvideo outputs on one stdout silently interleave.
pub fn sampling_filtergraph(prepared: &PreparedReferences, fps_expression: &str) -> String {
    let crop = |region: &CropRegion| {
        format!(
            "crop={}:{}:{}:{}",
            region.width, region.height, region.x, region.y
        )
    };

    match prepared.regions.as_slice() {
        [(_, only)] => format!(
            "[0:v]{},fps={},format=gray,showinfo[out]",
            crop(only),
            fps_expression
        ),
        [(_, first), (_, second)] => format!(
            "[0:v]split=2[a][b];[a]{}[c0];[b]{}[c1];[c0][c1]hstack=inputs=2,fps={},format=gray,showinfo[out]",
            crop(first),
            crop(second),
            fps_expression
        ),
        _ => String::new(),
    }
}

/// Bytes in one frame of a sampling pass.
pub fn sampling_frame_size(prepared: &PreparedReferences) -> usize {
    prepared.region_width as usize * prepared.region_height as usize * prepared.regions.len().max(1)
}

/// Runs the whole watermark check.
///
/// `progress` is a plain closure rather than an `AppHandle` so the analysis can be
/// exercised without a Tauri runtime.
pub fn analyse(
    request: &AnalysisRequest,
    cancel: &watch::Receiver<bool>,
    progress: &mut dyn FnMut(Phase, f64, &str),
) -> Result<WatermarkReport, KavanaghError> {
    let mut percentage = MonotonicPercentage::default();
    let report = |progress: &mut dyn FnMut(Phase, f64, &str),
                  percentage: &mut MonotonicPercentage,
                  phase: Phase,
                  value: f64,
                  detail: &str| {
        progress(phase, percentage.next(value), detail);
    };

    // Validated before anything is spawned: an out-of-range threshold should cost
    // nothing to find out about (B13.3).
    let (threshold, threshold_is_default) = resolve_match_confidence(request.match_threshold)
        .map_err(|message| KavanaghError::Threshold { message })?;

    report(
        progress,
        &mut percentage,
        Phase::Probe,
        2.0,
        "Reading the video",
    );
    let probe = probe_video(request, cancel)?;

    report(
        progress,
        &mut percentage,
        Phase::Probe,
        8.0,
        "Preparing reference watermarks",
    );
    let prepared = prepare_references(request, &probe, cancel)?;

    let span = watermark_span(
        probe.duration_seconds,
        request.dip_start_seconds,
        TAIL_WINDOW_SECONDS,
    );

    report(
        progress,
        &mut percentage,
        Phase::Watermark,
        20.0,
        "Checking the watermark",
    );
    let coarse = sample_pass(
        request,
        &prepared,
        cancel,
        None,
        span.end_seconds,
        COARSE_INTERVAL_SECONDS,
        threshold,
        &mut |fraction| {
            progress(
                Phase::Watermark,
                percentage.next(20.0 + fraction * 45.0),
                "Checking the watermark",
            );
        },
    )?;

    let corner = establish_corner(&coarse, CORNER_ESTABLISHING_SAMPLES);
    let changes = corner
        .map(|established| corner_changes(&coarse, established))
        .unwrap_or_default();

    // Only the neighbourhoods that missed are decoded again, and each one reports
    // the absence's real boundaries rather than the coarse timestamp that failed.
    let windows = refinement_windows(&coarse, COARSE_INTERVAL_SECONDS, &span);
    let mut gaps: Vec<Gap> = Vec::new();
    let mut refined: Vec<Sample> = Vec::new();

    for (index, (start, end)) in windows.iter().enumerate() {
        report(
            progress,
            &mut percentage,
            Phase::Refine,
            65.0 + (index as f64 / windows.len().max(1) as f64) * 20.0,
            "Measuring where the watermark is missing",
        );

        let fine = sample_pass(
            request,
            &prepared,
            cancel,
            Some(*start),
            *end,
            FINE_INTERVAL_SECONDS,
            threshold,
            &mut |_| {},
        )?;

        // Coalesced per window: two windows are separated by at least a coarse
        // interval of footage that passed, so merging across them would invent a
        // gap over frames that were never in question.
        gaps.extend(coalesce_gaps(&fine, MIN_GAP_SECONDS));
        refined.extend(fine);
    }

    let matched_samples = coarse.iter().filter(|s| s.matched()).count();

    // Over every sample from both passes, not just the coarse ones: a refinement
    // pass is where the interesting near misses show up.
    let scored: Vec<&Sample> = coarse.iter().chain(refined.iter()).collect();
    let best_sample = scored
        .iter()
        .max_by(|a, b| a.confidence.total_cmp(&b.confidence));
    let best_confidence = best_sample.map(|s| s.confidence).unwrap_or(0.0);
    let best_reference = best_sample.and_then(|s| s.reference.clone());
    let weakest_confidence = scored
        .iter()
        .map(|s| s.confidence)
        .fold(f32::INFINITY, f32::min);
    let weakest_confidence = if weakest_confidence.is_finite() {
        weakest_confidence
    } else {
        0.0
    };

    let outcome = if gaps.is_empty() && changes.is_empty() && corner.is_some() {
        WatermarkOutcome::Pass
    } else {
        WatermarkOutcome::Fail
    };

    let mut thumbnails = Vec::new();
    if outcome == WatermarkOutcome::Fail {
        report(
            progress,
            &mut percentage,
            Phase::Refine,
            88.0,
            "Capturing evidence",
        );
        thumbnails = capture_thumbnails(request, &gaps, &changes, cancel)?;
    }

    let mut notes = Vec::new();
    if span.approximated {
        // Stated rather than assumed: stage 3 measures the dip to white, and until
        // it does the span end is an assumption the verdict rests on (B5.10).
        notes.push(format!(
            "The dip to white has not been located, so the watermark was checked over the first {:.1}s (the video's duration less a {:.0}s closing allowance) rather than up to a measured dip.",
            span.end_seconds, TAIL_WINDOW_SECONDS
        ));
    }
    if !threshold_is_default {
        notes.push(format!(
            "A non-default match confidence threshold of {:.3} was applied.",
            threshold
        ));
    }
    // Whether or not it was overridden: the shipped default is provisional, and a
    // verdict reached outside the band real footage has been measured in has to say
    // so rather than reading as an ordinary verdict.
    if let Some(caveat) = threshold_caveat(threshold) {
        notes.push(caveat);
    }
    if corner.is_none() {
        notes.push("The watermark was never found, so no corner could be established.".to_string());
    }
    if let Some(change) = changes.first() {
        // Named in words as well as in the structured field: a repositioned layer
        // or a spliced render is the likely cause, and that is worth saying.
        notes.push(format!(
            "The watermark moved from the {} corner to the {} corner at {:.1}s.",
            change.expected.label(),
            change.found.label(),
            change.at_seconds
        ));
    }

    report(progress, &mut percentage, Phase::Refine, 100.0, "Done");

    Ok(WatermarkReport {
        outcome,
        corner,
        span,
        gaps,
        corner_changes: changes,
        coarse_samples: coarse.len(),
        matched_samples,
        best_confidence,
        weakest_confidence,
        best_reference,
        matched_reference: coarse
            .iter()
            .find(|sample| sample.matched())
            .and_then(|sample| sample.reference.clone()),
        threshold,
        threshold_is_default,
        references_used: prepared.templates.len(),
        video: VideoInfo {
            width: probe.width,
            height: probe.height,
            duration_seconds: probe.duration_seconds,
        },
        thumbnails,
        notes,
    })
}

/// Asks ffprobe for the dimensions and duration the whole check depends on.
fn probe_video(
    request: &AnalysisRequest,
    cancel: &watch::Receiver<bool>,
) -> Result<VideoProbe, KavanaghError> {
    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-select_streams".to_string(),
        "v:0".to_string(),
        "-show_entries".to_string(),
        "stream=width,height".to_string(),
        "-show_entries".to_string(),
        "format=duration".to_string(),
        "-of".to_string(),
        "default=noprint_wrappers=1".to_string(),
        request.video_path.clone(),
    ];

    let (stdout, run) = run_capture(&request.ffprobe, &args, cancel).map_err(run_error)?;

    if !run.exit_ok {
        // ffprobe's own words: an unsupported codec names the codec, which is far
        // more use than "could not read the video" (B12.2).
        return Err(KavanaghError::Ffmpeg {
            message: format!("ffprobe could not read {}.", request.video_path),
            stderr: run.stderr_tail,
        });
    }

    parse_probe_output(&String::from_utf8_lossy(&stdout)).map_err(|problem| KavanaghError::Probe {
        message: problem.message().to_string(),
    })
}

/// Measures every reference's alpha bbox and builds a template per reference.
///
/// A reference that cannot be read is skipped rather than failing the run: a pool
/// of eight assets should not be unusable because someone dropped a corrupt PNG in
/// it. If *nothing* in the pool is usable, that is reported.
fn prepare_references(
    request: &AnalysisRequest,
    probe: &VideoProbe,
    cancel: &watch::Receiver<bool>,
) -> Result<PreparedReferences, KavanaghError> {
    struct Measured {
        path: String,
        corner: Corner,
        region: CropRegion,
    }

    let mut measured: Vec<Measured> = Vec::new();

    for path in &request.reference_files {
        let args = vec![
            "-v".to_string(),
            // `bbox` and `showinfo` both log at info level, so `-v error` would
            // suppress the very output being parsed and the run would succeed
            // with nothing to read.
            "info".to_string(),
            "-i".to_string(),
            path.clone(),
            "-vf".to_string(),
            "alphaextract,bbox=min_val=16,showinfo".to_string(),
            "-f".to_string(),
            "null".to_string(),
            "-".to_string(),
        ];

        let Ok((_, run)) = run_capture(&request.ffmpeg, &args, cancel) else {
            continue;
        };

        let Some(bbox) = parse_alpha_bbox(&run.stderr_tail) else {
            continue;
        };
        let Some((reference_width, reference_height)) = parse_showinfo_size(&run.stderr_tail)
        else {
            continue;
        };

        measured.push(Measured {
            path: path.clone(),
            corner: corner_of(&bbox, reference_width),
            region: scale_bbox(
                &bbox,
                reference_width,
                reference_height,
                probe.width,
                probe.height,
            ),
        });
    }

    if measured.is_empty() {
        return Err(KavanaghError::ReferencePool {
            message:
                "None of the watermark reference images could be read as an image with an alpha channel."
                    .to_string(),
        });
    }

    // One region per corner, covering every reference that sits in it: the assets
    // are hand-made and their boxes land within a few pixels of one another.
    let mut regions: Vec<(Corner, CropRegion)> = Vec::new();
    for corner in [Corner::TopLeft, Corner::TopRight] {
        let merged = measured
            .iter()
            .filter(|m| m.corner == corner)
            .map(|m| m.region)
            .reduce(|a, b| union(&a, &b));
        if let Some(region) = merged {
            regions.push((corner, region));
        }
    }

    // A single size across corners, since hstack refuses mismatched inputs.
    let region_width = regions.iter().map(|(_, r)| r.width).max().unwrap_or(1);
    let region_height = regions.iter().map(|(_, r)| r.height).max().unwrap_or(1);
    let regions: Vec<(Corner, CropRegion)> = regions
        .iter()
        .map(|(corner, region)| {
            (
                *corner,
                place_region(
                    region,
                    region_width,
                    region_height,
                    probe.width,
                    probe.height,
                ),
            )
        })
        .collect();

    let mut templates = Vec::new();
    for reference in &measured {
        let Some((_, region)) = regions
            .iter()
            .find(|(corner, _)| *corner == reference.corner)
        else {
            continue;
        };

        if let Some(template) = build_template(
            request,
            reference.path.clone(),
            *region,
            reference.corner,
            probe,
            cancel,
        )? {
            templates.push(template);
        }
    }

    // Colour variants carry identical alpha maps, so matching against both costs
    // twice the correlation for no extra coverage.
    let templates = dedupe_by_alpha(templates);

    if templates.is_empty() {
        return Err(KavanaghError::ReferencePool {
            message: "The watermark reference images could not be decoded for comparison."
                .to_string(),
        });
    }

    Ok(PreparedReferences {
        templates,
        regions,
        region_width,
        region_height,
    })
}

/// Decodes one reference's **alpha map** over the inspection region and turns it
/// into a template.
///
/// The alpha map, not the reference composited over anything. The brand assets are a
/// pure monochrome shape plus a varying alpha mask: the Black variant is luma 0
/// everywhere and the White variant luma 255 everywhere, and both carry the *same*
/// alpha map, peaking at 137 of 255 - so the mark is never more than 54% opaque and
/// the backdrop always shows through it.
///
/// That makes the composited appearance backdrop-dependent and useless as a
/// template: black at 54% over dark footage reads strongly, white at 54% over a
/// bright office barely shifts the luma at all. The alpha map is the invariant, and
/// normalised correlation then absorbs the backdrop-dependent difference in signal
/// strength as a scale factor.
///
/// `format=rgba` is forced before `alphaextract` because format negotiation
/// propagates upstream: without it the chain settles on a format with no alpha plane
/// and `alphaextract` fails with "Requested planes not available".
fn build_template(
    request: &AnalysisRequest,
    path: String,
    region: CropRegion,
    corner: Corner,
    probe: &VideoProbe,
    cancel: &watch::Receiver<bool>,
) -> Result<Option<WatermarkTemplate>, KavanaghError> {
    let graph = format!(
        "[0:v]scale={}:{},crop={}:{}:{}:{},format=rgba,alphaextract,format=gray[out]",
        probe.width, probe.height, region.width, region.height, region.x, region.y
    );

    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-i".to_string(),
        path.clone(),
        "-filter_complex".to_string(),
        graph,
        "-map".to_string(),
        "[out]".to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-".to_string(),
    ];

    let (stdout, run) = run_capture(&request.ffmpeg, &args, cancel).map_err(run_error)?;

    let width = region.width as usize;
    let height = region.height as usize;
    if !run.exit_ok || stdout.len() < width * height {
        return Ok(None);
    }

    Ok(Some(WatermarkTemplate {
        name: file_name_of(&path),
        corner,
        alpha: stdout[..width * height].to_vec(),
        gradient: sobel_magnitude(&stdout[..width * height], width, height),
        // Uniform: the alpha map already *is* the mark's shape, so there is nothing
        // left for a separate mask to exclude, and the bbox is the mark's own extent
        // rather than a region with footage around it. `weighted_ncc` stays the
        // primitive so a future mask - glyph strokes only, say - is a one-line change.
        weights: vec![1.0; width * height],
        width,
        height,
    }))
}

/// One decode pass over a stretch of the video at a fixed interval.
///
/// `start` seeks; `-copyts` keeps the reported timestamps absolute so a refinement
/// pass over the middle of a video still reports real times.
#[allow(clippy::too_many_arguments)]
fn sample_pass(
    request: &AnalysisRequest,
    prepared: &PreparedReferences,
    cancel: &watch::Receiver<bool>,
    start: Option<f64>,
    end: f64,
    interval: f64,
    threshold: f32,
    on_progress: &mut dyn FnMut(f64),
) -> Result<Vec<Sample>, KavanaghError> {
    let width = prepared.region_width as usize;
    let height = prepared.region_height as usize;
    let frame_size = sampling_frame_size(prepared);
    let graph = sampling_filtergraph(prepared, &format!("1/{}", interval));

    if graph.is_empty() || frame_size == 0 {
        return Ok(vec![]);
    }

    let begin = start.unwrap_or(0.0);
    let duration = (end - begin).max(0.0);
    if duration <= 0.0 {
        return Ok(vec![]);
    }

    let mut args = vec!["-v".to_string(), "info".to_string()];
    if let Some(start) = start {
        args.push("-ss".to_string());
        args.push(format!("{}", start));
        args.push("-copyts".to_string());
    }
    args.extend([
        "-t".to_string(),
        format!("{}", duration),
        "-i".to_string(),
        request.video_path.clone(),
        "-filter_complex".to_string(),
        graph,
        "-map".to_string(),
        "[out]".to_string(),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-".to_string(),
    ]);

    // The times the `fps` filter will land on, used only to scale progress. The
    // authoritative timestamps come back from `showinfo` below.
    let expected_samples = sample_times(
        &Span {
            start_seconds: begin,
            end_seconds: end,
            approximated: false,
        },
        interval,
    )
    .len()
    .max(1) as f64;
    let mut evaluations: Vec<(Option<Corner>, f32, Option<String>)> = Vec::new();

    let run = run_frames(
        &request.ffmpeg,
        &args,
        frame_size,
        cancel,
        |index, frame| {
            let crops: Vec<(Corner, Vec<u8>)> = if prepared.regions.len() == 2 {
                let (left, right) = split_hstacked(frame, width, height);
                vec![
                    (prepared.regions[0].0, left),
                    (prepared.regions[1].0, right),
                ]
            } else {
                vec![(prepared.regions[0].0, frame.to_vec())]
            };

            let borrowed: Vec<(Corner, &[u8])> = crops
                .iter()
                .map(|(corner, pixels)| (*corner, pixels.as_slice()))
                .collect();

            let evaluation = evaluate_sample(&borrowed, &prepared.templates, threshold);
            evaluations.push((
                evaluation.corner,
                evaluation.confidence,
                evaluation.reference,
            ));

            on_progress(((index + 1) as f64 / expected_samples).min(1.0));
        },
    )
    .map_err(run_error)?;

    // A non-zero exit having produced frames is usually a trailing warning about a
    // truncated last packet, which is not worth discarding a whole pass over. A
    // non-zero exit having produced nothing is a real decode failure (B12.2).
    if !run.exit_ok && run.frames_read == 0 {
        return Err(KavanaghError::Ffmpeg {
            message: "ffmpeg could not decode this video for the watermark check.".to_string(),
            stderr: run.stderr_tail,
        });
    }

    // Real decoded timestamps where ffmpeg reported them, and the requested
    // interval only as a fallback when the counts disagree.
    Ok(evaluations
        .into_iter()
        .enumerate()
        .map(|(index, (corner, confidence, reference))| Sample {
            time_seconds: run
                .pts_times
                .get(index)
                .copied()
                .unwrap_or(begin + index as f64 * interval),
            corner,
            confidence,
            reference,
        })
        .collect())
}

/// Grabs a downscaled JPEG for each failure, up to the retention cap.
///
/// Nothing is written to disk: these are returned over IPC and held in memory for
/// the report only (D15, B10.1).
fn capture_thumbnails(
    request: &AnalysisRequest,
    gaps: &[Gap],
    changes: &[CornerChange],
    cancel: &watch::Receiver<bool>,
) -> Result<Vec<Thumbnail>, KavanaghError> {
    let mut wanted: Vec<(String, f64)> = gaps
        .iter()
        .map(|gap| {
            (
                format!("watermark-missing-{:.1}s", gap.start_seconds),
                gap.start_seconds,
            )
        })
        .collect();

    wanted.extend(changes.iter().map(|change| {
        (
            format!("watermark-corner-{:.1}s", change.at_seconds),
            change.at_seconds,
        )
    }));

    // Capped so a long, badly broken video cannot fill memory with evidence nobody
    // asked to keep, and so the cap bounds the ffmpeg spawns too (B10.4).
    let wanted = cap_evidence(wanted, MAX_THUMBNAILS);

    let mut thumbnails = Vec::new();
    for (label, at) in wanted {
        let args = vec![
            "-v".to_string(),
            "error".to_string(),
            "-ss".to_string(),
            format!("{}", at),
            "-i".to_string(),
            request.video_path.clone(),
            "-frames:v".to_string(),
            "1".to_string(),
            "-vf".to_string(),
            format!("scale={}:-2", THUMBNAIL_WIDTH),
            "-f".to_string(),
            "mjpeg".to_string(),
            "-".to_string(),
        ];

        let (jpeg, run) = run_capture(&request.ffmpeg, &args, cancel).map_err(run_error)?;

        // A frame that cannot be grabbed is not worth failing the report over: the
        // gap it illustrates is already established.
        if run.exit_ok && !jpeg.is_empty() {
            thumbnails.push(Thumbnail {
                label,
                at_seconds: at,
                jpeg,
            });
        }
    }

    Ok(thumbnails)
}

/// The file name part of a path, for naming what matched.
pub fn file_name_of(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Turns a process failure into the error the frontend renders.
fn run_error(error: RunError) -> KavanaghError {
    match error {
        RunError::Cancelled => KavanaghError::Cancelled {
            message: "The quality control run was cancelled.".to_string(),
        },
        RunError::Spawn(message) => KavanaghError::Unavailable { message },
        RunError::Io(message) => KavanaghError::Io { message },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prepared(regions: Vec<(Corner, CropRegion)>) -> PreparedReferences {
        PreparedReferences {
            templates: vec![],
            regions,
            region_width: 148,
            region_height: 148,
        }
    }

    #[test]
    fn splits_an_hstacked_frame_row_by_row_not_in_halves() {
        // The failure this guards is silent: treating the first half of the buffer
        // as the left crop yields the top half of both corners stacked, which
        // correlates against nothing and reads as a missing watermark everywhere.
        let width = 2;
        let height = 2;
        // Row 0: L L R R, row 1: L L R R
        let frame = vec![1, 2, 10, 20, 3, 4, 30, 40];

        let (left, right) = split_hstacked(&frame, width, height);

        assert_eq!(left, vec![1, 2, 3, 4]);
        assert_eq!(right, vec![10, 20, 30, 40]);
    }

    #[test]
    fn splitting_stops_at_a_truncated_frame_rather_than_reading_past_it() {
        let frame = vec![1, 2, 10, 20, 3];

        let (left, right) = split_hstacked(&frame, 2, 2);

        assert_eq!(left, vec![1, 2]);
        assert_eq!(right, vec![10, 20]);
    }

    #[test]
    fn hstacks_both_corners_into_one_output_when_two_are_in_play() {
        // Two rawvideo outputs on one stdout do not error; they interleave into an
        // unparseable stream. hstack is the reason this graph has one output.
        let graph = sampling_filtergraph(
            &prepared(vec![
                (
                    Corner::TopLeft,
                    CropRegion {
                        x: 20,
                        y: 20,
                        width: 148,
                        height: 148,
                    },
                ),
                (
                    Corner::TopRight,
                    CropRegion {
                        x: 1751,
                        y: 20,
                        width: 148,
                        height: 148,
                    },
                ),
            ]),
            "1/10",
        );

        assert!(graph.contains("hstack=inputs=2"), "got {}", graph);
        assert!(graph.contains("crop=148:148:20:20"), "got {}", graph);
        assert!(graph.contains("crop=148:148:1751:20"), "got {}", graph);
        assert_eq!(graph.matches("[out]").count(), 1, "exactly one output");
        assert!(graph.contains("showinfo"), "timestamps come from showinfo");
        assert!(graph.ends_with("[out]"));
    }

    #[test]
    fn skips_the_hstack_when_only_one_corner_has_references() {
        let graph = sampling_filtergraph(
            &prepared(vec![(
                Corner::TopRight,
                CropRegion {
                    x: 1751,
                    y: 20,
                    width: 148,
                    height: 148,
                },
            )]),
            "1/10",
        );

        assert!(!graph.contains("hstack"), "got {}", graph);
        assert!(graph.contains("crop=148:148:1751:20"));
    }

    #[test]
    fn frame_size_counts_both_corners() {
        let two = prepared(vec![
            (
                Corner::TopLeft,
                CropRegion {
                    x: 0,
                    y: 0,
                    width: 148,
                    height: 148,
                },
            ),
            (
                Corner::TopRight,
                CropRegion {
                    x: 100,
                    y: 0,
                    width: 148,
                    height: 148,
                },
            ),
        ]);

        assert_eq!(sampling_frame_size(&two), 148 * 148 * 2);
    }

    #[test]
    fn b11_1_never_reports_a_percentage_lower_than_the_last() {
        // Refinement does not know how many neighbourhoods it will visit until the
        // coarse pass ends, so the arithmetic can genuinely produce a lower number.
        let mut percentage = MonotonicPercentage::default();

        assert_eq!(percentage.next(10.0), 10.0);
        assert_eq!(percentage.next(65.0), 65.0);
        assert_eq!(percentage.next(20.0), 65.0);
        assert_eq!(percentage.next(150.0), 100.0);
    }

    #[test]
    fn names_the_reference_file_rather_than_its_whole_path() {
        assert_eq!(
            file_name_of("/Volumes/Brand/Watermarks/4K Watermarks/WBS_BlackRight_4K.png"),
            "WBS_BlackRight_4K.png"
        );
    }
}
