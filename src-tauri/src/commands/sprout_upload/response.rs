//! Response classification and folder listing types for the Sprout Video API.
//!
//! The status is checked BEFORE the body is parsed, so an HTML or empty error
//! page can never be mistaken for a successful response. See issue #150.

use serde_json::Value;

/// A single Sprout folder.
///
/// Field names stay snake_case deliberately. The Tauri macro camelCases command
/// *arguments* only; *return values* serialise through plain serde, so the
/// frontend reads `parent_id` as written. Renaming these for "consistency" with
/// the argument convention would break the boundary. See issue #155 §2.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
pub struct SproutFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// One page of folders exactly as Sprout sends it. Internal to this module.
///
/// Separate from `SproutFoldersPage` because the two have opposite needs: Sprout
/// never sends `truncated`, and the aggregate must not carry `next_page`.
#[derive(serde::Deserialize, Debug, Clone)]
pub struct SproutFoldersWirePage {
    pub folders: Vec<SproutFolder>,
    #[serde(default)]
    pub total: Option<u32>,
    /// Read ONLY as a has-more signal, never followed. Sprout's own docs show
    /// this URL carrying neither `parent_id` nor the requested `per_page`, so
    /// following it from a scoped request would return the ROOT's next page and
    /// splice foreign folders into a child listing. See issue #155 Phase 1.
    #[serde(default)]
    pub next_page: Option<String>,
}

/// Every folder at one level, aggregated across pages. The command's public
/// return type — `next_page` deliberately does not survive this boundary.
#[derive(serde::Serialize, Debug, Clone, PartialEq)]
pub struct SproutFoldersPage {
    pub folders: Vec<SproutFolder>,
    /// Sprout's `total` for THIS level, not `folders.len()`. The two diverge
    /// when `truncated` is set, which is exactly when a caller needs to know.
    pub total: Option<u32>,
    /// True when `MAX_FOLDER_PAGES` stopped us before Sprout ran out of pages.
    pub truncated: bool,
    /// `X-RateLimit-Remaining` from the last page fetched. Feeds the frontend's
    /// budget guard so it can reserve headroom for uploads. See issue #155 R5.
    pub rate_limit_remaining: Option<u32>,
    /// `X-RateLimit-Reset` (UTC epoch seconds) from the last page fetched.
    pub rate_limit_reset: Option<u64>,
}

/// Sprout's maximum page size for folder listings.
pub(super) const FOLDERS_PER_PAGE: u32 = 100;

/// Stop after this many pages per level. A runaway loop against a malformed
/// response is worse than a truncated list, and `truncated` tells the caller.
pub(super) const MAX_FOLDER_PAGES: u32 = 10;

/// Builds one page URL for a folder level.
///
/// `parent_id` is omitted entirely for the root level — Sprout returns root
/// folders when it is absent, and sending an empty value is not the same thing.
pub fn folders_url(parent_id: Option<&str>, page: u32, per_page: u32) -> String {
    let mut url = reqwest::Url::parse("https://api.sproutvideo.com/v1/folders")
        .expect("the folders endpoint is a valid URL");

    {
        // `query_pairs_mut` percent-encodes values, so a folder id containing
        // reserved characters cannot break out of its parameter.
        let mut query = url.query_pairs_mut();
        query.append_pair("page", &page.to_string());
        query.append_pair("per_page", &per_page.to_string());
        query.append_pair("order_by", "name");
        query.append_pair("order_dir", "asc");
        if let Some(pid) = parent_id {
            query.append_pair("parent_id", pid);
        }
    }

    url.into()
}

/// Maximum characters of a response body to quote in an error message. Enough to
/// identify an HTML error page, short enough to stay readable in a toast.
const BODY_EXCERPT_LIMIT: usize = 512;

/// Renders a response body for an error message, truncated on a char boundary so
/// multi-byte content cannot panic.
pub(super) fn body_excerpt(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "(empty body)".to_string();
    }

    let excerpt: String = trimmed.chars().take(BODY_EXCERPT_LIMIT).collect();
    if trimmed.chars().count() > BODY_EXCERPT_LIMIT {
        format!("{}… (truncated)", excerpt)
    } else {
        excerpt
    }
}

/// Reads a header as a number, tolerating absence and unparseable values.
pub(super) fn header_number<T: std::str::FromStr>(
    headers: &reqwest::header::HeaderMap,
    name: &str,
) -> Option<T> {
    headers.get(name)?.to_str().ok()?.trim().parse::<T>().ok()
}

/// Decides one folder page's outcome from the HTTP status and raw body.
///
/// Mirrors `classify_response`: the status is checked BEFORE the body is
/// parsed, so an HTML or empty error page can never be mistaken for an empty
/// folder list. `retry_after` is rendered into the 429 message when present.
pub fn classify_folders_page(
    status: reqwest::StatusCode,
    body: &str,
    retry_after: Option<&str>,
) -> Result<SproutFoldersWirePage, String> {
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        // Sprout allows 200 requests/minute per ACCOUNT. Name the wait so the
        // caller can surface it rather than hammering a closed window.
        let wait = match retry_after {
            Some(seconds) => format!(" Try again in {} seconds.", seconds),
            None => String::new(),
        };
        return Err(format!(
            "Sprout rate limit reached (HTTP 429).{} The limit is 200 requests per minute across your whole account.",
            wait
        ));
    }

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(format!(
            "Sprout rejected the folder request: HTTP {} — check your Sprout Video API key in Settings.",
            status.as_u16()
        ));
    }

    if !status.is_success() {
        return Err(format!(
            "Sprout rejected the folder request: HTTP {} — {}",
            status,
            body_excerpt(body)
        ));
    }

    // A 2xx carrying `null`, `[]` or an error object parses as JSON but is not a
    // folder listing. Requiring `folders` stops that rendering as "no subfolders".
    let parsed: Value = serde_json::from_str(body).map_err(|e| {
        format!(
            "Sprout returned HTTP {} but the folder list was not valid JSON ({}): {}",
            status,
            e,
            body_excerpt(body)
        )
    })?;

    if parsed.get("folders").is_none() {
        return Err(format!(
            "Sprout returned HTTP {} with an unexpected JSON shape (no \"folders\"): {}",
            status,
            body_excerpt(body)
        ));
    }

    serde_json::from_value(parsed).map_err(|e| {
        format!(
            "Sprout returned HTTP {} but the folder list could not be read ({}): {}",
            status,
            e,
            body_excerpt(body)
        )
    })
}

/// Decides an upload's outcome from the HTTP status and the raw response body.
///
/// The body is parsed as JSON only on the success path. Sprout and the
/// intermediaries in front of it return HTML or empty bodies for 413/502/504, so
/// deserialising before checking the status throws away the status code that
/// names the actual failure — and, because that parse failure propagated with
/// `?`, it bypassed the only `upload_error` emitter entirely and left the
/// frontend waiting forever. See issue #150.
pub fn classify_response(status: reqwest::StatusCode, body: &str) -> Result<Value, String> {
    if status.is_success() {
        let parsed: Value = serde_json::from_str(body).map_err(|e| {
            format!(
                "Sprout returned HTTP {} but the response body was not valid JSON ({}): {}",
                status,
                e,
                body_excerpt(body)
            )
        })?;

        // A 2xx carrying `null`, `[]` or a bare string parses fine but is not a
        // video record. Treating it as success emits `upload_complete` with a
        // useless payload, so the user is told the upload worked and no video
        // link appears. Require the `id` the frontend actually reads.
        if parsed.get("id").is_none() {
            return Err(format!(
                "Sprout returned HTTP {} with an unexpected JSON shape (no \"id\"): {}",
                status,
                body_excerpt(body)
            ));
        }

        Ok(parsed)
    } else {
        Err(format!(
            "Sprout rejected the request: HTTP {} — {}",
            status,
            body_excerpt(body)
        ))
    }
}
