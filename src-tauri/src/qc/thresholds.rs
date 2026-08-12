//! QC thresholds and sampling constants (issue #180, stage 2, B13).
//!
//! Calibrated against a real UHD render rather than guessed. Measured with the
//! watermark present: **0.9826 / 0.9828 / 0.9828** at t=20/60/120s, a variance of
//! 0.0002 across a hundred seconds of varying footage. A same-sized region with
//! no mark in it scored **0.0115**. The mark sits on a solid box, and that box
//! dominates the gradient structure regardless of the footage behind it, which is
//! why the score is so stable.
//!
//! A default of 0.85 therefore sits in a very wide empty band. It is deliberately
//! nowhere near the measured match: the margin absorbs a different asset, a
//! busier background, or a heavier encode without anyone having to retune.
//!
//! **These defaults are mirrored in `src/shared/constants/qc.ts`**, which is the
//! source of truth for the UI and always sends the threshold it displays. The
//! copy here is the fallback for a call that omits it, and the two must be
//! changed together.

/// Match confidence a watermark sample must reach to count as present.
pub const DEFAULT_MATCH_CONFIDENCE: f32 = 0.85;

/// Bounds for an operator override.
///
/// The floor is not zero: a mark-free region measured 0.0115, so any threshold
/// below about 0.3 would pass literally every frame and report a green tick on a
/// video with no branding at all. That is worse than no check.
pub const MATCH_CONFIDENCE_MIN: f32 = 0.30;
pub const MATCH_CONFIDENCE_MAX: f32 = 0.999;

/// Seconds between coarse samples in the single decode pass.
pub const COARSE_INTERVAL_SECONDS: f64 = 10.0;

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

/// Validates an operator's match confidence override.
///
/// Rejected rather than clamped (B13.3). Silently clamping 8.5 to 0.999 leaves
/// someone believing they set something they did not, and the next confusing
/// verdict is unattributable.
pub fn validate_match_confidence(value: f32) -> Result<f32, String> {
    unimplemented!("red");
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

/// Resolves the threshold for a run, and whether it is the calibrated default.
///
/// The report states when a non-default threshold was applied (D18): a verdict
/// reached under a hand-tuned threshold is not reproducible from the constants,
/// and a reviewer has to be able to see that.
pub fn resolve_match_confidence(override_value: Option<f32>) -> Result<(f32, bool), String> {
    unimplemented!("red");
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
        assert!(error.contains("1.5"), "the rejected value belongs in the message");
    }

    #[test]
    fn b13_3_rejects_an_override_below_the_range() {
        // 0.0115 was measured for a region with no watermark in it, so a threshold
        // under the floor would pass a completely unbranded video.
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
    fn the_default_sits_well_inside_the_measured_separation() {
        // Guards the calibration itself: 0.9826 was measured for a genuine match
        // and 0.0115 for a mark-free region. A default drifting to either edge of
        // that band is a change worth failing a test over.
        assert!(DEFAULT_MATCH_CONFIDENCE > 0.5, "too close to the non-match score");
        assert!(DEFAULT_MATCH_CONFIDENCE < 0.98, "too close to the match score");
    }
}
