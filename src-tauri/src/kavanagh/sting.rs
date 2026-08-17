//! Sting identity and the freeze check (B6).
//!
//! The sting is a static JPG held on screen, which makes both halves of this
//! unusually strong. Identity can be near-exact rather than heuristic, because
//! the reference *is* the asset in the edit and nothing is composited over it.
//! And because a still is held, the frames across the hold must be identical to
//! one another, which catches faults identity alone cannot see: motion left
//! underneath, a stray cut inside the hold, a wrong layer left visible.
//!
//! Both fold into one verdict (D7), with three states rather than two: a
//! structurally correct tail whose logo matches nothing is a **warning**, not a
//! failure, because it usually means a new variant needs adding to the folder
//! (D8).

use serde::Serialize;

use super::matching::weighted_ncc;
use super::thresholds::{STING_FREEZE_MAX_MAD, STING_MATCH_CONFIDENCE};

/// One reference image from the `stings/` pool, greyscale at the comparison
/// scale.
#[derive(Debug, Clone)]
pub struct StingReference {
    /// Absolute path, so the report can name which asset matched.
    pub path: String,
    pub pixels: Vec<u8>,
}

/// What the sting check concluded.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StingOutcome {
    /// A reference in the pool matched across every settled frame.
    Matched,
    /// Structurally a held still, but nothing in the pool matches it (D8).
    Unrecognised,
    /// The frames across the hold are not identical, so it is not a held still.
    NotFrozen,
    /// Nothing to compare against; the pool was empty or unreadable (B6.4).
    PoolUnavailable,
}

/// Everything the sting check measured.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StingReport {
    pub outcome: StingOutcome,
    /// The reference that matched across all frames, when one did.
    pub matched_reference: Option<String>,
    /// The closest reference, whether or not it passed.
    ///
    /// Populated even on a miss: knowing the nearest asset is what separates a
    /// wrong-resolution variant from a completely different logo.
    pub best_reference: Option<String>,
    /// The best reference's weakest score across the settled frames.
    pub best_confidence: f32,
    /// Mean absolute luma difference across the hold; ~0 for a held still.
    pub freeze_mad: Option<f64>,
    pub frames_compared: usize,
    pub threshold: f32,
}

impl StingReport {
    /// A sentence for the report, naming the measurement behind the verdict.
    pub fn message(&self) -> String {
        match self.outcome {
            StingOutcome::Matched => match &self.matched_reference {
                Some(reference) => format!(
                    "The closing sting matches {} at {:.3}.",
                    file_name(reference),
                    self.best_confidence
                ),
                None => "The closing sting matches a reference.".to_string(),
            },
            StingOutcome::Unrecognised => match &self.best_reference {
                Some(reference) => format!(
                    "The tail is a held still, but it matches nothing in the stings folder - closest was {} at {:.3}, below {:.2}. If this is a new sting, add it to the folder.",
                    file_name(reference),
                    self.best_confidence,
                    self.threshold
                ),
                None => "The tail is a held still, but it matches nothing in the stings folder."
                    .to_string(),
            },
            StingOutcome::NotFrozen => format!(
                "The closing frames are not held steady (mean difference {:.2}), so this is not a static sting.",
                self.freeze_mad.unwrap_or_default()
            ),
            StingOutcome::PoolUnavailable => {
                "No sting references are available, so the closing logo could not be identified."
                    .to_string()
            }
        }
    }

    /// Whether this outcome should fail a run, as opposed to warn on it (D8).
    pub fn is_failure(&self) -> bool {
        matches!(self.outcome, StingOutcome::NotFrozen)
    }
}

/// Trims a path to its file name for display.
fn file_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

/// Mean absolute difference between consecutive frames, in luma units.
///
/// Consecutive rather than all-pairs: a drift across the hold shows up either
/// way, and a stray cut in the middle shows up more sharply between neighbours.
/// `None` when there are fewer than two frames, since one frame cannot be shown
/// to be held.
pub fn freeze_mad(frames: &[Vec<u8>]) -> Option<f64> {
    if frames.len() < 2 {
        return None;
    }

    let mut total = 0.0f64;
    let mut pairs = 0usize;

    for window in frames.windows(2) {
        let (a, b) = (&window[0], &window[1]);
        let n = a.len().min(b.len());
        if n == 0 {
            continue;
        }

        let sum: f64 = (0..n)
            .map(|i| (f64::from(a[i]) - f64::from(b[i])).abs())
            .sum();

        total += sum / n as f64;
        pairs += 1;
    }

    (pairs > 0).then(|| total / pairs as f64)
}

/// Correlates two greyscale images, in `[-1, 1]`.
///
/// Uniform weights over the shared correlation routine rather than a second
/// implementation of the same statistic - the weighting exists for the
/// watermark's alpha mask and simply is not needed here.
pub fn luma_ncc(a: &[u8], b: &[u8]) -> f32 {
    let n = a.len().min(b.len());
    if n == 0 {
        return 0.0;
    }

    let left: Vec<f32> = a[..n].iter().map(|v| f32::from(*v)).collect();
    let right: Vec<f32> = b[..n].iter().map(|v| f32::from(*v)).collect();
    let weights = vec![1.0f32; n];

    weighted_ncc(&left, &right, &weights)
}

/// The best reference across every settled frame, and its weakest score.
///
/// A reference identifies the sting only if it matches **every** sampled frame,
/// so the score carried is its worst, not its best. Scoring on the best frame
/// would let a tail that is only briefly right pass on one lucky sample (B6.7);
/// the sting is a held still, so if a reference is the sting it matches all of
/// them.
pub fn identify<'a>(
    frames: &[Vec<u8>],
    references: &'a [StingReference],
) -> Option<(&'a StingReference, f32)> {
    if frames.is_empty() {
        return None;
    }

    references
        .iter()
        .map(|reference| {
            let weakest = frames
                .iter()
                .map(|frame| luma_ncc(frame, &reference.pixels))
                .fold(f32::INFINITY, f32::min);
            (reference, weakest)
        })
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
}

/// Judges the settled sting frames: held still first, then which sting it is.
///
/// Freeze is checked before identity deliberately. A tail that is not a held
/// still is wrong whatever it happens to correlate with, and reporting "matches
/// the 2019 sting" about moving footage would be actively misleading.
pub fn assess(frames: &[Vec<u8>], references: &[StingReference], threshold: f32) -> StingReport {
    let mad = freeze_mad(frames);
    let frames_compared = frames.len();

    if let Some(measured) = mad {
        if measured > STING_FREEZE_MAX_MAD {
            return StingReport {
                outcome: StingOutcome::NotFrozen,
                matched_reference: None,
                best_reference: None,
                best_confidence: 0.0,
                freeze_mad: mad,
                frames_compared,
                threshold,
            };
        }
    }

    let best = identify(frames, references);

    match best {
        None => StingReport {
            outcome: StingOutcome::PoolUnavailable,
            matched_reference: None,
            best_reference: None,
            best_confidence: 0.0,
            freeze_mad: mad,
            frames_compared,
            threshold,
        },
        Some((reference, confidence)) if confidence >= threshold => StingReport {
            outcome: StingOutcome::Matched,
            matched_reference: Some(reference.path.clone()),
            best_reference: Some(reference.path.clone()),
            best_confidence: confidence,
            freeze_mad: mad,
            frames_compared,
            threshold,
        },
        Some((reference, confidence)) => StingReport {
            outcome: StingOutcome::Unrecognised,
            matched_reference: None,
            best_reference: Some(reference.path.clone()),
            best_confidence: confidence,
            freeze_mad: mad,
            frames_compared,
            threshold,
        },
    }
}

/// The calibrated sting threshold, for callers with no override to apply.
pub fn default_threshold() -> f32 {
    STING_MATCH_CONFIDENCE
}

#[cfg(test)]
mod tests {
    use super::*;

    const W: usize = 64;
    const H: usize = 36;

    /// A "logo": a filled block on a flat field, at a given position.
    fn logo(offset_x: usize, value: u8) -> Vec<u8> {
        let mut pixels = vec![30u8; W * H];
        for y in 8..H - 8 {
            for x in (8 + offset_x)..(28 + offset_x).min(W) {
                pixels[y * W + x] = value;
            }
        }
        pixels
    }

    /// The same image with a little encode noise on it.
    fn with_noise(base: &[u8], amplitude: i16) -> Vec<u8> {
        base.iter()
            .enumerate()
            .map(|(i, v)| {
                let wobble = if i % 2 == 0 { amplitude } else { -amplitude };
                (i16::from(*v) + wobble).clamp(0, 255) as u8
            })
            .collect()
    }

    fn reference(path: &str, pixels: Vec<u8>) -> StingReference {
        StingReference {
            path: path.to_string(),
            pixels,
        }
    }

    #[test]
    fn b6_1_passes_naming_the_reference_that_matched() {
        let sting = logo(0, 200);
        let frames = vec![sting.clone(), sting.clone(), sting.clone()];
        let pool = vec![reference("/refs/stings/current.jpg", sting)];

        let report = assess(&frames, &pool, default_threshold());

        assert_eq!(report.outcome, StingOutcome::Matched);
        assert_eq!(
            report.matched_reference.as_deref(),
            Some("/refs/stings/current.jpg")
        );
        assert!(report.message().contains("current.jpg"));
    }

    #[test]
    fn b6_2_an_unmatched_logo_warns_rather_than_fails() {
        let frames = vec![logo(0, 200), logo(0, 200)];
        let pool = vec![reference("/refs/stings/other.jpg", logo(30, 200))];

        let report = assess(&frames, &pool, default_threshold());

        assert_eq!(report.outcome, StingOutcome::Unrecognised);
        assert!(
            !report.is_failure(),
            "an unrecognised sting is housekeeping, not a broken video (D8)"
        );
        // The nearest asset is named, so the operator knows what to compare.
        assert_eq!(
            report.best_reference.as_deref(),
            Some("/refs/stings/other.jpg")
        );
    }

    #[test]
    fn b6_3_any_reference_in_the_pool_may_match() {
        let third = logo(20, 210);
        let frames = vec![third.clone(), third.clone()];
        let pool = vec![
            reference("/refs/stings/a.jpg", logo(0, 200)),
            reference("/refs/stings/b.jpg", logo(10, 120)),
            reference("/refs/stings/c.jpg", third),
        ];

        let report = assess(&frames, &pool, default_threshold());

        assert_eq!(report.outcome, StingOutcome::Matched);
        assert_eq!(report.matched_reference.as_deref(), Some("/refs/stings/c.jpg"));
    }

    #[test]
    fn b6_4_an_empty_pool_is_reported_distinctly_and_still_measures_the_hold() {
        let sting = logo(0, 200);
        let frames = vec![sting.clone(), sting];

        let report = assess(&frames, &[], default_threshold());

        assert_eq!(report.outcome, StingOutcome::PoolUnavailable);
        assert!(
            report.freeze_mad.is_some(),
            "the structural half must still be measured when identity cannot be (B6.4)"
        );
        assert!(!report.is_failure());
    }

    #[test]
    fn b6_5_frames_that_differ_materially_are_not_a_held_still() {
        let frames = vec![logo(0, 200), logo(25, 200), logo(0, 200)];
        let pool = vec![reference("/refs/stings/current.jpg", logo(0, 200))];

        let report = assess(&frames, &pool, default_threshold());

        assert_eq!(report.outcome, StingOutcome::NotFrozen);
        assert!(report.is_failure());
        assert!(report.message().contains("not held steady"));
    }

    #[test]
    fn b6_6_encode_noise_does_not_break_the_freeze_check() {
        let sting = logo(0, 200);
        let frames = vec![
            with_noise(&sting, 1),
            with_noise(&sting, -1),
            with_noise(&sting, 1),
        ];
        let pool = vec![reference("/refs/stings/current.jpg", sting)];

        let report = assess(&frames, &pool, default_threshold());

        assert_eq!(
            report.outcome,
            StingOutcome::Matched,
            "a held JPG re-encoded per frame is still held (mad {:?})",
            report.freeze_mad
        );
    }

    #[test]
    fn b6_7_a_reference_must_match_every_frame_not_just_one() {
        let sting = logo(0, 200);
        // One frame is the sting, the other is something else entirely.
        let frames = vec![sting.clone(), logo(30, 90)];
        let pool = vec![reference("/refs/stings/current.jpg", sting)];

        let (_, weakest) = identify(&frames, &pool).expect("a candidate");

        assert!(
            weakest < default_threshold(),
            "identity must be carried by the worst frame, not the best: got {}",
            weakest
        );
    }

    #[test]
    fn a_single_frame_cannot_be_shown_to_be_held() {
        assert_eq!(freeze_mad(&[vec![1, 2, 3]]), None);
    }

    #[test]
    fn identical_frames_measure_no_movement_at_all() {
        let frame = logo(0, 200);
        let mad = freeze_mad(&[frame.clone(), frame]).expect("a measurement");

        assert!(mad.abs() < f64::EPSILON, "expected 0.0, got {}", mad);
    }
}
