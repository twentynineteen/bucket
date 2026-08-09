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

use crate::commands::sprout_upload::{classify_folders_response, folders_url};

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

    let folders = classify_folders_response(StatusCode::OK, body, None)
        .expect("a well-formed folder page should parse");

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
    let err = classify_folders_response(StatusCode::UNAUTHORIZED, body, None)
        .expect_err("a 401 must not be treated as an empty folder list");

    assert!(err.contains("401"), "got: {err}");
    assert!(
        err.to_lowercase().contains("api key"),
        "the message must point at the fixable cause, got: {err}"
    );
}

#[test]
fn a_403_is_treated_like_a_401() {
    let err = classify_folders_response(StatusCode::FORBIDDEN, "{}", None)
        .expect_err("a 403 must not be treated as success");
    assert!(err.to_lowercase().contains("api key"), "got: {err}");
}

#[test]
fn a_429_names_the_rate_limit_and_the_wait() {
    let err = classify_folders_response(StatusCode::TOO_MANY_REQUESTS, "", Some("30"))
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
    let err = classify_folders_response(StatusCode::TOO_MANY_REQUESTS, "", None)
        .expect_err("a 429 must not be treated as success");
    assert!(err.contains("429"), "got: {err}");
}

#[test]
fn a_2xx_without_a_folders_key_is_an_error_not_an_empty_list() {
    // A 2xx carrying `[]` or an error object parses fine but is not a listing.
    // Treating it as success renders "no subfolders" over a real failure.
    let err = classify_folders_response(StatusCode::OK, r#"{"error":"nope"}"#, None)
        .expect_err("a 2xx with no folders key must not be treated as an empty level");
    assert!(err.contains("folders"), "got: {err}");
}

#[test]
fn a_2xx_with_a_non_json_body_reports_the_status() {
    let err = classify_folders_response(StatusCode::OK, "<html>gateway</html>", None)
        .expect_err("an HTML body must not be treated as an empty folder list");
    assert!(err.contains("200"), "got: {err}");
}
