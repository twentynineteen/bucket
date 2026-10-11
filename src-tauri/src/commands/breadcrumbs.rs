//! Tauri commands for the breadcrumbs module (#303). Glue only: every rule
//! lives in `app_lib::breadcrumbs`, which is tested without Tauri.

use app_lib::breadcrumbs::{self, ApplyOutcome, Change, PreviewOutcome, Read};
use tauri::async_runtime::spawn_blocking;

/// Reads one project's breadcrumbs file, repairing drifted shapes in memory.
#[tauri::command]
pub async fn breadcrumbs_read(project_path: String) -> Result<Read, String> {
    spawn_blocking(move || breadcrumbs::read(project_path.as_ref()))
        .await
        .map_err(|e| e.to_string())
}

/// Applies one named change to each project, in order.
#[tauri::command]
pub async fn breadcrumbs_apply(
    project_paths: Vec<String>,
    change: Change,
) -> Result<Vec<ApplyOutcome>, String> {
    spawn_blocking(move || breadcrumbs::apply_outcomes(&project_paths, &change))
        .await
        .map_err(|e| e.to_string())
}

/// Works out what `breadcrumbs_apply` would write, without writing.
#[tauri::command]
pub async fn breadcrumbs_preview(
    project_paths: Vec<String>,
    change: Change,
) -> Result<Vec<PreviewOutcome>, String> {
    spawn_blocking(move || breadcrumbs::preview_outcomes(&project_paths, &change))
        .await
        .map_err(|e| e.to_string())
}
