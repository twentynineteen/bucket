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
        err.len() < 1024,
        "error message must stay readable rather than embedding the whole body, got {} chars",
        err.len()
    );
    assert!(err.contains("500"), "got: {err}");
}

#[test]
fn multibyte_bodies_are_truncated_without_panicking() {
    // Truncating on a byte boundary rather than a char boundary would panic here.
    let body = "é".repeat(5000);
    let result = classify_response(StatusCode::INTERNAL_SERVER_ERROR, &body);

    let err = result.expect_err("a 500 must not be treated as success");
    assert!(err.contains("500"), "got: {err}");
}
