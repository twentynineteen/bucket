//! Closing tail structure: the dip to white and the sting that follows (B5).
//!
//! The tail is a consequence of two Premiere preferences rather than a hand
//! edit, so it is checked against a derived model rather than an observed one.
//! See `thresholds` for the derivation; the short version is a 1.00s transition
//! applied Center at Cut, so white is reached at the cut, and a 5.00s still
//! image begins there.
//!
//! Everything here is pure: it takes the luma samples `signalstats` produced and
//! returns what they imply. That keeps the structural rules testable without
//! ffmpeg, which matters because these are the rules most likely to be argued
//! with when a render fails.

use serde::Serialize;

use super::parsing::LumaSample;
use super::thresholds::{
    RAMP_NOMINAL_SECONDS, RAMP_RISE_HIGH_FRACTION, RAMP_RISE_LOW_FRACTION, RAMP_TOLERANCE_SECONDS,
    STING_NOMINAL_SECONDS, STING_TOLERANCE_SECONDS, TAIL_WINDOW_SECONDS,
    TRAILING_TOLERANCE_SECONDS, WHITE_PEAK_YAVG_MIN, WHITE_PEAK_YMIN_MIN,
};

/// Fraction of the settled sting's brightness a frame must keep to count as
/// still showing the sting.
///
/// Relative rather than an absolute luma floor, so it adapts to a sting that is
/// darker than the ones measured. Black export padding sits near zero and is
/// nowhere near half of any sting's mean.
const ON_STING_FRACTION: f64 = 0.5;

/// How far back the ramp's baseline is measured from.
///
/// Bounded rather than "the darkest frame in the window", which was the first
/// implementation and is wrong on real footage: a dark shot anywhere in the
/// preceding 12s drags the baseline down, which drags the 10% target below the
/// level the dip actually started from. The crossing search then walks back
/// past the ramp entirely and measures from some earlier cut, reporting a
/// multi-second ramp on a correct render. Three ramps' worth of look-back is
/// comfortably longer than any legitimate transition and short enough to stay
/// inside the shot the dip begins from.
const RAMP_BASELINE_WINDOW_SECONDS: f64 = 1.5;

/// What is wrong with a tail, in the operator's terms.
///
/// Each variant carries what was measured, because a tolerance failure is only
/// actionable next to the number that failed it: "ramp 0.25s, expected 0.40s"
/// is a diagnosis, "the ramp is wrong" is an argument.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TailProblem {
    /// Shorter than the search window, so there is no tail to analyse (B5.9).
    VideoTooShort { duration_seconds: f64 },
    /// No frame in the window reached white (B5.5).
    NoWhitePeak,
    /// A hard cut rather than a dissolve (B5.7).
    RampTooShort { measured_seconds: f64 },
    /// A longer transition than the 1.00s default, i.e. preset drift.
    RampTooLong { measured_seconds: f64 },
    /// Less content after the peak than a 5.00s still (B5.6).
    StingTooShort { measured_seconds: f64 },
    /// More content after the peak than a 5.00s still.
    StingTooLong { measured_seconds: f64 },
    /// Content continues past the sting beyond the trailing tolerance (B5.8).
    DoesNotEndOnSting { trailing_seconds: f64 },
}

impl TailProblem {
    /// One sentence naming the fault and the measurement behind it.
    pub fn message(&self) -> String {
        match self {
            TailProblem::VideoTooShort { duration_seconds } => format!(
                "This video is {:.1}s long, shorter than the {:.0}s closing section the check reads, so its tail cannot be analysed.",
                duration_seconds, TAIL_WINDOW_SECONDS
            ),
            TailProblem::NoWhitePeak => {
                "No dip to white found in the closing section.".to_string()
            }
            TailProblem::RampTooShort { measured_seconds } => format!(
                "The dip to white takes {:.2}s, expected {:.2}s ({:.2}-{:.2}s). A ramp this short is a hard cut rather than a dissolve.",
                measured_seconds,
                RAMP_NOMINAL_SECONDS,
                ramp_min(),
                ramp_max()
            ),
            TailProblem::RampTooLong { measured_seconds } => format!(
                "The dip to white takes {:.2}s, expected {:.2}s ({:.2}-{:.2}s). A longer transition than the 1.00s default usually means the default has drifted.",
                measured_seconds,
                RAMP_NOMINAL_SECONDS,
                ramp_min(),
                ramp_max()
            ),
            TailProblem::StingTooShort { measured_seconds } => format!(
                "The sting runs {:.2}s, expected {:.2}s. It has been cut short.",
                measured_seconds, STING_NOMINAL_SECONDS
            ),
            TailProblem::StingTooLong { measured_seconds } => format!(
                "The sting runs {:.2}s, expected {:.2}s. Something follows it, or its duration was changed.",
                measured_seconds, STING_NOMINAL_SECONDS
            ),
            TailProblem::DoesNotEndOnSting { trailing_seconds } => format!(
                "{:.2}s of content follows the sting, so the video does not end on it.",
                trailing_seconds
            ),
        }
    }
}

/// Shortest acceptable 10-90% rise.
pub fn ramp_min() -> f64 {
    RAMP_NOMINAL_SECONDS - RAMP_TOLERANCE_SECONDS
}

/// Longest acceptable 10-90% rise.
pub fn ramp_max() -> f64 {
    RAMP_NOMINAL_SECONDS + RAMP_TOLERANCE_SECONDS
}

/// What the tail's structure turned out to be.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TailAnalysis {
    /// Where the dip reaches white, which is the cut the sting starts at.
    pub peak_at_seconds: Option<f64>,
    /// Measured 10-90% rise time.
    pub ramp_seconds: Option<f64>,
    /// Content after the peak.
    pub sting_seconds: Option<f64>,
    /// Content after the sting stops being on screen.
    pub trailing_seconds: Option<f64>,
    pub problems: Vec<TailProblem>,
}

impl TailAnalysis {
    pub fn is_sound(&self) -> bool {
        self.problems.is_empty()
    }

    /// Where the dip begins, which is where the watermark stops being expected.
    ///
    /// The watermark span ends here rather than at the peak: the mark is already
    /// fading under the dissolve before white is reached, so measuring to the
    /// peak would report a gap for every correct render (B4.6).
    pub fn dip_start_seconds(&self) -> Option<f64> {
        match (self.peak_at_seconds, self.ramp_seconds) {
            (Some(peak), Some(ramp)) => Some((peak - ramp).max(0.0)),
            // A peak with no measurable ramp still bounds the span: better to
            // stop at the peak than to check the watermark through the dip.
            (Some(peak), None) => Some(peak),
            _ => None,
        }
    }
}

/// Finds the white peak: the brightest full-frame white in the window (D5).
///
/// Both conditions matter. `YAVG` alone passes a bright element over dark
/// footage; the `YMIN` guard requires the whole frame to be white, so a lighting
/// flash or a white title card cannot qualify (B5.4). Ties go to the earliest
/// frame, because when white is held for several frames the cut is where it
/// starts.
pub fn find_white_peak(samples: &[LumaSample]) -> Option<usize> {
    let mut best: Option<usize> = None;

    for (index, sample) in samples.iter().enumerate() {
        if sample.yavg < WHITE_PEAK_YAVG_MIN || sample.ymin < WHITE_PEAK_YMIN_MIN {
            continue;
        }

        match best {
            Some(current) if samples[current].yavg >= sample.yavg => {}
            _ => best = Some(index),
        }
    }

    best
}

/// Measures the 10-90% rise time into the peak (A7).
///
/// The baseline is the darkest frame in the second or so before the peak, so
/// the rise is measured from the shot the dip actually started from rather than
/// from an assumed black or from an unrelated dark shot earlier in the window
/// (see `RAMP_BASELINE_WINDOW_SECONDS`). Crossings are linearly interpolated
/// between the bracketing samples: frame quantisation is 0.02-0.04s against a
/// ±0.08s tolerance, so rounding to whole frames would spend a third of the
/// budget on arithmetic rather than on real variation.
///
/// Returns `None` when the peak is the first sample, leaving nothing to rise
/// from.
pub fn measure_ramp(samples: &[LumaSample], peak: usize) -> Option<f64> {
    if peak == 0 || peak >= samples.len() {
        return None;
    }

    let peak_yavg = samples[peak].yavg;
    let baseline_from = samples[peak].at_seconds - RAMP_BASELINE_WINDOW_SECONDS;
    let baseline = samples[..peak]
        .iter()
        .filter(|s| s.at_seconds >= baseline_from)
        .map(|s| s.yavg)
        .fold(f64::INFINITY, f64::min);

    let rise = peak_yavg - baseline;
    if !rise.is_finite() || rise <= 0.0 {
        return None;
    }

    let low_target = baseline + rise * RAMP_RISE_LOW_FRACTION;
    let high_target = baseline + rise * RAMP_RISE_HIGH_FRACTION;

    // Walk back from the peak so a dip that follows earlier bright content is
    // measured from its own approach, not from the first time the video was
    // ever that bright.
    let high_at = crossing_before(samples, peak, high_target)?;
    let low_at = crossing_before(samples, peak, low_target)?;

    Some((high_at - low_at).max(0.0))
}

/// Time at which the samples last crossed `target` on the way up to `peak`.
///
/// Linearly interpolated between the two bracketing samples.
fn crossing_before(samples: &[LumaSample], peak: usize, target: f64) -> Option<f64> {
    let mut index = peak;

    while index > 0 {
        let current = &samples[index];
        let previous = &samples[index - 1];

        if current.yavg >= target && previous.yavg < target {
            let span = current.yavg - previous.yavg;
            let fraction = if span > 0.0 {
                (target - previous.yavg) / span
            } else {
                0.0
            };
            return Some(
                previous.at_seconds + (current.at_seconds - previous.at_seconds) * fraction,
            );
        }

        index -= 1;
    }

    // Never below the target in this window: the rise began before it started.
    samples.first().map(|s| s.at_seconds)
}

/// Checks a tail's structure against the derived model (B5).
///
/// `end_seconds` should come from `VideoProbe::end_seconds`, not the container
/// duration - the whole structure is measured relative to the end, so a 14ms
/// error there shifts every measurement (A7).
pub fn analyse_tail(
    samples: &[LumaSample],
    end_seconds: f64,
    duration_seconds: f64,
) -> TailAnalysis {
    if duration_seconds < TAIL_WINDOW_SECONDS {
        return TailAnalysis {
            peak_at_seconds: None,
            ramp_seconds: None,
            sting_seconds: None,
            trailing_seconds: None,
            problems: vec![TailProblem::VideoTooShort { duration_seconds }],
        };
    }

    let Some(peak) = find_white_peak(samples) else {
        return TailAnalysis {
            peak_at_seconds: None,
            ramp_seconds: None,
            sting_seconds: None,
            trailing_seconds: None,
            problems: vec![TailProblem::NoWhitePeak],
        };
    };

    let peak_at = samples[peak].at_seconds;
    let ramp = measure_ramp(samples, peak);
    let sting = (end_seconds - peak_at).max(0.0);
    let trailing = trailing_after_sting(samples, peak, end_seconds);

    let mut problems = Vec::new();

    match ramp {
        Some(measured) if measured < ramp_min() => problems.push(TailProblem::RampTooShort {
            measured_seconds: measured,
        }),
        Some(measured) if measured > ramp_max() => problems.push(TailProblem::RampTooLong {
            measured_seconds: measured,
        }),
        // No measurable rise at all is the extreme of a hard cut, reported as
        // such rather than passed over silently.
        None => problems.push(TailProblem::RampTooShort {
            measured_seconds: 0.0,
        }),
        _ => {}
    }

    if sting < STING_NOMINAL_SECONDS - STING_TOLERANCE_SECONDS {
        problems.push(TailProblem::StingTooShort {
            measured_seconds: sting,
        });
    } else if sting > STING_NOMINAL_SECONDS + STING_TOLERANCE_SECONDS {
        problems.push(TailProblem::StingTooLong {
            measured_seconds: sting,
        });
    }

    if let Some(trailing_seconds) = trailing {
        if trailing_seconds > TRAILING_TOLERANCE_SECONDS {
            problems.push(TailProblem::DoesNotEndOnSting { trailing_seconds });
        }
    }

    TailAnalysis {
        peak_at_seconds: Some(peak_at),
        ramp_seconds: ramp,
        sting_seconds: Some(sting),
        trailing_seconds: trailing,
        problems,
    }
}

/// How long after the sting stops being on screen the video continues.
///
/// The sting's own brightness sets the bar, so this does not assume a white
/// logo card: the last frame at or above half the settled mean is taken as the
/// last frame showing it. A couple of black frames of export padding leave a
/// trailing figure of a frame or two, which the tolerance absorbs (B5.8).
fn trailing_after_sting(samples: &[LumaSample], peak: usize, end_seconds: f64) -> Option<f64> {
    let after_peak = samples.get(peak + 1..)?;
    if after_peak.is_empty() {
        return None;
    }

    let mut levels: Vec<f64> = after_peak.iter().map(|s| s.yavg).collect();
    levels.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let settled = levels[levels.len() / 2];

    let floor = settled * ON_STING_FRACTION;
    let last_on_sting = after_peak
        .iter()
        .rev()
        .find(|sample| sample.yavg >= floor)
        .map(|sample| sample.at_seconds)?;

    Some((end_seconds - last_on_sting).max(0.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FPS: f64 = 50.0;
    const FRAME: f64 = 1.0 / FPS;
    const CONTENT_YAVG: f64 = 60.0;
    const PEAK_YAVG: f64 = 235.0;
    const STING_YAVG: f64 = 224.8;

    /// Builds the tail A6 derives: content, a linear ramp to white over half a
    /// 1.00s centred transition, then a static sting to the end.
    ///
    /// A linear ramp is what a dissolve produces, so its 10-90% rise is exactly
    /// 80% of the half-transition - 0.400s for the 0.5s here, which is the
    /// figure both measured renders produced.
    fn tail_samples(end: f64, sting_seconds: f64, ramp_seconds: f64) -> Vec<LumaSample> {
        let peak_at = end - sting_seconds;
        let ramp_start = peak_at - ramp_seconds;
        let window_start = end - TAIL_WINDOW_SECONDS;

        let mut samples = Vec::new();
        let mut t = window_start;

        while t <= end + f64::EPSILON {
            let (yavg, ymin) = if t < ramp_start {
                (CONTENT_YAVG, 0.0)
            } else if t <= peak_at {
                // Whole frame whitens together, which is what a dip to white is.
                let progress = if ramp_seconds > 0.0 {
                    ((t - ramp_start) / ramp_seconds).clamp(0.0, 1.0)
                } else {
                    1.0
                };
                (
                    CONTENT_YAVG + (PEAK_YAVG - CONTENT_YAVG) * progress,
                    PEAK_YAVG * progress,
                )
            } else {
                (STING_YAVG, 54.0)
            };

            samples.push(LumaSample {
                at_seconds: (t * 1000.0).round() / 1000.0,
                yavg,
                ymin,
            });
            t += FRAME;
        }

        samples
    }

    fn correct_tail(end: f64) -> Vec<LumaSample> {
        tail_samples(end, STING_NOMINAL_SECONDS, 0.5)
    }

    #[test]
    fn b5_1_locates_the_peak_where_the_white_frame_actually_is() {
        let samples = correct_tail(100.0);
        let analysis = analyse_tail(&samples, 100.0, 100.0);

        // T-5.00s, the cut the 5.00s still begins at (A6).
        let peak = analysis.peak_at_seconds.expect("a peak");
        assert!(
            (peak - 95.0).abs() < FRAME,
            "expected the peak at T-5s, got {}",
            peak
        );
        assert!(analysis.is_sound(), "unexpected {:?}", analysis.problems);
    }

    #[test]
    fn b5_2_detects_a_limited_range_peak_without_consulting_color_range() {
        // 235 is limited-range white, which is what both measured renders coded.
        let samples = correct_tail(100.0);
        assert!(find_white_peak(&samples).is_some());
    }

    #[test]
    fn b5_3_detects_a_full_range_peak() {
        let mut samples = correct_tail(100.0);
        for sample in samples.iter_mut() {
            if sample.yavg >= WHITE_PEAK_YAVG_MIN {
                sample.yavg = 255.0;
                sample.ymin = 255.0;
            }
        }

        assert!(find_white_peak(&samples).is_some());
    }

    #[test]
    fn b5_4_rejects_a_bright_frame_that_is_not_full_frame_white() {
        // High mean, dark pixels still present: a white card over dark footage,
        // or a lighting flash. Brightness alone must not qualify.
        let samples = vec![
            LumaSample {
                at_seconds: 90.0,
                yavg: 60.0,
                ymin: 0.0,
            },
            LumaSample {
                at_seconds: 95.0,
                yavg: 240.0,
                ymin: 5.0,
            },
        ];

        assert_eq!(find_white_peak(&samples), None);
    }

    #[test]
    fn b5_5_names_a_missing_dip_to_white() {
        let samples: Vec<LumaSample> = (0..100)
            .map(|i| LumaSample {
                at_seconds: 88.0 + i as f64 * FRAME,
                yavg: 120.0,
                ymin: 3.0,
            })
            .collect();

        let analysis = analyse_tail(&samples, 100.0, 100.0);

        assert_eq!(analysis.problems, vec![TailProblem::NoWhitePeak]);
        assert_eq!(analysis.peak_at_seconds, None);
    }

    #[test]
    fn b5_6_reports_a_short_sting_with_the_duration_it_measured() {
        let samples = tail_samples(100.0, 2.0, 0.5);
        let analysis = analyse_tail(&samples, 100.0, 100.0);

        let measured = match analysis
            .problems
            .iter()
            .find(|p| matches!(p, TailProblem::StingTooShort { .. }))
        {
            Some(TailProblem::StingTooShort { measured_seconds }) => *measured_seconds,
            other => panic!("expected a short sting, got {:?}", other),
        };

        assert!(
            (measured - 2.0).abs() < 0.05,
            "the measured duration must be reported, got {}",
            measured
        );
        // The number has to reach the operator, not just the category.
        assert!(TailProblem::StingTooShort {
            measured_seconds: measured
        }
        .message()
        .contains("2.00"));
    }

    #[test]
    fn b5_7_reports_a_hard_cut_as_a_missing_ramp() {
        // One frame from content to white is what a cut looks like.
        let samples = tail_samples(100.0, STING_NOMINAL_SECONDS, FRAME);
        let analysis = analyse_tail(&samples, 100.0, 100.0);

        let measured = match analysis
            .problems
            .iter()
            .find(|p| matches!(p, TailProblem::RampTooShort { .. }))
        {
            Some(TailProblem::RampTooShort { measured_seconds }) => *measured_seconds,
            other => panic!("expected a missing ramp, got {:?}", other),
        };

        assert!(
            measured < ramp_min(),
            "a cut must measure below the ramp floor, got {}",
            measured
        );
    }

    #[test]
    fn b5_8_tolerates_a_couple_of_trailing_black_frames() {
        let mut samples = correct_tail(100.0);
        let last = samples.last().expect("samples").at_seconds;
        for i in 1..=2 {
            samples.push(LumaSample {
                at_seconds: last + i as f64 * FRAME,
                yavg: 0.0,
                ymin: 0.0,
            });
        }

        let end = last + 2.0 * FRAME;
        let analysis = analyse_tail(&samples, end, end);

        assert!(
            analysis.is_sound(),
            "two black frames are export padding, not a defect: {:?}",
            analysis.problems
        );
    }

    #[test]
    fn b5_8_still_reports_content_that_runs_on_past_the_sting() {
        let mut samples = correct_tail(100.0);
        let last = samples.last().expect("samples").at_seconds;
        // A whole second of black after the sting is not padding.
        let extra = (1.0 / FRAME) as usize;
        for i in 1..=extra {
            samples.push(LumaSample {
                at_seconds: last + i as f64 * FRAME,
                yavg: 0.0,
                ymin: 0.0,
            });
        }

        let end = last + 1.0;
        let analysis = analyse_tail(&samples, end, end);

        assert!(
            analysis
                .problems
                .iter()
                .any(|p| matches!(p, TailProblem::DoesNotEndOnSting { .. })),
            "expected a trailing-content problem, got {:?}",
            analysis.problems
        );
    }

    #[test]
    fn b5_9_reports_a_video_too_short_to_have_a_tail() {
        let samples = correct_tail(100.0);
        let analysis = analyse_tail(&samples, 8.0, 8.0);

        assert_eq!(
            analysis.problems,
            vec![TailProblem::VideoTooShort {
                duration_seconds: 8.0
            }],
            "a short video must be reported as such rather than analysed partially"
        );
        assert!(analysis.message_mentions_length());
    }

    #[test]
    fn b5_10_offers_no_dip_start_when_no_peak_was_found() {
        let analysis = analyse_tail(&[], 100.0, 100.0);
        assert_eq!(analysis.dip_start_seconds(), None);
    }

    #[test]
    fn the_ramp_measures_the_10_to_90_rise_the_calibration_settled_on() {
        let samples = correct_tail(100.0);
        let peak = find_white_peak(&samples).expect("a peak");
        let ramp = measure_ramp(&samples, peak).expect("a ramp");

        // 80% of a 0.5s half-transition. Both measured renders gave 0.400s.
        assert!(
            (ramp - RAMP_NOMINAL_SECONDS).abs() < 0.03,
            "expected a 0.400s 10-90% rise, got {}",
            ramp
        );
    }

    #[test]
    fn a_dark_shot_earlier_in_the_window_does_not_distort_the_ramp() {
        // Regression: taking the baseline as the darkest frame anywhere in the
        // 12s window put the 10% target below the level the dip started from,
        // so the crossing search walked back past the ramp and measured a
        // multi-second rise on a correct render. Real footage has dark shots.
        let mut samples = correct_tail(100.0);
        for sample in samples.iter_mut() {
            if (89.0..90.0).contains(&sample.at_seconds) {
                sample.yavg = 4.0;
                sample.ymin = 0.0;
            }
        }

        let analysis = analyse_tail(&samples, 100.0, 100.0);

        assert!(
            analysis.is_sound(),
            "a dark shot 6s earlier must not change the ramp: {:?} (ramp {:?})",
            analysis.problems,
            analysis.ramp_seconds
        );
    }

    #[test]
    fn a_two_second_transition_drift_is_caught_as_too_long_a_ramp() {
        // The drift the check exists to find: a 2.00s default gives a 1.0s rise.
        let samples = tail_samples(100.0, STING_NOMINAL_SECONDS, 1.25);
        let analysis = analyse_tail(&samples, 100.0, 100.0);

        assert!(
            analysis
                .problems
                .iter()
                .any(|p| matches!(p, TailProblem::RampTooLong { .. })),
            "expected too long a ramp, got {:?}",
            analysis.problems
        );
    }

    #[test]
    fn the_dip_start_is_where_the_ramp_began_not_where_it_peaked() {
        // The watermark is already fading before white is reached, so a span
        // ending at the peak would report a gap on every correct render (B4.6).
        let samples = correct_tail(100.0);
        let analysis = analyse_tail(&samples, 100.0, 100.0);

        let dip_start = analysis.dip_start_seconds().expect("a dip start");
        let peak = analysis.peak_at_seconds.expect("a peak");

        assert!(
            dip_start < peak,
            "the dip must start before the peak: {} vs {}",
            dip_start,
            peak
        );
        assert!((dip_start - (peak - RAMP_NOMINAL_SECONDS)).abs() < 0.05);
    }

    impl TailAnalysis {
        /// Test helper: does any problem actually say how long the video was?
        fn message_mentions_length(&self) -> bool {
            self.problems.iter().any(|p| p.message().contains("8.0s"))
        }
    }

    /// Real `signalstats` output, from a real H.264 encode.
    ///
    /// The rest of this module's tests generate their samples from the same
    /// model the analysis checks against, which proves the arithmetic but could
    /// not catch the model being wrong about ffmpeg. This fixture was captured
    /// from an actual render built to the A6 structure: 25fps, a 0.5s fade to
    /// white ending at t=15.000, then a 5.00s still. 500 frames at 25fps, so
    /// the true end is exactly 20.000s.
    mod real_output {
        use super::*;
        use crate::kavanagh::parsing::parse_signalstats;

        const CAPTURE: &str = include_str!("testdata/signalstats-tail.txt");
        const END: f64 = 20.0;

        #[test]
        fn the_encode_peaks_at_full_frame_white_where_the_model_says() {
            let samples = parse_signalstats(CAPTURE);
            let peak = find_white_peak(&samples).expect("a white peak");

            assert_eq!(
                samples[peak].at_seconds, 15.0,
                "the cut is at T-5.000s, and the peak is the cut"
            );
            // Limited-range white, whole frame: exactly what D5's thresholds
            // were written for, and what both calibration renders measured.
            assert_eq!(samples[peak].yavg, 235.0);
            assert_eq!(samples[peak].ymin, 235.0);
        }

        #[test]
        fn a_correct_render_passes_every_structural_check() {
            let samples = parse_signalstats(CAPTURE);
            let analysis = analyse_tail(&samples, END, END);

            assert!(
                analysis.is_sound(),
                "a correctly built tail must pass: {:?}",
                analysis.problems
            );
            assert_eq!(analysis.sting_seconds, Some(5.0));
        }

        #[test]
        fn the_measured_ramp_matches_the_calibrated_figure() {
            let samples = parse_signalstats(CAPTURE);
            let peak = find_white_peak(&samples).expect("a white peak");
            let ramp = measure_ramp(&samples, peak).expect("a ramp");

            // A7 settled on 0.400s from two real renders; this encode measures
            // 0.402s, inside a tolerance that exists for frame quantisation.
            assert!(
                (ramp - RAMP_NOMINAL_SECONDS).abs() <= RAMP_TOLERANCE_SECONDS,
                "expected ~{}s, measured {}s",
                RAMP_NOMINAL_SECONDS,
                ramp
            );
        }

        #[test]
        fn the_sting_settles_by_the_offset_identity_is_matched_from() {
            // Why STING_SETTLED_OFFSET_SECONDS is 0.5: the still's first half
            // second is underneath the fade from white, so matching before then
            // compares a part-white frame against the reference JPG.
            let samples = parse_signalstats(CAPTURE);
            let peak = find_white_peak(&samples).expect("a white peak");
            let settled_from = samples[peak].at_seconds
                + crate::kavanagh::thresholds::STING_SETTLED_OFFSET_SECONDS;

            let settled: Vec<f64> = samples
                .iter()
                .filter(|s| s.at_seconds >= settled_from)
                .map(|s| s.yavg)
                .collect();

            let first = settled.first().copied().expect("settled frames");
            assert!(
                settled.iter().all(|y| (y - first).abs() < 0.5),
                "the sting must be static from the settled offset onwards"
            );
        }
    }
}
