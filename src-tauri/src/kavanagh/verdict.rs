//! The single verdict a run reduces to (B7).
//!
//! Three states here, four on the wire. A run that could not judge the video at
//! all - missing ffmpeg, an unreadable file - never reaches this function: it is
//! the `Err` arm of the command's `Result`, and the frontend renders it as a
//! fourth `error` state distinct from `fail` (B7.4). Declaring an `Error`
//! variant here would be a variant nothing could ever construct.
//!
//! Warnings exist for the one case that is housekeeping rather than a defect: a
//! structurally correct tail whose logo is not in the references folder (D8).

use serde::Serialize;

use super::sting::{StingOutcome, StingReport};
use super::tail::TailAnalysis;
use super::watermark::WatermarkOutcome;

/// What a whole run concluded.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Verdict {
    Pass,
    /// Nothing is broken, but something needs a human's attention.
    Warning,
    Fail,
}

/// Combines the two checks into one verdict.
///
/// Every input keeps its own result in the report regardless of what comes out
/// here (B7.2): a failing watermark must not hide what the tail did, or an
/// operator fixes one fault, re-runs, and discovers the next one (D9).
///
/// `sting` is `None` when there was no white peak to locate a sting from. That
/// only happens alongside a tail failure, and is a failure in its own right
/// rather than an absence to pass over: a video whose closing logo was never
/// looked at has not been checked.
pub fn overall(
    watermark: WatermarkOutcome,
    tail: &TailAnalysis,
    sting: Option<&StingReport>,
) -> Verdict {
    let sting_failed = sting.map(|s| s.is_failure()).unwrap_or(true);
    if watermark == WatermarkOutcome::Fail || !tail.is_sound() || sting_failed {
        return Verdict::Fail;
    }

    match sting.map(|s| s.outcome) {
        Some(StingOutcome::Unrecognised) | Some(StingOutcome::PoolUnavailable) => Verdict::Warning,
        Some(StingOutcome::Matched) => Verdict::Pass,
        // Both unreachable above, and left explicit rather than folded into a
        // catch-all so a new outcome has to be classified here to compile.
        Some(StingOutcome::NotFrozen) | None => Verdict::Fail,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kavanagh::tail::{TailAnalysis, TailProblem};

    fn sound_tail() -> TailAnalysis {
        TailAnalysis {
            peak_at_seconds: Some(95.0),
            ramp_seconds: Some(0.4),
            sting_seconds: Some(5.0),
            trailing_seconds: Some(0.0),
            problems: Vec::new(),
        }
    }

    fn broken_tail() -> TailAnalysis {
        TailAnalysis {
            peak_at_seconds: None,
            ramp_seconds: None,
            sting_seconds: None,
            trailing_seconds: None,
            problems: vec![TailProblem::NoWhitePeak],
        }
    }

    fn sting(outcome: StingOutcome) -> StingReport {
        StingReport {
            outcome,
            matched_reference: None,
            best_reference: None,
            best_confidence: 0.99,
            freeze_mad: Some(0.0),
            frames_compared: 3,
            threshold: 0.95,
        }
    }

    #[test]
    fn b7_1_passes_when_both_checks_pass() {
        assert_eq!(
            overall(
                WatermarkOutcome::Pass,
                &sound_tail(),
                Some(&sting(StingOutcome::Matched))
            ),
            Verdict::Pass
        );
    }

    #[test]
    fn b7_2_a_failing_watermark_fails_the_run_without_erasing_the_tail_result() {
        let tail = sound_tail();
        let sting = sting(StingOutcome::Matched);

        assert_eq!(
            overall(WatermarkOutcome::Fail, &tail, Some(&sting)),
            Verdict::Fail
        );
        // The point of B7.2: the other half is still there to be reported.
        assert!(tail.is_sound());
        assert_eq!(sting.outcome, StingOutcome::Matched);
    }

    #[test]
    fn b7_3_an_unrecognised_sting_warns_and_is_neither_pass_nor_fail() {
        let verdict = overall(
            WatermarkOutcome::Pass,
            &sound_tail(),
            Some(&sting(StingOutcome::Unrecognised)),
        );

        assert_eq!(verdict, Verdict::Warning);
        assert_ne!(verdict, Verdict::Pass);
        assert_ne!(verdict, Verdict::Fail);
    }

    #[test]
    fn a_broken_tail_fails_the_run_even_with_a_perfect_watermark() {
        assert_eq!(
            overall(
                WatermarkOutcome::Pass,
                &broken_tail(),
                Some(&sting(StingOutcome::Matched))
            ),
            Verdict::Fail
        );
    }

    #[test]
    fn a_sting_that_is_not_held_fails_rather_than_warns() {
        assert_eq!(
            overall(
                WatermarkOutcome::Pass,
                &sound_tail(),
                Some(&sting(StingOutcome::NotFrozen))
            ),
            Verdict::Fail
        );
    }

    #[test]
    fn a_sting_that_was_never_located_cannot_pass() {
        // No white peak means nothing located the closing logo, so there is no
        // basis for a pass even though no sting check actively failed.
        assert_eq!(
            overall(WatermarkOutcome::Pass, &broken_tail(), None),
            Verdict::Fail
        );
    }

    #[test]
    fn an_unavailable_pool_warns_rather_than_passing_silently() {
        // Passing here would report a green tick on a video whose logo nobody
        // checked, which is the failure mode worth being loud about.
        assert_eq!(
            overall(
                WatermarkOutcome::Pass,
                &sound_tail(),
                Some(&sting(StingOutcome::PoolUnavailable))
            ),
            Verdict::Warning
        );
    }
}
