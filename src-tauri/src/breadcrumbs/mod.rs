//! The one owner of a project's `breadcrumbs.json` (#303).
//!
//! Every read and write of the file goes through three operations:
//!
//! - [`read`] is forgiving: it repairs drifted shapes in memory and reports
//!   each repair as a [`Fix`], but never writes.
//! - [`apply`] runs read, then a named [`Change`], then an atomic write, under
//!   a per-file lock. The fixes a read made are persisted by that write.
//! - [`preview`] runs exactly the code `apply` runs and skips the write, so a
//!   preview can never disagree with the file it describes.
//!
//! Callers name a project by its folder. The file name and location are this
//! module's business; nothing outside it builds a path to `breadcrumbs.json`.
//!
//! The module also owns the footage facts the file records (the camera files,
//! the `Camera N` folder count and the folder size), which Baker's scanner
//! calls rather than duplicating.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::media::{TrelloCard, VideoLink};

#[cfg(test)]
mod tests;

/// Most video links one project may hold.
pub const MAX_VIDEO_LINKS: usize = 20;

/// Most Trello cards one project may hold.
pub const MAX_TRELLO_CARDS: usize = 50;

/// One footage file, as recorded in the breadcrumbs file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileInfo {
    /// The `N` of the `Footage/Camera N` folder holding the file.
    pub camera: i32,
    pub name: String,
    /// Project-relative (`Footage/Camera N/<name>`). Files written by older
    /// versions may hold an absolute path, which callers use as it is.
    pub path: String,
}

/// A project's `breadcrumbs.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Breadcrumbs {
    pub project_title: String,
    pub number_of_cameras: i32,
    pub files: Vec<FileInfo>,
    /// The folder that contains the project folder.
    pub parent_folder: String,
    pub created_by: String,
    pub creation_date_time: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_size_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scanned_by: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub video_links: Vec<VideoLink>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub trello_cards: Vec<TrelloCard>,
    /// Fields this version does not know, kept so a newer version's data
    /// survives an older version's write.
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// A repair [`read`] made to a drifted file. Persisted by the next apply.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Fix {
    /// `createdBy` was an object; its `data` string (or "Unknown") was used.
    CreatedByNotAString,
    /// The legacy `trelloCardUrl` was moved into `trelloCards`.
    MigratedTrelloCardUrl,
    /// `parentFolder` named the project folder itself, not its container.
    ParentFolderWasProjectFolder,
}

/// What [`read`] found.
#[derive(Debug, Clone, PartialEq)]
pub enum Read {
    /// The project has no `breadcrumbs.json`.
    Missing,
    /// The file, with any repairs made in memory.
    Found { file: Breadcrumbs, fixes: Vec<Fix> },
    /// Not valid JSON, or missing a required field. Only [`Change::Rescan`]
    /// can recover it.
    Unreadable { reason: String },
}

/// A named edit to a breadcrumbs file. There is deliberately no generic patch.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Change {
    /// Write a new file for a freshly built project, from its footage.
    Create {
        title: String,
        created_by: String,
    },
    /// Re-read the footage; creates the file if missing, regenerates it if
    /// unreadable.
    Rescan,
    /// Recalculate only `folderSizeBytes`.
    RefreshSizes,
    AddVideoLink {
        link: VideoLink,
    },
    /// Replace the link at `index`, provided it still has `expected_url`.
    UpdateVideoLink {
        index: usize,
        expected_url: String,
        link: VideoLink,
    },
    RemoveVideoLink {
        index: usize,
    },
    ReorderVideoLinks {
        from: usize,
        to: usize,
    },
    /// Adding a card that is already linked succeeds and changes nothing.
    AddTrelloCard {
        card: TrelloCard,
    },
    RemoveTrelloCard {
        card_id: String,
    },
}

/// Why a change could not be applied to one project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ChangeError {
    ProjectNotFound,
    /// The change needs an existing file and there is none.
    NoBreadcrumbs,
    /// `create` was asked for a project that already has a file.
    AlreadyExists,
    /// The file cannot be read; only a rescan can recover it.
    Unreadable {
        reason: String,
    },
    /// Neither `Footage/` nor a breadcrumbs file: nothing to describe.
    NothingToDescribe,
    LimitReached {
        limit: usize,
    },
    IndexOutOfRange {
        index: usize,
    },
    /// The link at the index no longer has the URL the caller last saw.
    LinkChanged {
        expected_url: String,
        actual_url: String,
    },
    CardNotLinked {
        card_id: String,
    },
    Io {
        message: String,
    },
}

/// A change worked out but not written.
#[derive(Debug, Clone, PartialEq)]
pub struct Preview {
    /// The file as read, or `None` when there was none (or it was unreadable).
    pub before: Option<Breadcrumbs>,
    /// The file `apply` would write.
    pub after: Breadcrumbs,
}

/// Reads a project's breadcrumbs file, repairing drifted shapes in memory.
pub fn read(project: &Path) -> Read {
    let _ = project;
    todo!("#303")
}

/// Applies `change` to each project in turn. Results are in input order; one
/// project failing does not stop the others.
pub fn apply<P: AsRef<Path>>(
    projects: &[P],
    change: &Change,
) -> Vec<Result<Breadcrumbs, ChangeError>> {
    let _ = (projects, change);
    todo!("#303")
}

/// Works out what [`apply`] would write, without writing anything.
pub fn preview<P: AsRef<Path>>(
    projects: &[P],
    change: &Change,
) -> Vec<Result<Preview, ChangeError>> {
    let _ = (projects, change);
    todo!("#303")
}

/// The generated TypeScript for every type the frontend sees, plus the limit
/// constants. Committed at [`BINDINGS_PATH`]; a test fails when it is stale.
pub fn typescript_bindings() -> String {
    todo!("#303")
}

/// Where the generated TypeScript lives, relative to `src-tauri/`.
pub const BINDINGS_PATH: &str = "../src/features/Breadcrumbs/internal/bindings.generated.ts";
