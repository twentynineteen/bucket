//! Adapters from the old `baker_*` command shapes to the breadcrumbs module
//! (#303). The frontend still matches on some of the old error strings
//! (`videoLinksError.ts`, `trelloCardsError.ts`), so they are kept here until
//! PR 2 moves it to the typed errors and deletes this file.

use std::path::Path;

use app_lib::breadcrumbs::{self, Breadcrumbs, Change, ChangeError, Read};

/// The message an old command returned for each error.
pub fn legacy_message(error: &ChangeError) -> String {
    match error {
        ChangeError::ProjectNotFound => "Project path does not exist".to_string(),
        ChangeError::Unreadable { reason } => {
            format!("Failed to parse breadcrumbs file: {reason}")
        }
        ChangeError::NoBreadcrumbs => "No breadcrumbs file found".to_string(),
        other => other.to_string(),
    }
}

/// The old `baker_read_breadcrumbs` contract: `None` when there is no file, an
/// error when the folder is missing or the file cannot be read.
pub fn read_legacy(project_path: &str) -> Result<Option<Breadcrumbs>, String> {
    let project = Path::new(project_path);
    if !project.exists() {
        return Err(legacy_message(&ChangeError::ProjectNotFound));
    }
    match breadcrumbs::read(project) {
        Read::Missing => Ok(None),
        Read::Found { file, .. } => Ok(Some(file)),
        Read::Unreadable { reason } => Err(legacy_message(&ChangeError::Unreadable { reason })),
        Read::ProjectNotFound => Err(legacy_message(&ChangeError::ProjectNotFound)),
        Read::Inaccessible { reason } => Err(format!("Failed to read breadcrumbs file: {reason}")),
    }
}

/// Applies one change to one project, with the old error strings.
pub fn apply_legacy(project_path: &str, change: Change) -> Result<Breadcrumbs, String> {
    breadcrumbs::apply(&[project_path], &change)
        .pop()
        .expect("one project in, one result out")
        .map_err(|e| legacy_message(&e))
}
