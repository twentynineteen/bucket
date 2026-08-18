//! QC thresholds and sampling constants (issue #180, stage 2, B13).
//!
//! **These defaults are mirrored in `src/shared/constants/kavanagh.ts`**, which is the
//! source of truth for the UI and always sends the threshold it displays. The copy
//! here is the fallback for a call that omits it, and the two must be changed
//! together.
//!
//! # Calibration
//!
//! Measured on two real UHD renders, after the matcher was corrected to build its
//! template from the reference's **alpha map** rather than from the reference
//! composited over a backdrop. The brand assets are a flat colour plus a varying
//! alpha mask peaking at 137 of 255, so the mark is never more than 54% opaque and
//! its composited appearance depends entirely on the footage behind it. The alpha
//! map is the backdrop-invariant; normalised correlation absorbs the rest as a scale
//! factor.
//!
//! | region | NCC |
//! | --- | --- |
//! | render 1 watermark, Black variant, dark backdrop | **0.9973** |
//! | render 2 watermark, White variant, bright backdrop, t=80 | **0.9833** |
//! | render 2 watermark, t=30 | **0.9803** |
//! | render 1 control, top-left, no mark | 0.0135 |
//! | render 2 control, top-left, no mark | -0.1483 |
//!
//! So presence measured **0.9803 to 0.9973** across two renders, two colour variants
//! and two backdrop types at 4K, against absence of **-0.1483 to 0.0135**. The
//! narrowest separation is about 0.83.
//!
//! Remeasured for issue #266 once scoring moved to per-reference subwindows: a third
//! real UHD render, mark present on every one of 256 coarse samples over heavily
//! textured footage, measured presence **0.9333 to 0.9996**. The separation from
//! absence is still enormous, and the documented floor follows the weakest honest
//! measurement.
//!
//! An earlier round of measurement put presence as low as 0.389 and looked like a
//! contrast problem. It was an artefact of clipping: computing the gradient at 8-bit
//! precision overflows on alpha-map edges, whose deltas are twice a grey composite's,
//! so the two stopped being proportional. `matching::sobel_magnitude` accumulates in
//! `f32` for that reason, and ffmpeg's own `sobel` filter must not be substituted for
//! it.

/// Match confidence a watermark sample must reach to count as present.
///
/// Presence measured 0.9803 to 0.9973 and absence -0.1483 to 0.0135, so 0.85 sits in
/// a very wide empty band. Deliberately well below the weakest measured match: the
/// margin absorbs a heavier encode or a new asset without anyone having to retune.
pub const DEFAULT_MATCH_CONFIDENCE: f32 = 0.85;

/// Bounds for an operator override.
///
/// The floor is not zero: a mark-free region measured up to 0.0135, so a threshold
/// near zero would pass every frame and report a green tick on a video with no
/// branding at all. That is worse than no check. It is still set well below the
/// default so a badly calibrated default can be worked around without a release.
pub const MATCH_CONFIDENCE_MIN: f32 = 0.30;
pub const MATCH_CONFIDENCE_MAX: f32 = 0.999;

/// The measured band the default has to sit inside, as a guard on retuning.
///
/// Presence was measured no lower than this, so a default above it would fail a
/// render whose watermark is plainly visible.
///
/// Remeasured for issue #266: with per-reference scoring subwindows, a third
/// real UHD render (mark present and pristine on every one of 256 coarse
/// samples over heavily textured footage) measured presence 0.9333 to 0.9996,
/// dipping below the 0.9803 the first two renders established. The floor
/// follows the weakest honest measurement.
pub const MEASURED_WEAKEST_PRESENCE: f32 = 0.933;

/// Absence was measured no higher than this, so a default below it would pass a
/// video with no watermark at all.
pub const MEASURED_STRONGEST_ABSENCE: f32 = 0.0135;

/// Seconds between coarse samples in the single decode pass.
///
/// Two seconds, matching the agreed design, because the blind spot inherent to
/// coarse-then-refine is as long as this interval: an absence shorter than it can
/// fall entirely between two samples. Ten seconds was measured here first and is
/// not worth the wider blind spot, because the tighter interval is very nearly
/// free. The decode dominates a coarse pass, and the `fps` filter changes only how
/// many frames are *emitted*, not how many are decoded: a full pass over a 144s
/// 4K render took 4.635s at 10s spacing and 4.637s at 2s. The only real cost is
/// five times as many correlations, which is a few million pixel operations.
pub const COARSE_INTERVAL_SECONDS: f64 = 2.0;

/// Seconds between samples in a refinement pass over one neighbourhood.
pub const FINE_INTERVAL_SECONDS: f64 = 0.5;

/// The shortest absence reported as a gap.
///
/// Below this it is noise: one artefact-hit frame, or a single fine sample that
/// happened to land on a hard cut. Three consecutive fine samples must miss
/// before anything is reported.
pub const MIN_GAP_SECONDS: f64 = 1.0;

/// The closing stretch the watermark is not expected over.
///
/// The measured tail is 5.5s (a 0.5s ramp to a white peak at T-5s, then a 5s
/// sting). Twelve seconds is the search window stage 3 will use to find that
/// peak, and until it exists it doubles as the assumed span end.
pub const TAIL_WINDOW_SECONDS: f64 = 12.0;

/// Matched samples consulted when establishing which corner the mark occupies.
pub const CORNER_ESTABLISHING_SAMPLES: usize = 3;

/// Failure thumbnails retained in memory for one report.
///
/// Capped because nothing is written to disk (D15): a long, badly broken video
/// refined at a fine interval could otherwise hold dozens of frames in memory for
/// as long as the report is open.
pub const MAX_THUMBNAILS: usize = 6;

/// Width thumbnails are downscaled to before being sent over IPC.
pub const THUMBNAIL_WIDTH: u32 = 480;

/// Most recent ffmpeg stderr kept for error reporting.
///
/// Bounded rather than unbounded: a pathological run can print megabytes of
/// per-frame warnings, and the useful part of an ffmpeg failure is always at the
/// end (B11.3).
pub const MAX_STDERR_BYTES: usize = 8 * 1024;

// ---------------------------------------------------------------------------
// Tail and sting (stage 3, B5-B7)
//
// These are not hand-tuned tolerances around observed footage. The tail is
// produced by two Premiere preferences - Video Transition Default Duration
// 1.00s and Still Image Default Duration 5.00s - so the structure is a
// deterministic consequence of software defaults (A6):
//
//   T-5.5s ─── T-5.0s ─── T-4.5s ──────────── T-0s
//      │          │          │                   │
//    ramp up   FULL WHITE  settled              end
//    (0.5s)    (the cut)   └── 4.5s static ──────┘
//
// A 1.00s transition applied Center at Cut ramps up for 0.5s, so the peak is
// the cut, and the 5.00s still begins there. Catching preset drift is the
// stated purpose of the check, so the tolerances are deliberately tight:
// loose ones would pass the very drift this exists to find.
// ---------------------------------------------------------------------------

/// Mean luma at or above which a frame may be the white peak (D5).
///
/// Cleared by limited-range white at 235 and full-range at 255, so no ffprobe
/// `color_range` is consulted - it reads `unknown` on ordinary encodes. Both
/// measured renders peaked at exactly 235.00.
pub const WHITE_PEAK_YAVG_MIN: f64 = 232.0;

/// Minimum luma the peak frame's darkest pixel must also reach (D5).
///
/// Without this a bright-but-partial frame passes on YAVG alone - a white
/// title card over dark footage, or a lighting flash. Both measured peaks had
/// YMIN 235, i.e. the whole frame was white; a frame retaining any genuinely
/// dark content sits far below this (B5.4).
pub const WHITE_PEAK_YMIN_MIN: f64 = 200.0;

/// Fractions of the rise used to measure the ramp.
///
/// The ramp is measured as a **10-90% rise time**, settled in A7 after three
/// candidate definitions were compared on two renders: 10-90% measured exactly
/// 0.400s on both, where baseline-departure varied (0.460 vs 0.480) and
/// mid-to-peak is a half-measure of a symmetric ramp.
pub const RAMP_RISE_LOW_FRACTION: f64 = 0.10;
pub const RAMP_RISE_HIGH_FRACTION: f64 = 0.90;

/// Expected 10-90% rise time, in seconds.
///
/// Mathematically exact for a linear dissolve rather than observed: 80% of a
/// 0.500s half-transition. Measured 0.400s on both renders, variance zero.
pub const RAMP_NOMINAL_SECONDS: f64 = 0.400;

/// Tolerance either side of the nominal ramp.
///
/// Frame quantisation is 0.02s at 50fps and 0.04s at 25fps, so this is several
/// frames of slack against a measurement that did not vary at all. The window
/// [0.32, 0.48] still catches every drift worth catching: a hard cut is about
/// one frame, a 2.00s transition gives 0.8s, and a 0.50s one gives 0.2s.
pub const RAMP_TOLERANCE_SECONDS: f64 = 0.08;

/// Expected sting duration, from Still Image Default Duration (A6).
pub const STING_NOMINAL_SECONDS: f64 = 5.00;

/// Tolerance on the sting duration.
///
/// Wider than the ramp's because the end of the video is a harder edge to
/// measure: the container may carry a partial final frame, and a render can be
/// trimmed a frame or two short. Still far tighter than the failure it exists
/// to catch, which is a sting of 2s or of 10s (B5.6).
pub const STING_TOLERANCE_SECONDS: f64 = 0.25;

/// Content allowed after the sting before the video is judged not to end on it.
///
/// A stray black frame or two is an artefact of export, not a defect (B5.8).
/// Two frames is 0.04s at 50fps, so this is generous without admitting a whole
/// extra shot after the logo.
pub const TRAILING_TOLERANCE_SECONDS: f64 = 0.20;

/// How long after the peak the sting is considered settled.
///
/// The still's opening 0.5s sits underneath the fade from white, so identity
/// must be matched against what comes after it. Derived rather than intuited:
/// it is the second half of the 1.00s centred transition (A6). Matching the
/// first post-peak frame would compare a half-white frame against the JPG.
pub const STING_SETTLED_OFFSET_SECONDS: f64 = 0.5;

/// Correlation a settled sting frame must reach to identify a reference (D7).
///
/// Strict, because the reference *is* the source asset: nothing is composited
/// over the sting, so only encode and scaling differences are tolerated. The
/// band is wide despite the strictness - a correct render matched its
/// reference at 0.9989, while the wrong-resolution variant of the same asset
/// reached only 0.7869, and two renders' sting frames correlated at 1.0000.
pub const STING_MATCH_CONFIDENCE: f32 = 0.95;

/// Size both the sting frames and the reference JPGs are scaled to before
/// being compared.
///
/// A fixed size on both sides is what makes the comparison resolution-agnostic,
/// which matters in practice: both calibration renders carry the *1080p* sting
/// asset on a UHD timeline, and matched their 1080p reference at 0.9989 while
/// the 4K variant of the same asset reached only 0.7869 (A5). Small because the
/// sting is a large flat logo - the identity is in its layout, not its detail -
/// and 320x180 keeps a full pool comparison to a few million operations.
pub const STING_COMPARISON_WIDTH: u32 = 320;
pub const STING_COMPARISON_HEIGHT: u32 = 180;

/// Frames per second sampled across the settled sting.
///
/// The hold is ~4.5s, so this takes roughly nine frames: enough for the freeze
/// check to have something to compare and for identity to be carried by the
/// worst of several frames rather than one lucky one (B6.7).
pub const STING_SAMPLE_FPS: f64 = 2.0;

/// Largest mean absolute luma difference across settled sting frames that
/// still counts as frozen (D7).
///
/// A held JPG measured 0.00 on both renders, and 0.01 across renders, so this
/// is entirely encode noise headroom. Motion, a stray cut inside the hold, or
/// a wrong layer left visible all move this by tens (B6.5, B6.6).
pub const STING_FREEZE_MAX_MAD: f64 = 2.0;

/// Validates an operator's match confidence override.
///
/// Rejected rather than clamped (B13.3). Silently clamping 8.5 to 0.999 leaves
/// someone believing they set something they did not, and the next confusing
/// verdict is unattributable.
pub fn validate_match_confidence(value: f32) -> Result<f32, String> {
    if !value.is_finite() {
        return Err("The match confidence threshold must be a number.".to_string());
    }

    if !(MATCH_CONFIDENCE_MIN..=MATCH_CONFIDENCE_MAX).contains(&value) {
        return Err(format!(
            "The match confidence threshold must be between {} and {}. {} was rejected rather than adjusted.",
            MATCH_CONFIDENCE_MIN, MATCH_CONFIDENCE_MAX, value
        ));
    }

    Ok(value)
}

/// A caveat to put in the report when the threshold in use sits outside the band
/// real footage has been measured in, or `None` when it does not.
///
/// Allowed rather than refused: the override exists precisely so someone can work
/// around a badly chosen default, and refusing the values that would help would
/// defeat it. But a verdict reached at a threshold known to fail a visible
/// watermark, or to pass an unbranded video, must not read as an ordinary verdict.
pub fn threshold_caveat(threshold: f32) -> Option<String> {
    if threshold > MEASURED_WEAKEST_PRESENCE {
        return Some(format!(
            "A threshold of {:.3} is above {:.3}, the weakest score measured on a render whose watermark was plainly visible. A pass at this threshold is trustworthy; a failure may be the threshold rather than the render.",
            threshold, MEASURED_WEAKEST_PRESENCE
        ));
    }

    if threshold < MEASURED_STRONGEST_ABSENCE {
        return Some(format!(
            "A threshold of {:.3} is below {:.3}, the strongest score measured on a region with no watermark in it. A pass at this threshold means very little.",
            threshold, MEASURED_STRONGEST_ABSENCE
        ));
    }

    None
}

/// Resolves the threshold for a run, and whether it is the calibrated default.
///
/// The report states when a non-default threshold was applied (D18): a verdict
/// reached under a hand-tuned threshold is not reproducible from the constants,
/// and a reviewer has to be able to see that.
pub fn resolve_match_confidence(override_value: Option<f32>) -> Result<(f32, bool), String> {
    match override_value {
        None => Ok((DEFAULT_MATCH_CONFIDENCE, true)),
        Some(value) => {
            let validated = validate_match_confidence(value)?;
            Ok((
                validated,
                (validated - DEFAULT_MATCH_CONFIDENCE).abs() < f32::EPSILON,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b13_1_uses_the_calibrated_default_when_no_override_is_given() {
        assert_eq!(
            resolve_match_confidence(None),
            Ok((DEFAULT_MATCH_CONFIDENCE, true))
        );
    }

    #[test]
    fn b13_2_uses_an_override_and_marks_the_threshold_as_non_default() {
        let (threshold, is_default) = resolve_match_confidence(Some(0.92)).unwrap();

        assert_eq!(threshold, 0.92);
        assert!(
            !is_default,
            "the report must be able to say a non-default threshold applied"
        );
    }

    #[test]
    fn b13_3_rejects_an_override_above_the_range_rather_than_clamping_it() {
        let error = validate_match_confidence(1.5).expect_err("1.5 is not a confidence");

        assert!(error.contains("rejected"), "got {}", error);
        assert!(
            error.contains("1.5"),
            "the rejected value belongs in the message"
        );
    }

    #[test]
    fn b13_3_rejects_an_override_below_the_range() {
        // A region with no watermark in it measured up to 0.0135, so a threshold under
        // the floor would pass a completely unbranded video.
        assert!(validate_match_confidence(0.05).is_err());
    }

    #[test]
    fn b13_3_rejects_a_non_finite_override() {
        assert!(validate_match_confidence(f32::NAN).is_err());
        assert!(validate_match_confidence(f32::INFINITY).is_err());
    }

    #[test]
    fn accepts_the_range_bounds_themselves() {
        assert!(validate_match_confidence(MATCH_CONFIDENCE_MIN).is_ok());
        assert!(validate_match_confidence(MATCH_CONFIDENCE_MAX).is_ok());
    }

    #[test]
    fn an_override_equal_to_the_default_is_still_the_default() {
        let (_, is_default) = resolve_match_confidence(Some(DEFAULT_MATCH_CONFIDENCE)).unwrap();

        assert!(
            is_default,
            "the UI always sends the threshold it shows, so sending the default must not read as an override"
        );
    }

    #[test]
    fn the_default_sits_inside_the_measured_band() {
        // Guards a retune rather than the value: a default above the weakest measured
        // presence fails a render whose watermark is plainly visible, and one below
        // the strongest measured absence passes a video with no watermark at all.
        // Both have happened on real footage, which is why this is a test and not a
        // comment.
        assert!(
            DEFAULT_MATCH_CONFIDENCE > MEASURED_STRONGEST_ABSENCE,
            "a default at or below {} passes an unbranded video",
            MEASURED_STRONGEST_ABSENCE
        );
        assert!(
            DEFAULT_MATCH_CONFIDENCE < MEASURED_WEAKEST_PRESENCE,
            "a default at or above {} fails render 2, whose watermark is visible",
            MEASURED_WEAKEST_PRESENCE
        );
    }

    #[test]
    fn a_threshold_above_the_measured_presence_carries_a_caveat() {
        // Above the weakest score a plainly visible watermark reached, so a failure at
        // this threshold may be the threshold rather than the render.
        let caveat = threshold_caveat(0.99).expect("0.99 is above the measured presence");

        assert!(caveat.contains("plainly visible"), "got {}", caveat);
    }

    #[test]
    fn a_threshold_below_the_measured_absence_carries_a_caveat() {
        let caveat = threshold_caveat(0.01).expect("0.01 is below the measured absence");

        assert!(caveat.contains("means very little"), "got {}", caveat);
    }

    #[test]
    fn the_calibrated_default_needs_no_caveat() {
        assert_eq!(threshold_caveat(DEFAULT_MATCH_CONFIDENCE), None);
    }

    #[test]
    fn the_override_range_can_reach_either_side_of_the_default() {
        // The point of an override is working around a badly chosen default without
        // waiting for a release, which it cannot do if the default is at the edge of
        // the allowed range.
        assert!(MATCH_CONFIDENCE_MIN < DEFAULT_MATCH_CONFIDENCE);
        assert!(MATCH_CONFIDENCE_MAX > DEFAULT_MATCH_CONFIDENCE);
    }
}
