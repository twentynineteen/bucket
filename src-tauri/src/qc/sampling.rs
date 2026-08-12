//! Sampling, refinement and gap reporting (issue #180, stage 2, B4).
//!
//! The watermark span is sampled coarsely in one decode pass. Where a coarse
//! sample misses, only that neighbourhood is decoded again at a fine interval,
//! and the absence is reported as a **time range built from real `pts_time`
//! values** rather than as the single coarse timestamp that happened to fail.
//!
//! Two rules the design rejected, recorded here because both are tempting:
//!
//! - *Any miss fails.* One bright sky or one compression artefact would then fail
//!   a correct render, and the operator learns to ignore the check.
//! - *A percentage tolerance.* Blind to clustering: 5% of a long video hides a
//!   continuous 30-second gap, which is exactly the defect being hunted.
//!
//! What replaces them is a minimum gap duration. An absence too short to be a
//! real fault is noise; anything longer is reported in full.
//!
//! **Known limitation of coarse-then-refine.** An absence shorter than the coarse
//! interval can fall entirely between two coarse samples and never be looked at.
//! With a ten-second coarse interval, a five-second gap is caught only if a sample
//! happens to land in it. This is inherent to sampling rather than a defect, and it
//! is the trade the design accepted for one decode pass over a two-hour render.
//! Shortening the coarse interval narrows the blind spot at a proportional cost in
//! decode time.

use serde::Serialize;

use super::geometry::Corner;

/// One sampled frame's outcome, at the timestamp ffmpeg actually reported.
#[derive(Debug, Clone, PartialEq)]
pub struct Sample {
    pub time_seconds: f64,
    /// The corner the mark was found in, or `None` when the sample missed.
    pub corner: Option<Corner>,
    pub confidence: f32,
    /// The reference that scored best, so the report can name what matched.
    pub reference: Option<String>,
}

impl Sample {
    pub fn matched(&self) -> bool {
        self.corner.is_some()
    }
}

/// A contiguous absence of the watermark, as a real time range.
///
/// Carries the best score seen inside it, and which reference produced that score,
/// so a reviewer can tell a near miss from nothing at all without re-running
/// anything. On real footage this is the difference between "the threshold is wrong"
/// and "the watermark is genuinely absent", and the two need different fixes.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Gap {
    pub start_seconds: f64,
    pub end_seconds: f64,
    /// The highest score any reference reached anywhere inside the gap.
    pub best_confidence: f32,
    /// Which reference reached it.
    pub best_reference: Option<String>,
}

/// A sample that found the mark in the wrong corner (B3.7).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CornerChange {
    pub at_seconds: f64,
    pub expected: Corner,
    pub found: Corner,
}

/// The stretch of the video the watermark is expected over.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub start_seconds: f64,
    pub end_seconds: f64,
    /// True when the end was assumed rather than measured, because the dip to
    /// white had not been located. The report has to say so (B5.10).
    pub approximated: bool,
}

impl Span {
    pub fn duration(&self) -> f64 {
        (self.end_seconds - self.start_seconds).max(0.0)
    }
}

/// Computes the span the watermark is checked over.
///
/// Checked from the very first frame: the user confirmed the mark is present from
/// frame one, so there is no opening grace period and a missing mark at the head
/// fails loudly (D11).
///
/// The end is the start of the dip to white, since the mark cannot survive a
/// full-white frame and is not expected over the sting. **Stage 2 has no tail
/// analysis**, so `dip_start` is always `None` today and the span falls back to
/// `duration - tail_window`, flagged as approximated. Stage 3 wires the measured
/// dip start into this same argument and the flag turns off (B4.6, B5.10).
pub fn watermark_span(duration_seconds: f64, dip_start: Option<f64>, tail_window: f64) -> Span {
    if let Some(dip) = dip_start {
        if dip > 0.0 && dip <= duration_seconds {
            return Span {
                start_seconds: 0.0,
                end_seconds: dip,
                approximated: false,
            };
        }
    }

    let fallback = duration_seconds - tail_window;
    if fallback > 0.0 {
        return Span {
            start_seconds: 0.0,
            end_seconds: fallback,
            approximated: true,
        };
    }

    // Shorter than the tail window. Reporting nothing checked would be worse than
    // checking the whole thing and saying the span was approximated; the "too
    // short to analyse" verdict itself belongs to the tail check (B5.9, stage 3).
    Span {
        start_seconds: 0.0,
        end_seconds: duration_seconds.max(0.0),
        approximated: true,
    }
}

/// Timestamps to sample at a fixed interval across a span.
///
/// The span end is exclusive, so no sample lands at or after the dip start: a
/// frame that is legitimately mid-fade must never be counted as a watermark
/// failure (B4.6).
pub fn sample_times(span: &Span, interval: f64) -> Vec<f64> {
    if interval <= 0.0 || span.duration() <= 0.0 {
        return vec![];
    }

    let mut times = Vec::new();
    let mut t = span.start_seconds;
    while t < span.end_seconds {
        times.push(t);
        t += interval;
    }
    times
}

/// Neighbourhoods to re-decode at the fine interval, one per run of adjacent
/// coarse misses.
///
/// Each window reaches one coarse interval either side of the missing samples, so
/// the fine pass sees the passing frames that bracket the absence and can place
/// its real boundaries. Adjacent misses collapse into a single window rather than
/// spawning a decode pass each.
pub fn refinement_windows(
    samples: &[Sample],
    coarse_interval: f64,
    span: &Span,
) -> Vec<(f64, f64)> {
    let mut windows: Vec<(f64, f64)> = Vec::new();

    for sample in samples.iter().filter(|s| !s.matched()) {
        let start = (sample.time_seconds - coarse_interval).max(span.start_seconds);
        let end = (sample.time_seconds + coarse_interval).min(span.end_seconds);

        match windows.last_mut() {
            // Overlapping or touching windows are one window: refining the same
            // seconds twice costs a whole extra decode pass and reports the same
            // absence twice.
            Some(last) if start <= last.1 => last.1 = last.1.max(end),
            _ => windows.push((start, end)),
        }
    }

    windows
}

/// Collapses fine samples into one gap per contiguous absence.
///
/// The boundaries are the first and last missing sample's own timestamps, both
/// real `pts_time` values. That under-states the absence by up to one fine
/// interval at each end, which is the conservative direction: every second
/// reported is a second the mark was genuinely measured absent.
///
/// A run shorter than `min_gap_seconds` is discarded as noise. This is what stops
/// a single bright frame or a compression artefact from failing a correct render,
/// and it is why an isolated coarse miss whose fine neighbours pass reports
/// nothing (B4.3).
pub fn coalesce_gaps(samples: &[Sample], min_gap_seconds: f64) -> Vec<Gap> {
    let mut ordered: Vec<&Sample> = samples.iter().collect();
    ordered.sort_by(|a, b| a.time_seconds.total_cmp(&b.time_seconds));

    let mut gaps = Vec::new();
    let mut run: Option<Run> = None;

    for sample in ordered {
        if sample.matched() {
            if let Some(finished) = run.take() {
                push_gap(&mut gaps, finished, min_gap_seconds);
            }
            continue;
        }

        run = match run {
            Some(mut open) => {
                open.end = sample.time_seconds;
                open.observe(sample);
                Some(open)
            }
            None => {
                let mut open = Run {
                    start: sample.time_seconds,
                    end: sample.time_seconds,
                    best_confidence: f32::NEG_INFINITY,
                    best_reference: None,
                };
                open.observe(sample);
                Some(open)
            }
        };
    }

    if let Some(finished) = run {
        push_gap(&mut gaps, finished, min_gap_seconds);
    }

    gaps
}

/// A run of consecutive missing samples, with the best score seen in it.
struct Run {
    start: f64,
    end: f64,
    best_confidence: f32,
    best_reference: Option<String>,
}

impl Run {
    fn observe(&mut self, sample: &Sample) {
        if sample.confidence > self.best_confidence {
            self.best_confidence = sample.confidence;
            self.best_reference = sample.reference.clone();
        }
    }
}

fn push_gap(gaps: &mut Vec<Gap>, run: Run, min_gap_seconds: f64) {
    if run.end - run.start >= min_gap_seconds {
        gaps.push(Gap {
            start_seconds: run.start,
            end_seconds: run.end,
            best_confidence: if run.best_confidence.is_finite() {
                run.best_confidence
            } else {
                0.0
            },
            best_reference: run.best_reference,
        });
    }
}

/// The corner the watermark occupies, taken from the earliest samples.
///
/// A majority of the first few matched samples rather than the very first one: a
/// single spurious match in the wrong corner would otherwise define the corner
/// every later sample is judged against, and turn one bad frame into a
/// corner-change failure for the whole video.
pub fn establish_corner(samples: &[Sample], establishing_samples: usize) -> Option<Corner> {
    let mut left = 0usize;
    let mut right = 0usize;

    for corner in samples
        .iter()
        .filter_map(|s| s.corner)
        .take(establishing_samples.max(1))
    {
        match corner {
            Corner::TopLeft => left += 1,
            Corner::TopRight => right += 1,
        }
    }

    match (left, right) {
        (0, 0) => None,
        (l, r) if l >= r => Some(Corner::TopLeft),
        _ => Some(Corner::TopRight),
    }
}

/// Samples that found the mark in a corner other than the established one.
///
/// A mid-video corner change is very unlikely, which is exactly why it is worth
/// failing on: it means a repositioned layer or a render spliced from two
/// versions (D11).
pub fn corner_changes(samples: &[Sample], established: Corner) -> Vec<CornerChange> {
    samples
        .iter()
        .filter_map(|sample| match sample.corner {
            Some(found) if found != established => Some(CornerChange {
                at_seconds: sample.time_seconds,
                expected: established,
                found,
            }),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(t: f64) -> Sample {
        Sample {
            time_seconds: t,
            corner: Some(Corner::TopRight),
            confidence: 0.98,
            reference: Some("WBS_Watermark_BlackRight.png".to_string()),
        }
    }

    fn miss(t: f64) -> Sample {
        Sample {
            time_seconds: t,
            corner: None,
            confidence: 0.01,
            reference: None,
        }
    }

    #[test]
    fn b4_1_reports_no_gap_when_every_sample_matched() {
        let samples: Vec<Sample> = (0..12).map(|i| hit(f64::from(i) * 10.0)).collect();

        assert_eq!(coalesce_gaps(&samples, 1.0), vec![]);
    }

    #[test]
    fn b4_2_reports_a_gap_as_a_range_of_real_sample_timestamps() {
        // The 04:12 - 04:31 case from the behaviour, sampled at the fine interval.
        let mut samples = vec![hit(250.5), hit(251.0)];
        let mut t = 252.0;
        while t <= 271.0 {
            samples.push(miss(t));
            t += 0.5;
        }
        samples.push(hit(271.5));

        let gaps = coalesce_gaps(&samples, 1.0);

        assert_eq!(gaps.len(), 1);
        assert_eq!(gaps[0].start_seconds, 252.0);
        assert_eq!(gaps[0].end_seconds, 271.0);
    }

    #[test]
    fn a_gap_carries_the_best_score_seen_inside_it_and_what_produced_it() {
        // The difference between "the threshold is wrong" and "the watermark is
        // genuinely absent" is exactly this number, and the two need different fixes.
        // Two real renders score 0.983 and 0.389 for equally visible watermarks, so a
        // gap reported without its score is an argument nobody can settle.
        let samples = vec![
            hit(0.0),
            Sample {
                time_seconds: 1.0,
                corner: None,
                confidence: 0.12,
                reference: Some("WBS_Watermark_BlackRight.png".to_string()),
            },
            Sample {
                time_seconds: 2.0,
                corner: None,
                confidence: 0.38,
                reference: Some("WBS_Watermark_BlackRight_4K.png".to_string()),
            },
            Sample {
                time_seconds: 3.0,
                corner: None,
                confidence: 0.04,
                reference: Some("WBS_Watermark_WhiteLeft.png".to_string()),
            },
            hit(4.0),
        ];

        let gaps = coalesce_gaps(&samples, 1.0);

        assert_eq!(gaps.len(), 1);
        assert_eq!(gaps[0].best_confidence, 0.38);
        assert_eq!(
            gaps[0].best_reference.as_deref(),
            Some("WBS_Watermark_BlackRight_4K.png"),
            "the near miss is the one worth naming, not the last sample"
        );
    }

    #[test]
    fn b4_3_reports_nothing_for_an_isolated_miss_whose_neighbours_pass() {
        // One failing fine sample surrounded by matches. Reporting this would fail
        // a correct render on one compression artefact.
        let samples = vec![hit(9.0), hit(9.5), miss(10.0), hit(10.5), hit(11.0)];

        assert_eq!(coalesce_gaps(&samples, 1.0), vec![]);
    }

    #[test]
    fn b4_4_reports_two_separate_gaps_as_distinct_ranges() {
        let samples = vec![
            hit(0.0),
            miss(1.0),
            miss(2.0),
            miss(3.0),
            hit(4.0),
            hit(5.0),
            miss(6.0),
            miss(7.0),
            miss(8.0),
            hit(9.0),
        ];

        let gaps = coalesce_gaps(&samples, 1.0);

        assert_eq!(gaps.len(), 2, "got {:?}", gaps);
        assert_eq!(gaps[0].start_seconds, 1.0);
        assert_eq!(gaps[0].end_seconds, 3.0);
        assert_eq!(gaps[1].start_seconds, 6.0);
        assert_eq!(gaps[1].end_seconds, 8.0);
    }

    #[test]
    fn b4_5_reports_one_gap_covering_the_span_not_one_per_sample() {
        let samples: Vec<Sample> = (0..40).map(|i| miss(f64::from(i) * 0.5)).collect();

        let gaps = coalesce_gaps(&samples, 1.0);

        assert_eq!(gaps.len(), 1, "got {:?}", gaps);
        assert_eq!(gaps[0].start_seconds, 0.0);
        assert_eq!(gaps[0].end_seconds, 19.5);
    }

    #[test]
    fn b4_6_never_samples_at_or_after_the_span_end() {
        let span = Span {
            start_seconds: 0.0,
            end_seconds: 10.0,
            approximated: false,
        };

        let times = sample_times(&span, 2.5);

        assert_eq!(times, vec![0.0, 2.5, 5.0, 7.5]);
        assert!(
            times.iter().all(|t| *t < span.end_seconds),
            "a frame at or after the dip start must never be judged"
        );
    }

    #[test]
    fn b4_6_starts_at_the_first_frame_with_no_grace_period() {
        let span = watermark_span(60.0, Some(48.0), 12.0);

        assert_eq!(span.start_seconds, 0.0);
        assert_eq!(span.end_seconds, 48.0);
        assert!(
            !span.approximated,
            "a measured dip start is not an assumption"
        );
    }

    #[test]
    fn b5_10_falls_back_to_the_tail_window_and_says_it_approximated() {
        let span = watermark_span(144.0, None, 12.0);

        assert_eq!(span.end_seconds, 132.0);
        assert!(
            span.approximated,
            "the report has to state that the span was approximated"
        );
    }

    #[test]
    fn falls_back_to_the_whole_duration_when_shorter_than_the_tail_window() {
        let span = watermark_span(8.0, None, 12.0);

        assert_eq!(span.end_seconds, 8.0);
        assert!(span.approximated);
    }

    #[test]
    fn refinement_merges_adjacent_misses_into_one_window() {
        let span = Span {
            start_seconds: 0.0,
            end_seconds: 100.0,
            approximated: false,
        };
        let samples = vec![hit(0.0), miss(10.0), miss(20.0), hit(30.0), miss(70.0)];

        let windows = refinement_windows(&samples, 10.0, &span);

        assert_eq!(
            windows,
            vec![(0.0, 30.0), (60.0, 80.0)],
            "adjacent misses share one decode pass"
        );
    }

    #[test]
    fn refinement_windows_stay_inside_the_span() {
        // Two windows that merely touch are merged: one pass over 25s costs less
        // than two over 10s and 15s, and the matched footage in between is
        // re-sampled at the fine interval, which ends the run properly rather than
        // inventing a gap across it.
        let span = Span {
            start_seconds: 0.0,
            end_seconds: 25.0,
            approximated: true,
        };
        let samples = vec![miss(0.0), hit(10.0), miss(20.0)];

        let windows = refinement_windows(&samples, 10.0, &span);

        assert_eq!(windows, vec![(0.0, 25.0)]);
        assert!(
            windows.iter().all(|(_, end)| *end <= span.end_seconds),
            "no refinement pass may read past the span end"
        );
    }

    #[test]
    fn b3_7_reports_a_later_corner_change_with_its_timestamp() {
        let samples = vec![
            hit(0.0),
            hit(10.0),
            hit(20.0),
            Sample {
                time_seconds: 30.0,
                corner: Some(Corner::TopLeft),
                confidence: 0.97,
                reference: Some("WBS_Watermark_BlackLeft.png".to_string()),
            },
        ];
        let established = establish_corner(&samples, 3).expect("the early samples establish it");

        assert_eq!(established, Corner::TopRight);

        let changes = corner_changes(&samples, established);

        assert_eq!(
            changes,
            vec![CornerChange {
                at_seconds: 30.0,
                expected: Corner::TopRight,
                found: Corner::TopLeft
            }]
        );
    }

    #[test]
    fn a_single_spurious_early_match_does_not_define_the_corner() {
        // One wrong-corner match among the establishing samples must not redefine
        // the corner, or every later correct sample becomes a corner change.
        let samples = vec![
            Sample {
                time_seconds: 0.0,
                corner: Some(Corner::TopLeft),
                confidence: 0.86,
                reference: Some("WBS_Watermark_BlackLeft.png".to_string()),
            },
            hit(10.0),
            hit(20.0),
            hit(30.0),
        ];

        let established = establish_corner(&samples, 3).unwrap();

        assert_eq!(established, Corner::TopRight);
        assert_eq!(
            corner_changes(&samples, established).len(),
            1,
            "the one odd sample is the change, not the other three"
        );
    }

    #[test]
    fn no_corner_is_established_when_nothing_matched() {
        let samples = vec![miss(0.0), miss(10.0)];

        assert_eq!(establish_corner(&samples, 3), None);
    }
}
