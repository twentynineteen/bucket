/**
 * Sprout Upload Tests
 * Issue #150 - Sprout upload hangs silently on large files
 *
 * Covers UP-02: a non-2xx response with an unparseable body must still report
 * its HTTP status. Previously `response.json()` ran before the status check, so
 * an HTML 413/502/504 error page failed to deserialise and exited via `?` into a
 * bare `println!`, leaving the frontend waiting on an event that never came.
 */
use crate::commands::sprout_upload::classify_response;
use reqwest::StatusCode;

#[test]
fn success_with_valid_json_returns_the_parsed_body() {
    let body = r#"{"id":"abc123","title":"Interview part 1"}"#;
    let result = classify_response(StatusCode::OK, body);

    let value = result.expect("a 2xx with valid JSON should classify as success");
    assert_eq!(value["id"], "abc123");
    assert_eq!(value["title"], "Interview part 1");
}

#[test]
fn non_2xx_with_html_body_reports_the_status_code() {
    // The exact shape an nginx / load-balancer body-size rejection takes.
    let body = "<html>\r\n<head><title>413 Request Entity Too Large</title></head>\r\n</html>";
    let result = classify_response(StatusCode::PAYLOAD_TOO_LARGE, body);

    let err = result.expect_err("a 413 must not be treated as success");
    assert!(
        err.contains("413"),
        "error must name the HTTP status so the cause is identifiable, got: {err}"
    );
    assert!(
        err.contains("Request Entity Too Large"),
        "error must include the response body so the cause is identifiable, got: {err}"
    );
}

#[test]
fn non_2xx_with_empty_body_still_reports_the_status_code() {
    let result = classify_response(StatusCode::BAD_GATEWAY, "");

    let err = result.expect_err("a 502 must not be treated as success");
    assert!(
        err.contains("502"),
        "error must name the HTTP status even with no body, got: {err}"
    );
}

#[test]
fn non_2xx_with_json_body_still_reports_the_status_code() {
    // The one path that previously worked must keep working.
    let result = classify_response(StatusCode::UNAUTHORIZED, r#"{"error":"bad api key"}"#);

    let err = result.expect_err("a 401 must not be treated as success");
    assert!(err.contains("401"), "got: {err}");
    assert!(err.contains("bad api key"), "got: {err}");
}

#[test]
fn success_with_json_that_is_not_a_video_record_is_an_error() {
    // A caching proxy answering 200 with `null` parses fine but carries no
    // video. Emitting upload_complete here tells the user it worked while no
    // link is ever added.
    for body in ["null", "[]", "\"ok\"", "3", "{}", r#"{"error":"nope"}"#] {
        let err = classify_response(StatusCode::OK, body)
            .expect_err("a 2xx without an id is not a video record");
        assert!(
            err.contains("unexpected JSON shape"),
            "body {body} should be rejected as a non-record, got: {err}"
        );
    }
}

#[test]
fn success_with_unparseable_body_is_an_error_naming_the_status() {
    // This is the case that produced the reported hang:
    // "error decoding response body: expected value at line 1 column 1".
    let result = classify_response(StatusCode::OK, "<html>not json</html>");

    let err = result.expect_err("a 2xx with a non-JSON body cannot yield a video record");
    assert!(
        err.contains("200"),
        "error must name the HTTP status, got: {err}"
    );
}

#[test]
fn oversized_bodies_are_truncated_in_the_error_message() {
    let body = "x".repeat(5000);
    let result = classify_response(StatusCode::INTERNAL_SERVER_ERROR, &body);

    let err = result.expect_err("a 500 must not be treated as success");
    assert!(
        err.contains("… (truncated)"),
        "an oversized body must be marked as truncated, got: {err}"
    );
    // 512 chars of body + a short prefix. Pins the limit rather than just
    // asserting "not enormous".
    assert!(
        (520..640).contains(&err.chars().count()),
        "expected ~512 chars of body plus a prefix, got {} chars",
        err.chars().count()
    );
    assert!(err.contains("500"), "got: {err}");
}

#[test]
fn empty_body_is_reported_as_such() {
    let err = classify_response(StatusCode::BAD_GATEWAY, "   \n\t ")
        .expect_err("a 502 must not be treated as success");
    assert!(
        err.contains("(empty body)"),
        "a whitespace-only body should read as empty, got: {err}"
    );
}

#[test]
fn multibyte_bodies_are_truncated_without_panicking() {
    // Truncating on a byte boundary rather than a char boundary would panic here.
    let body = "é".repeat(5000);
    let result = classify_response(StatusCode::INTERNAL_SERVER_ERROR, &body);

    let err = result.expect_err("a 500 must not be treated as success");
    assert!(err.contains("500"), "got: {err}");
}

// --- Folder listing (issue #155) ---
//
// Two stacked bugs made every folder request return the account root: the Tauri
// argument key never matched (`parent_id` sent, `folderId` expected, silently
// binding to `None`), and the query parameter name was wrong (`folder_id`, where
// the folders endpoint takes `parent_id`). These tests pin the wire shape.

use crate::commands::sprout_upload::{classify_folders_page, folders_url};

#[test]
fn folders_url_omits_parent_id_at_the_root() {
    let url = folders_url(None, 1, 100);
    assert!(
        !url.contains("parent_id"),
        "root listings must omit parent_id entirely — Sprout returns root folders \
         when it is absent, which is not the same as sending it empty. Got: {url}"
    );
}

#[test]
fn folders_url_uses_parent_id_not_folder_id() {
    let url = folders_url(Some("abc123"), 1, 100);
    assert!(
        url.contains("parent_id=abc123"),
        "the folders endpoint takes `parent_id`; `folder_id` belongs to the videos \
         endpoint and is silently ignored here. Got: {url}"
    );
    assert!(
        !url.contains("folder_id"),
        "regression: `folder_id` was the original bug. Got: {url}"
    );
}

#[test]
fn folders_url_percent_encodes_the_parent_id() {
    let url = folders_url(Some("a b&c=d"), 1, 100);
    assert!(
        !url.contains("a b&c=d"),
        "a folder id with reserved characters must not break out of its parameter. Got: {url}"
    );
    assert!(url.contains("parent_id=a+b%26c%3Dd"), "got: {url}");
}

#[test]
fn folders_url_always_requests_the_maximum_page_size() {
    let url = folders_url(Some("abc123"), 3, 100);
    assert!(
        url.contains("per_page=100"),
        "Sprout defaults to 25 per page, which silently dropped the tail of any \
         level with more folders than that. Got: {url}"
    );
    assert!(url.contains("page=3"), "got: {url}");
}

#[test]
fn folders_url_sorts_by_name() {
    let url = folders_url(None, 1, 100);
    assert!(url.contains("order_by=name"), "got: {url}");
    assert!(url.contains("order_dir=asc"), "got: {url}");
}

#[test]
fn a_valid_folder_page_deserialises() {
    let body = r#"{"folders":[
        {"id":"f1","name":"Marketing","parent_id":null},
        {"id":"f2","name":"Q2 Campaign","parent_id":"f1"}
    ],"total":2}"#;

    let folders = classify_folders_page(StatusCode::OK, body, None)
        .expect("a well-formed folder page should parse")
        .folders;

    assert_eq!(folders.len(), 2);
    assert_eq!(folders[0].name, "Marketing");
    assert_eq!(
        folders[0].parent_id, None,
        "a null parent_id marks a root folder and must map to None"
    );
    assert_eq!(folders[1].parent_id.as_deref(), Some("f1"));
}

#[test]
fn a_401_names_the_api_key_rather_than_returning_an_empty_list() {
    // The original code called response.json() with no status check, so an auth
    // failure rendered as a folder tree with nothing in it.
    let body = r#"{"error":"unauthorized"}"#;
    let err = classify_folders_page(StatusCode::UNAUTHORIZED, body, None)
        .expect_err("a 401 must not be treated as an empty folder list");

    assert!(err.contains("401"), "got: {err}");
    assert!(
        err.to_lowercase().contains("api key"),
        "the message must point at the fixable cause, got: {err}"
    );
}

#[test]
fn a_403_is_treated_like_a_401() {
    let err = classify_folders_page(StatusCode::FORBIDDEN, "{}", None)
        .expect_err("a 403 must not be treated as success");
    assert!(err.to_lowercase().contains("api key"), "got: {err}");
}

#[test]
fn a_429_names_the_rate_limit_and_the_wait() {
    let err = classify_folders_page(StatusCode::TOO_MANY_REQUESTS, "", Some("30"))
        .expect_err("a 429 must not be treated as success");

    assert!(err.contains("429"), "got: {err}");
    assert!(
        err.contains("30 seconds"),
        "Retry-After must reach the user so they know how long to wait, got: {err}"
    );
    assert!(
        err.contains("200 requests per minute"),
        "the message should explain the account-wide limit, got: {err}"
    );
}

#[test]
fn a_429_without_retry_after_still_reports_the_limit() {
    let err = classify_folders_page(StatusCode::TOO_MANY_REQUESTS, "", None)
        .expect_err("a 429 must not be treated as success");
    assert!(err.contains("429"), "got: {err}");
}

#[test]
fn a_2xx_without_a_folders_key_is_an_error_not_an_empty_list() {
    // A 2xx carrying `[]` or an error object parses fine but is not a listing.
    // Treating it as success renders "no subfolders" over a real failure.
    let err = classify_folders_page(StatusCode::OK, r#"{"error":"nope"}"#, None)
        .expect_err("a 2xx with no folders key must not be treated as an empty level");
    assert!(err.contains("folders"), "got: {err}");
}

#[test]
fn a_2xx_with_a_non_json_body_reports_the_status() {
    let err = classify_folders_page(StatusCode::OK, "<html>gateway</html>", None)
        .expect_err("an HTML body must not be treated as an empty folder list");
    assert!(err.contains("200"), "got: {err}");
}

// --- Pre-flight upload size gate (issue #154) ---
//
// A 12.72 GB render streamed for a long time before Sprout's edge answered with an
// HTML 413. The size is knowable from `metadata().len()` in milliseconds, so an
// upload that could never succeed is now refused before any bytes move.

use crate::commands::sprout_upload::check_upload_size;

/// One binary gigabyte. Sprout's limit is expressed in these, not in decimal GB.
const GIB: u64 = 1024 * 1024 * 1024;

#[test]
fn a_file_of_exactly_the_limit_is_accepted() {
    // UP-09b: the limit is inclusive. `>=` in place of `>` would refuse a file
    // Sprout's API accepts, so this case must pass.
    let checked = check_upload_size(5 * GIB)
        .expect("exactly 5 GiB is at Sprout's limit, not over it, so it must be accepted");
    assert_eq!(
        checked.bytes(),
        5 * GIB,
        "the checked size must carry the real byte count through to the content length"
    );
}

#[test]
fn a_file_one_byte_under_the_limit_is_accepted() {
    check_upload_size(5 * GIB - 1).expect("a file under the limit must be accepted");
}

#[test]
fn a_file_one_byte_over_the_limit_is_rejected() {
    check_upload_size(5 * GIB + 1)
        .err()
        .expect("one byte over the limit is over the limit");
}

#[test]
fn the_rejection_names_the_size_the_limit_and_both_ways_forward() {
    // UP-09: the size that produced the original 413.
    let err = check_upload_size(12_720_000_000)
        .err()
        .expect("a 12.72 GB file cannot be uploaded through Sprout's API");

    assert!(
        err.contains("12.72 GB"),
        "the message must name the file's actual size, got: {err}"
    );
    assert!(
        err.contains("5 GB"),
        "the message must name the limit the file breached, got: {err}"
    );
    assert!(
        err.to_lowercase().contains("bitrate"),
        "the message must offer re-exporting smaller as a way forward, got: {err}"
    );
    assert!(
        err.contains("Enter URL"),
        "the message must point at the web uploader plus the \"Enter URL\" tab as the \
         other way forward, got: {err}"
    );
}

// --- Stall detection (issue #204) ---
//
// The only backstop used to be a flat 45-minute wall-clock timer armed at
// invocation, so an upload that died at 3% held at 3% for another 44 minutes -
// which is exactly what a genuinely slow large upload looks like. The same timer
// killed healthy uploads that legitimately ran past 45 minutes. Both directions
// are wrong because a deadline that cannot see progress is the wrong mechanism.
//
// The decision is a pure function of (bytes so far, time so far), so the clock is
// injected as an explicit `Duration` rather than a trait or a tokio timer, and
// every case below runs in microseconds.

use crate::commands::sprout_upload::{
    stall_message, StallCheck, StallMonitor, TerminalOnce, STALL_MIN_PROGRESS_BYTES, STALL_WINDOW,
};
use std::time::Duration;

/// A monitor anchored at t=0 with the production thresholds.
fn monitor() -> StallMonitor {
    StallMonitor::new(Duration::ZERO)
}

fn secs(n: u64) -> Duration {
    Duration::from_secs(n)
}

#[test]
fn a_transfer_that_stops_advancing_is_stalled_after_the_window() {
    // UP-12. 700 MB in, then nothing.
    let mut monitor = monitor();
    let offset = 700 * 1024 * 1024;
    assert!(
        matches!(monitor.observe(offset, secs(30)), StallCheck::Advancing),
        "the first observation establishes the anchor, it cannot be a stall"
    );

    // Past the window, still on the same byte. Deliberately past rather than
    // exactly on it: `the_window_boundary_is_inclusive` is the only test that
    // pins the comparison, so flipping it fails exactly one case.
    match monitor.observe(offset, secs(30) + STALL_WINDOW + secs(5)) {
        StallCheck::Stalled { since_last_advance } => assert_eq!(
            since_last_advance,
            STALL_WINDOW + secs(5),
            "the report must name how long it has been silent"
        ),
        StallCheck::Advancing => {
            panic!("a transfer that has not moved for a full window is stalled, not slow")
        }
    }
}

#[test]
fn a_trickling_transfer_is_also_stalled() {
    // UP-13. A bare gap timer is reset forever by a connection that is dying
    // rather than dead: a byte every 20 seconds keeps it happy while the upload
    // never completes. The measure is progress over a window, not any movement.
    let mut monitor = monitor();
    let mut bytes = 0u64;

    for tick in 1..=69 {
        bytes += 1024; // ~70 KB total across the whole window
        assert!(
            matches!(monitor.observe(bytes, secs(tick)), StallCheck::Advancing),
            "inside the window a trickle is not yet a verdict (tick {tick})"
        );
    }

    bytes += 6 * 1024;
    assert!(
        matches!(monitor.observe(bytes, secs(75)), StallCheck::Stalled { .. }),
        "75 KB across a 75-second window is a dying connection, not a slow one"
    );
}

#[test]
fn steady_progress_is_never_stalled_however_long_it_runs() {
    // UP-14. Three hours at 2 MB per poll. The old flat deadline killed this at
    // 45 minutes while it was making perfectly good headway.
    let mut monitor = monitor();
    let mut bytes = 0u64;

    for tick in 1..=(3 * 60 * 60) {
        bytes += 2 * 1024 * 1024;
        assert!(
            matches!(monitor.observe(bytes, secs(tick)), StallCheck::Advancing),
            "an upload making steady progress must never be cancelled for taking \
             a long time (tick {tick})"
        );
    }
}

#[test]
fn no_wall_clock_upload_deadline_survives_anywhere() {
    // UP-14. The frontend timer is only half of it: reqwest's total-request
    // `.timeout(45 * 60)` would kill a healthy slow upload from the Rust side
    // even with the frontend fixed. The stall watchdog replaces both.
    let source = include_str!("../sprout_upload.rs");
    assert!(
        !source.contains("45 * 60"),
        "a 45-minute total-request deadline cannot tell a slow upload from a dead \
         one, and killing a transfer that is still advancing is the other half of #204"
    );
    assert!(
        source.contains("connect_timeout"),
        "a connect that has not completed is not a transfer that is progressing, so \
         the connect timeout must stay"
    );
}

#[test]
fn the_window_boundary_is_inclusive() {
    // UP-15. Mutation check: `>=` to `>` on the window comparison must fail here
    // and nowhere else.
    let mut monitor = monitor();
    monitor.observe(0, Duration::ZERO);
    assert!(
        matches!(monitor.observe(0, STALL_WINDOW), StallCheck::Stalled { .. }),
        "exactly one window of silence is a stall"
    );
}

#[test]
fn one_millisecond_short_of_the_window_is_not_a_stall() {
    let mut monitor = monitor();
    monitor.observe(0, Duration::ZERO);
    assert!(
        matches!(
            monitor.observe(0, STALL_WINDOW - Duration::from_millis(1)),
            StallCheck::Advancing
        ),
        "the verdict must not arrive early - a recoverable TCP backoff is not a stall"
    );
}

#[test]
fn exactly_the_minimum_advance_restarts_the_window() {
    // UP-15. Mutation check: `>=` to `>` on the progress comparison must fail
    // here and nowhere else. Every other test advances by strictly more than the
    // minimum, so only this one pins the boundary.
    let mut monitor = monitor();
    monitor.observe(0, Duration::ZERO);
    monitor.observe(STALL_MIN_PROGRESS_BYTES, secs(10));

    // If that advance restarted the window, only 60 of the 70 seconds have run.
    assert!(
        matches!(
            monitor.observe(STALL_MIN_PROGRESS_BYTES, secs(70)),
            StallCheck::Advancing
        ),
        "exactly the minimum advance qualifies, so the window must restart from it"
    );
    assert!(
        matches!(
            monitor.observe(STALL_MIN_PROGRESS_BYTES, secs(85)),
            StallCheck::Stalled { .. }
        ),
        "and the restarted window must still expire"
    );
}

#[test]
fn one_byte_short_of_the_minimum_does_not_restart_the_window() {
    let mut monitor = monitor();
    monitor.observe(0, Duration::ZERO);
    monitor.observe(STALL_MIN_PROGRESS_BYTES - 1, secs(10));

    assert!(
        matches!(
            monitor.observe(STALL_MIN_PROGRESS_BYTES - 1, secs(75)),
            StallCheck::Stalled { .. }
        ),
        "a sub-minimum advance must not buy the transfer another full window, or a \
         trickle defeats the check"
    );
}

#[test]
fn the_stall_message_names_the_offset_the_total_and_the_silence() {
    // UP-12. "Stopped at 1.68 GB of 4.10 GB" is what tells the user whether to
    // wait or cancel; a percentage alone does not.
    let message = stall_message(1_680_000_000, 4_100_000_000, secs(71));

    assert!(
        message.contains("1.68 GB"),
        "the message must name the byte offset reached, got: {message}"
    );
    assert!(
        message.contains("4.10 GB"),
        "the message must name the total so the offset means something, got: {message}"
    );
    assert!(
        message.contains("71"),
        "the message must name how long it has been silent, got: {message}"
    );
    assert!(
        message.to_lowercase().contains("stall"),
        "the message must name the condition, got: {message}"
    );
}

#[test]
fn a_stall_is_not_reported_as_a_timeout() {
    // UP-16. The old message named a duration rather than the problem. A stall
    // that reads as a timeout sends the user back to "try again in 45 minutes".
    let message = stall_message(120_000_000, 4_100_000_000, secs(70));

    assert!(
        !message.contains("timed out"),
        "a stall is not a timeout, got: {message}"
    );
    assert!(
        !message.contains("45 minutes"),
        "the 45-minute framing is exactly what #204 removes, got: {message}"
    );
}

#[test]
fn a_stall_is_distinguishable_from_the_other_terminal_outcomes() {
    // UP-16. #152 classified failures that report themselves and #154 rejects
    // oversized files up front. A fifth outcome is only useful if the user can
    // tell it from the other four.
    let stall = stall_message(120_000_000, 4_100_000_000, secs(70));
    let rejected = classify_response(StatusCode::PAYLOAD_TOO_LARGE, "<html>413</html>")
        .expect_err("a 413 is a failure");
    let unparseable =
        classify_response(StatusCode::OK, "<html>not json</html>").expect_err("a non-record");
    let oversized = check_upload_size(12_720_000_000)
        .err()
        .expect("over the limit");

    for other in [&rejected, &unparseable, &oversized] {
        assert!(
            !other.to_lowercase().contains("stall"),
            "only the stall message may read as a stall, got: {other}"
        );
    }
    assert!(
        !stall.contains("HTTP"),
        "a stall never had a response to report a status for, got: {stall}"
    );
    assert!(
        !stall.contains("5 GB"),
        "a stall is not a size rejection, got: {stall}"
    );
}

#[test]
fn a_stall_before_any_bytes_move_still_reads_sensibly() {
    // The watchdog is armed from invocation, so it can fire before the first read.
    let message = stall_message(0, 4_100_000_000, secs(70));
    assert!(message.to_lowercase().contains("stall"), "got: {message}");
    assert!(
        !message.contains("0.00 GB"),
        "\"stopped at 0.00 GB\" reads as a bug; a transfer that never started must \
         say so, got: {message}"
    );
}

#[test]
fn exactly_one_reporter_wins_the_terminal_event() {
    // UP-17. A stall detected in the same instant the request completes must not
    // produce both an upload_error and an upload_complete. The watchdog and the
    // upload task race by construction, so the arbitration is the guarantee.
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let gate = TerminalOnce::default();
    let winners = Arc::new(AtomicUsize::new(0));

    let threads: Vec<_> = (0..8)
        .map(|_| {
            let gate = gate.clone();
            let winners = winners.clone();
            std::thread::spawn(move || {
                if gate.claim() {
                    winners.fetch_add(1, Ordering::SeqCst);
                }
            })
        })
        .collect();

    for thread in threads {
        thread.join().expect("no claimant should panic");
    }

    assert_eq!(
        winners.load(Ordering::SeqCst),
        1,
        "exactly one terminal event per operation - #154 established that discipline"
    );
    assert!(
        gate.is_settled(),
        "the watchdog stops polling once the operation has settled, so it must be \
         able to see that it has"
    );
}

#[test]
fn the_stall_watchdog_runs_outside_the_upload_task() {
    // UP-12. A `select!` inside the upload task cannot fire when that task is
    // blocked in a syscall, which is one of the candidate causes in #150. The
    // watchdog must therefore be spawned separately and hold the ability to tear
    // the upload down.
    //
    // The entry point was `watch_for_stall`; #225 folded user-initiated
    // cancellation into the same task, for the same reason the watchdog is not a
    // `select!` inside the upload task, and renamed it to match what it now does.
    // The guarantee this test pins is unchanged.
    let source = include_str!("../sprout_upload.rs");

    assert!(
        source.contains("async fn supervise_upload"),
        "the watchdog must exist as its own task entry point"
    );
    assert!(
        source.contains(".abort()"),
        "detecting a stall without tearing the request down leaves a dead upload \
         holding the socket"
    );
}

#[test]
fn the_size_check_runs_before_any_streaming_or_network_work() {
    // UP-09a. `ProgressReader` holds a `CheckedUploadSize`, which only
    // `check_upload_size` can mint, so the compiler already stops a progress
    // reporting reader - and therefore any `upload_progress` event - existing for
    // an unchecked file. What the compiler cannot stop is new work being added
    // above the gate, so pin the order of the statements in `upload_video_task`.
    let source = include_str!("../sprout_upload.rs");

    let gate = source
        .find("check_upload_size(file_size)")
        .expect("upload_video_task must gate on the file size it just read");
    let reader = source
        .find("ProgressReader {")
        .expect("upload_video_task must still build a ProgressReader");
    let request = source
        .find("post(\"https://api.sproutvideo.com/v1/videos\")")
        .expect("upload_video_task must still POST to Sprout");

    assert!(
        gate < reader,
        "the size gate must precede the ProgressReader, or an oversized file emits \
         upload_progress before it is refused"
    );
    assert!(
        gate < request,
        "the size gate must precede the request, or the user waits on a transfer that \
         cannot succeed"
    );
}

// --- Cancellation, the soft warning and byte counts (issue #225) ---
//
// #204 reports a stall in about 70 seconds, but the only thing a user could do
// with that information was close the app: `upload_video` returned no handle, so
// nothing could address a running upload, let alone stop it. Dismissing the
// dialog only closed the dialog and left a multi-gigabyte transfer running with
// nowhere to watch it and no way to end it.
//
// The decision logic stays a pure function of (bytes so far, time so far), as
// #204 established, so every case below runs in microseconds rather than by
// sleeping.

use crate::build_project::OperationRegistry;
use crate::commands::sprout_upload::{
    is_progress_emit_due, signal_cancel, stall_warning_message, warning_transition, UploadProgress,
    WarningTransition, PROGRESS_EMIT_INTERVAL, STALL_WARNING_AFTER,
};

#[test]
fn a_warning_is_raised_when_the_silence_reaches_half_the_window() {
    // UP-26. The question a user has at 35 seconds of a frozen bar is "wait or
    // cancel?", and until now nothing answered it before the transfer was over.
    //
    // Deliberately past the threshold rather than exactly on it, so that flipping
    // the comparison fails `the_warning_threshold_boundary_is_inclusive` and
    // nothing else.
    assert_eq!(
        warning_transition(false, STALL_WARNING_AFTER + secs(5)),
        WarningTransition::Raise,
        "half a window of silence is worth saying out loud, non-terminally"
    );
}

#[test]
fn the_warning_threshold_boundary_is_inclusive() {
    // UP-26. Mutation check: `>=` to `>` on the warning comparison must fail here
    // and nowhere else, so every other case sits off the boundary.
    assert_eq!(
        warning_transition(false, STALL_WARNING_AFTER),
        WarningTransition::Raise
    );
    assert_eq!(
        warning_transition(false, STALL_WARNING_AFTER - Duration::from_millis(1)),
        WarningTransition::Unchanged,
        "the warning must not arrive early either - a brief TCP backoff is normal"
    );
}

#[test]
fn the_warning_is_raised_once_per_silent_period_not_once_per_poll() {
    // UP-28. The supervisor samples every second, so an unlatched warning would
    // fire 35 times across one silent period and read as a stream of failures.
    let mut warned = false;
    let mut raised = 0;

    for tick in 1..=40 {
        match warning_transition(warned, secs(tick)) {
            WarningTransition::Raise => {
                raised += 1;
                warned = true;
            }
            WarningTransition::Clear => warned = false,
            WarningTransition::Unchanged => {}
        }
    }

    assert_eq!(
        raised, 1,
        "one warning per silent period - the user is told once, not once a second"
    );
}

#[test]
fn progress_resuming_clears_the_warning() {
    // UP-27. A warning left standing after the transfer recovered is worse than no
    // warning: it tells the user to cancel something that is working.
    assert_eq!(
        warning_transition(true, Duration::ZERO),
        WarningTransition::Clear
    );
    assert_eq!(
        warning_transition(true, STALL_WARNING_AFTER + secs(5)),
        WarningTransition::Unchanged,
        "still silent means nothing new to say, not a second warning"
    );
}

#[test]
fn the_soft_threshold_is_derived_from_the_terminal_window() {
    // UP-29. #204 derived 70s from RFC 6298 retransmission backoff (six doublings
    // put 63s between the last acknowledged byte and recovery). Nothing here
    // retunes that, and the soft threshold must not be able to drift past it.
    assert_eq!(
        STALL_WINDOW,
        secs(70),
        "the terminal window is #204's and is not being retuned"
    );
    assert_eq!(
        STALL_MIN_PROGRESS_BYTES,
        1024 * 1024,
        "the minimum advance is #204's and is not being retuned"
    );
    assert_eq!(
        STALL_WARNING_AFTER * 2,
        STALL_WINDOW,
        "the warning must land inside the window it warns about"
    );

    let source = include_str!("../sprout_upload.rs");
    let declaration = source
        .split("pub const STALL_WARNING_AFTER")
        .nth(1)
        .and_then(|rest| rest.split(';').next())
        .expect("STALL_WARNING_AFTER must be declared as a constant");
    assert!(
        declaration.contains("STALL_WINDOW"),
        "written in terms of STALL_WINDOW, or a later change to one silently leaves \
         the other behind, got: {declaration}"
    );
}

#[test]
fn the_warning_does_not_read_as_the_final_verdict() {
    // UP-26. The two messages describe different situations - one recoverable, one
    // not - so a user who reads them a minute apart must not see the same advice
    // twice.
    let warning = stall_warning_message(1_680_000_000, 4_100_000_000, secs(35));
    let terminal = stall_message(1_680_000_000, 4_100_000_000, secs(71));

    assert!(
        warning.contains("1.68 GB") && warning.contains("4.10 GB"),
        "the warning must name where the transfer got to, got: {warning}"
    );
    assert!(
        warning.contains("35"),
        "the warning must name how long it has been silent, got: {warning}"
    );
    assert!(
        warning.to_lowercase().contains("may recover"),
        "a non-terminal warning must say the transfer can still come back, got: {warning}"
    );
    assert!(
        !warning.contains("waiting will not help"),
        "that is the terminal verdict's wording and must not appear before the \
         verdict, got: {warning}"
    );
    assert!(
        terminal.contains("waiting will not help"),
        "and the terminal message must still say it, got: {terminal}"
    );
    assert!(
        !terminal.to_lowercase().contains("may recover"),
        "the terminal verdict is not a maybe, got: {terminal}"
    );
}

#[test]
fn the_warning_points_at_cancelling_because_cancelling_now_exists() {
    // The whole reason #225 sequences the warning behind cancellation: telling a
    // user something looks stuck while giving them no way to stop it is closer to
    // taunting than helping.
    let warning = stall_warning_message(1_680_000_000, 4_100_000_000, secs(35));
    assert!(
        warning.to_lowercase().contains("cancel"),
        "the warning must point at the action it has just made possible, got: {warning}"
    );
}

#[test]
fn the_monitor_reports_how_long_it_has_been_silent() {
    // UP-26. The warning needs the silence the monitor is already tracking, and
    // must not start a second clock that could disagree with the first.
    let mut monitor = monitor();
    monitor.observe(0, Duration::ZERO);

    assert_eq!(monitor.silence(secs(30)), secs(30));

    monitor.observe(STALL_MIN_PROGRESS_BYTES, secs(40));
    assert_eq!(
        monitor.silence(secs(50)),
        secs(10),
        "a qualifying advance restarts the silence, exactly as it restarts the window"
    );
}

#[test]
fn progress_emission_is_throttled_to_one_event_per_interval() {
    // UP-31. A 64 KB read emitted one event, so a 4 GB upload emitted ~65,000 of
    // them; carrying byte counts as well makes each one larger. The throttle is
    // what stops item 3 making the IPC flood worse.
    assert!(
        is_progress_emit_due(Duration::ZERO, PROGRESS_EMIT_INTERVAL),
        "exactly the interval is due - mutation check on the comparison"
    );
    assert!(
        !is_progress_emit_due(
            Duration::ZERO,
            PROGRESS_EMIT_INTERVAL - Duration::from_millis(1)
        ),
        "one millisecond short is not due"
    );
}

#[test]
fn a_thousand_reads_inside_one_interval_emit_once_but_lose_no_bytes() {
    // UP-31. The trap #204 warned about: an accumulator that under-counts looks
    // exactly like a stall to the watchdog. Throttling the *event* must never
    // throttle the *count*.
    let progress = UploadProgress::new();
    let mut emits = 0;

    for chunk in 0..1000u64 {
        progress.advance(65_536);
        // A thousand reads spread across a single 100ms interval.
        let now = Duration::from_micros(chunk * 90);
        if progress.claim_emit_slot(now) {
            emits += 1;
        }
    }

    assert_eq!(
        emits, 1,
        "one event for the whole interval, not one per 64 KB read"
    );
    assert_eq!(
        progress.bytes_sent(),
        1000 * 65_536,
        "every read must reach the accumulator regardless of whether it was \
         reported - an under-counting accumulator is indistinguishable from a stall"
    );
}

#[tokio::test]
async fn cancelling_a_registered_upload_signals_its_watch_channel() {
    // UP-20. The registry is existing infrastructure, already used by
    // BuildProject's transfers; reusing it is what stops this becoming a second,
    // divergent cancellation mechanism.
    let registry = OperationRegistry::new();
    let (operation_id, receiver) = registry.register().await;

    assert!(!OperationRegistry::is_cancelled(&receiver));
    assert!(
        signal_cancel(&registry, &operation_id).await,
        "a registered upload must be addressable"
    );
    assert!(
        OperationRegistry::is_cancelled(&receiver),
        "the supervisor watches this channel, so signalling it is what tears the \
         request down"
    );
}

#[tokio::test]
async fn cancelling_an_upload_that_already_finished_is_not_an_error() {
    // UP-22 / UP-23. Dismissing the dialog cancels, and a dialog is routinely
    // dismissed a moment after the upload completed. That must report "nothing to
    // cancel", not a failure.
    let registry = OperationRegistry::new();
    let (operation_id, _receiver) = registry.register().await;
    registry.complete(&operation_id).await;

    assert!(
        !signal_cancel(&registry, &operation_id).await,
        "a completed operation is gone from the registry, so cancelling it is a \
         no-op rather than an error"
    );
    assert!(
        !signal_cancel(&registry, "never-existed").await,
        "and an unknown id is the same no-op"
    );
}

#[test]
fn cancellation_is_a_terminal_outcome_and_goes_through_the_gate() {
    // UP-20 / UP-33. #204's discipline: exactly one terminal event per operation.
    // A cancel racing a completion is the same race as a stall racing one, so it
    // must claim through the same one-shot rather than emitting unconditionally.
    let source = include_str!("../sprout_upload.rs");

    let cancel_emitter = source
        .split("fn cancel(&self")
        .nth(1)
        .and_then(|rest| rest.split("\n    }").next())
        .expect("TerminalGate must have a cancel arm");

    assert!(
        cancel_emitter.contains("self.once.claim()"),
        "the cancel arm must claim the one-shot like every other terminal arm, or a \
         cancel racing a completion emits two contradictory events, got: \
         {cancel_emitter}"
    );
    assert!(
        cancel_emitter.contains("upload_cancelled"),
        "cancellation needs its own channel: it is not a failure and must not raise \
         an error toast, got: {cancel_emitter}"
    );
}

#[test]
fn a_cancelled_upload_is_torn_down_and_deregistered_exactly_once() {
    // UP-20 / UP-22. Reporting a cancellation without aborting the task would leave
    // a dead upload holding the socket - the orphaning this issue exists to remove
    // - and leaving the id in the registry leaks an entry per upload.
    let source = include_str!("../sprout_upload.rs");

    let supervisor = source
        .split("async fn supervise_upload")
        .nth(1)
        .expect("the watchdog and the cancel watcher are one supervisor task");

    let cancel_arm = supervisor
        .split("if OperationRegistry::is_cancelled(&cancel_rx) {")
        .nth(1)
        .and_then(|rest| rest.split("break;").next())
        .expect("the supervisor must act on the cancellation signal");

    assert!(
        cancel_arm.contains("gate.cancel("),
        "the cancellation must be reported, got: {cancel_arm}"
    );
    assert!(
        cancel_arm.contains("upload.abort()"),
        "a cancellation that does not abort the upload task is the orphaned-upload \
         defect with a nicer message, got: {cancel_arm}"
    );
    assert_eq!(
        supervisor.matches("registry.complete(&operation_id)").count(),
        1,
        "deregistration must be unconditional and in one place, or some terminal \
         path leaks the operation"
    );
}

#[test]
fn detection_did_not_migrate_into_the_task_it_watches() {
    // #204's UP-12 must survive folding cancellation into the same supervisor. The
    // renamed entry point is pinned by `the_stall_watchdog_runs_outside_the_upload_task`
    // above; what this adds is that the upload task itself still knows nothing
    // about the thresholds, so no future edit can quietly move the decision inside
    // the task that a wedged syscall would freeze.
    let source = include_str!("../sprout_upload.rs");

    assert!(
        source.contains("spawn(supervise_upload"),
        "the supervisor must be spawned rather than awaited inline"
    );
    let upload_task = source
        .split("async fn upload_video_task")
        .nth(1)
        .expect("the upload task must still exist");
    assert!(
        !upload_task.contains("STALL_WINDOW"),
        "detection must not migrate into the task it is watching"
    );
}
