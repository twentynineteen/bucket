//! Upload supervisor: stall detection, soft warnings and cancellation.
//!
//! Detection lives outside the upload task for three reasons the frontend cannot
//! match: it can stop the transfer, it knows the byte offset, and it can measure
//! a rate rather than an event gap. See issue #204.

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

use crate::build_project::OperationRegistry;

use super::transfer::{
    stall_message, stall_warning_message, warning_transition, TerminalGate, UploadProgress,
    UploadStallWarningEvent, WarningTransition,
};

/// How often the watchdog samples progress. Cheap: two atomic loads.
const STALL_POLL_INTERVAL: Duration = Duration::from_secs(1);

/// How long a transfer may fail to advance before it is called stalled.
///
/// The binding constraint is not the gap between chunks, it is the longest
/// silence a *recoverable* TCP connection can produce. RFC 6298 doubles the
/// retransmission timeout from a 1s minimum, so six consecutive retransmissions
/// put 1+2+4+8+16+32 = 63s between the last acknowledged byte and recovery, and
/// macOS keeps retransmitting well past six. Reporting a stall inside that window
/// means a Wi-Fi roam or a VPN re-establish costs the user a multi-gigabyte
/// upload, so the threshold sits just above the backoff ceiling with margin for
/// the client-side buffer that has to fill before source-read silence begins to
/// track wire silence.
///
/// Chunk gaps are nowhere near this: the stream pulls 64 KB per read, so the
/// steady-state gap is 64 KB / bandwidth -- 32ms at 2 MB/s, 3.2s even at an
/// abysmal 20 KB/s.
///
/// If false stalls are ever observed in the wild, raise this rather than removing
/// the check. See issue #204.
pub const STALL_WINDOW: Duration = Duration::from_secs(70);

/// The advance that counts as headway and restarts the window.
///
/// A bare "no bytes for N seconds" gap timer is defeated by a trickle: a dying
/// connection that moves one byte every 20s resets such a timer forever while
/// never completing. Requiring 1 MiB per window puts the floor at ~15 KB/s, well
/// below any bandwidth on which a multi-gigabyte upload could plausibly finish
/// and far above a trickle. A gap timer is the degenerate case of this test with
/// the minimum set to one byte, so generalising costs nothing.
pub const STALL_MIN_PROGRESS_BYTES: u64 = 1024 * 1024;

/// When the non-terminal "this looks stalled" warning is raised.
///
/// The terminal verdict at `STALL_WINDOW` answers "is it dead?"; the question a
/// user actually has while watching a frozen bar is "wait, or cancel?", and until
/// #225 nothing answered that before the transfer was already over. Half the
/// window gives the user the whole second half to act on it.
///
/// Derived from `STALL_WINDOW` rather than written as its own literal, so raising
/// one cannot silently leave the other behind. Note the contrast with #154, which
/// declined a soft warning below the 5 GB limit because warning about a
/// legitimately uploadable file is noise: a stall is not a legitimate state. The
/// warning is non-terminal precisely because a recoverable TCP backoff *is*
/// legitimate for tens of seconds - it informs, it does not act.
pub const STALL_WARNING_AFTER: Duration = Duration::from_secs(STALL_WINDOW.as_secs() / 2);

/// The verdict on one progress sample.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StallCheck {
    /// Still making headway, or still inside the current window.
    Advancing,
    /// Less than `STALL_MIN_PROGRESS_BYTES` moved across a full window.
    Stalled {
        /// How long since the last qualifying advance, for the message.
        since_last_advance: Duration,
    },
}

/// Decides whether a transfer has stalled, from progress over a sliding window.
///
/// The clock is a parameter rather than a field: every decision is a pure
/// function of (bytes so far, time so far), which is what makes the thresholds
/// unit-testable in microseconds instead of by sleeping.
pub struct StallMonitor {
    window: Duration,
    min_progress: u64,
    /// Byte count at the start of the current window.
    anchor_bytes: u64,
    /// When the current window started.
    anchor_at: Duration,
}

impl StallMonitor {
    /// A monitor with the production thresholds, anchored at `started_at`.
    pub fn new(started_at: Duration) -> Self {
        StallMonitor {
            window: STALL_WINDOW,
            min_progress: STALL_MIN_PROGRESS_BYTES,
            anchor_bytes: 0,
            anchor_at: started_at,
        }
    }

    /// Feeds one sample. `now` is elapsed time since the upload was invoked.
    pub fn observe(&mut self, bytes_sent: u64, now: Duration) -> StallCheck {
        if bytes_sent.saturating_sub(self.anchor_bytes) >= self.min_progress {
            self.anchor_bytes = bytes_sent;
            self.anchor_at = now;
            return StallCheck::Advancing;
        }

        let since_last_advance = self.silence(now);
        if since_last_advance >= self.window {
            StallCheck::Stalled { since_last_advance }
        } else {
            StallCheck::Advancing
        }
    }

    /// How long since the last qualifying advance.
    ///
    /// The soft warning reads the same clock the terminal verdict does rather than
    /// starting a second one, so the two can never disagree about how quiet the
    /// transfer has been.
    pub fn silence(&self, now: Duration) -> Duration {
        now.saturating_sub(self.anchor_at)
    }
}

/// Watches a transfer for a stall, watches for the user cancelling it, and tears
/// it down for either reason.
///
/// Detection lives here rather than in the frontend for three reasons the
/// frontend cannot match: it can stop the transfer, it knows the byte offset, and
/// it can measure a rate rather than an event gap. What it cannot see is bytes
/// acknowledged on the wire -- it watches source-file reads, which reqwest's
/// backpressure keeps within the ~5 MB of hyper queue plus kernel socket buffer
/// measured in #150. So it detects "the transfer stopped", never "the transfer is
/// being discarded".
///
/// Cancellation shares this task rather than getting one of its own for the same
/// reason the watchdog is not a `select!` inside the upload task: a cancel has to
/// be actioned even when the upload task is wedged in a syscall, which is exactly
/// the situation in which a user reaches for it.
pub(super) async fn supervise_upload(
    upload: tauri::async_runtime::JoinHandle<()>,
    progress: Arc<UploadProgress>,
    gate: TerminalGate,
    mut cancel_rx: watch::Receiver<bool>,
    registry: OperationRegistry,
    operation_id: String,
) {
    let mut monitor = StallMonitor::new(Duration::ZERO);
    // Whether the soft warning is currently showing. Latched here so
    // `warning_transition` stays pure and the user is told once, not once a second.
    let mut warned = false;
    // The watch sender is dropped when the operation is deregistered. That is not
    // a cancellation, and `changed()` would then return `Err` immediately forever,
    // spinning the loop - so stop selecting on it once it has closed.
    let mut watching_cancel = true;

    loop {
        if watching_cancel {
            tokio::select! {
                _ = tokio::time::sleep(STALL_POLL_INTERVAL) => {}
                changed = cancel_rx.changed() => {
                    if changed.is_err() {
                        watching_cancel = false;
                    }
                }
            }
        } else {
            tokio::time::sleep(STALL_POLL_INTERVAL).await;
        }

        if OperationRegistry::is_cancelled(&cancel_rx) {
            let bytes_sent = progress.bytes_sent();
            log::info!(
                "[Sprout] Upload {} cancelled by the user at {} bytes",
                operation_id,
                bytes_sent
            );
            gate.cancel(bytes_sent, progress.total_bytes());
            // Reporting a cancellation without tearing the request down is the
            // orphaned-upload defect with a nicer message. The abort drops the
            // reqwest future, which closes the socket.
            upload.abort();
            break;
        }

        // The operation reported for itself, so there is nothing left to watch.
        if gate.is_settled() {
            break;
        }

        let bytes_sent = progress.bytes_sent();
        let now = progress.elapsed();
        match monitor.observe(bytes_sent, now) {
            StallCheck::Stalled { since_last_advance } => {
                let message = stall_message(bytes_sent, progress.total_bytes(), since_last_advance);
                log::warn!("{}", message);
                gate.fail(message);
                // Reporting without tearing down would leave a dead upload holding
                // the socket, and its progress events would interleave with a
                // retry's.
                upload.abort();
                break;
            }
            StallCheck::Advancing => {
                let silence = monitor.silence(now);
                let transition = warning_transition(warned, silence);
                if transition != WarningTransition::Unchanged {
                    warned = transition == WarningTransition::Raise;
                    gate.warn_stall(UploadStallWarningEvent {
                        operation_id: operation_id.clone(),
                        bytes_sent,
                        total_bytes: progress.total_bytes(),
                        silent_for_seconds: silence.as_secs(),
                        message: if warned {
                            Some(stall_warning_message(
                                bytes_sent,
                                progress.total_bytes(),
                                silence,
                            ))
                        } else {
                            None
                        },
                    });
                }
            }
        }
    }

    // Unconditional and in one place: any terminal path that skipped this would
    // leak the operation and leave a stale id the user could still "cancel".
    registry.complete(&operation_id).await;
}
