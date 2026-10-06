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

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use ts_rs::TS;

use crate::media::{TrelloCard, VideoLink};

pub mod footage;
mod store;

#[cfg(test)]
mod tests;

/// Most video links one project may hold.
pub const MAX_VIDEO_LINKS: usize = 20;

/// Most Trello cards one project may hold.
pub const MAX_TRELLO_CARDS: usize = 50;

/// Where the generated TypeScript lives, relative to `src-tauri/`.
pub const BINDINGS_PATH: &str = "../src/features/Breadcrumbs/internal/bindings.generated.ts";

const FILE_NAME: &str = "breadcrumbs.json";
const BACKUP_NAME: &str = "breadcrumbs.json.bak";
const TEMP_PREFIX: &str = ".breadcrumbs.json.tmp-";

/// Who `createdBy` names when Baker had to write the file itself.
const BAKER: &str = "Baker";

/// One footage file, as recorded in the breadcrumbs file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
pub struct FileInfo {
    /// The `N` of the `Footage/Camera N` folder holding the file.
    pub camera: i32,
    pub name: String,
    /// Project-relative (`Footage/Camera N/<name>`). Files written by older
    /// versions may hold an absolute path, which callers use as it is.
    pub path: String,
}

/// A project's `breadcrumbs.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields)]
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
    #[ts(as = "Option<Vec<VideoLink>>")]
    pub video_links: Vec<VideoLink>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<TrelloCard>>")]
    pub trello_cards: Vec<TrelloCard>,
    /// Fields this version does not know, kept so a newer version's data
    /// survives an older version's write. Left out of the TypeScript so the
    /// known fields keep strict types.
    #[serde(flatten)]
    #[ts(skip)]
    pub extra: Map<String, Value>,
}

/// A repair [`read`] made to a drifted file. Persisted by the next apply.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
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
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
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

impl std::fmt::Display for ChangeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ProjectNotFound => write!(f, "Project folder does not exist"),
            Self::NoBreadcrumbs => write!(f, "This project has no breadcrumbs file"),
            Self::AlreadyExists => write!(f, "This project already has a breadcrumbs file"),
            Self::Unreadable { reason } => {
                write!(f, "The breadcrumbs file could not be read ({reason}); repair it first")
            }
            Self::NothingToDescribe => {
                write!(f, "No Footage folder or breadcrumbs file: nothing to describe")
            }
            Self::LimitReached { limit } => write!(f, "Limit of {limit} reached for this project"),
            Self::IndexOutOfRange { index } => write!(f, "No item at position {index}"),
            Self::LinkChanged { expected_url, actual_url } => write!(
                f,
                "The video link changed while you were working (expected {expected_url}, found {actual_url})"
            ),
            Self::CardNotLinked { card_id } => {
                write!(f, "Trello card {card_id} is not linked to this project")
            }
            Self::Io { message } => write!(f, "Could not write the breadcrumbs file: {message}"),
        }
    }
}

/// A change worked out but not written.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
pub struct Preview {
    /// The file as read, or `None` when there was none (or it was unreadable).
    pub before: Option<Breadcrumbs>,
    /// The file `apply` would write.
    pub after: Breadcrumbs,
}

/// One project's result from [`apply`], as it crosses to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ApplyOutcome {
    Applied {
        project: String,
        file: Breadcrumbs,
    },
    /// `message` is the error in user-facing words, ready for a toast.
    Failed {
        project: String,
        error: ChangeError,
        message: String,
    },
}

/// One project's result from [`preview`], as it crosses to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum PreviewOutcome {
    Previewed {
        project: String,
        preview: Preview,
    },
    Failed {
        project: String,
        error: ChangeError,
        message: String,
    },
}

/// [`apply`], labelled per project for the frontend.
pub fn apply_outcomes(projects: &[String], change: &Change) -> Vec<ApplyOutcome> {
    projects
        .iter()
        .zip(apply(projects, change))
        .map(|(project, result)| match result {
            Ok(file) => ApplyOutcome::Applied {
                project: project.clone(),
                file,
            },
            Err(error) => ApplyOutcome::Failed {
                project: project.clone(),
                message: error.to_string(),
                error,
            },
        })
        .collect()
}

/// [`preview`], labelled per project for the frontend.
pub fn preview_outcomes(projects: &[String], change: &Change) -> Vec<PreviewOutcome> {
    projects
        .iter()
        .zip(preview(projects, change))
        .map(|(project, result)| match result {
            Ok(preview) => PreviewOutcome::Previewed {
                project: project.clone(),
                preview,
            },
            Err(error) => PreviewOutcome::Failed {
                project: project.clone(),
                message: error.to_string(),
                error,
            },
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/// Reads a project's breadcrumbs file, repairing drifted shapes in memory.
pub fn read(project: &Path) -> Read {
    match read_with_bytes(project) {
        OnDisk::Missing => Read::Missing,
        OnDisk::Found { file, fixes, .. } => Read::Found { file, fixes },
        OnDisk::Unreadable { reason, .. } => Read::Unreadable { reason },
    }
}

/// [`Read`], plus the original bytes a backup would need.
enum OnDisk {
    Missing,
    Found {
        file: Breadcrumbs,
        fixes: Vec<Fix>,
        bytes: Vec<u8>,
    },
    Unreadable {
        reason: String,
        bytes: Vec<u8>,
    },
}

fn read_with_bytes(project: &Path) -> OnDisk {
    let path = project.join(FILE_NAME);
    if !path.is_file() {
        return OnDisk::Missing;
    }
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(e) => {
            return OnDisk::Unreadable {
                reason: e.to_string(),
                bytes: Vec::new(),
            }
        }
    };
    match parse(&bytes, project) {
        Ok((file, fixes)) => OnDisk::Found { file, fixes, bytes },
        Err(reason) => OnDisk::Unreadable { reason, bytes },
    }
}

fn parse(bytes: &[u8], project: &Path) -> Result<(Breadcrumbs, Vec<Fix>), String> {
    let mut value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let map = value.as_object_mut().ok_or("not a JSON object")?;
    let fixes = repair(map, project);
    let file = serde_json::from_value(value).map_err(|e| e.to_string())?;
    Ok((file, fixes))
}

/// Repairs the drifted shapes older versions wrote, recording each one.
fn repair(map: &mut Map<String, Value>, project: &Path) -> Vec<Fix> {
    let mut fixes = Vec::new();

    if let Some(Value::Object(created_by)) = map.get("createdBy") {
        let name = created_by
            .get("data")
            .and_then(Value::as_str)
            .unwrap_or("Unknown");
        map.insert("createdBy".into(), Value::String(name.to_string()));
        fixes.push(Fix::CreatedByNotAString);
    }

    // Older versions wrote `"trelloCardUrl": null` on every save; dropping a
    // null loses nothing, so only a real URL counts as a fix.
    if let Some(legacy) = map.remove("trelloCardUrl") {
        if let Some(url) = legacy.as_str() {
            migrate_trello_card_url(map, url);
            fixes.push(Fix::MigratedTrelloCardUrl);
        }
    }

    // A null list is an empty list.
    for key in ["videoLinks", "trelloCards"] {
        if map.get(key) == Some(&Value::Null) {
            map.remove(key);
        }
    }

    if let (Some(Value::String(parent)), Some(name)) =
        (map.get("parentFolder"), project.file_name())
    {
        let stored = Path::new(parent);
        if stored.file_name() == Some(name) {
            let container = stored
                .parent()
                .unwrap_or(stored)
                .to_string_lossy()
                .to_string();
            map.insert("parentFolder".into(), Value::String(container));
            fixes.push(Fix::ParentFolderWasProjectFolder);
        }
    }

    fixes
}

fn migrate_trello_card_url(map: &mut Map<String, Value>, url: &str) {
    let Some(card_id) = trello_card_id(url) else {
        return;
    };
    let cards = map
        .entry("trelloCards")
        .or_insert_with(|| Value::Array(Vec::new()));
    let Value::Array(cards) = cards else {
        return;
    };
    let already_linked = cards
        .iter()
        .any(|card| card.get("cardId").and_then(Value::as_str) == Some(card_id.as_str()));
    if !already_linked {
        let card = TrelloCard {
            url: url.to_string(),
            card_id: card_id.clone(),
            title: format!("Card {card_id}"),
            board_name: None,
            last_fetched: None,
        };
        cards.push(serde_json::to_value(card).expect("a TrelloCard always serialises"));
    }
}

/// The card ID in a `trello.com/c/<id>` URL.
fn trello_card_id(url: &str) -> Option<String> {
    let rest = &url[url.find("trello.com/c/")? + "trello.com/c/".len()..];
    let id: String = rest
        .chars()
        .take_while(char::is_ascii_alphanumeric)
        .collect();
    (8..=24).contains(&id.len()).then_some(id)
}

// ---------------------------------------------------------------------------
// Apply and preview
// ---------------------------------------------------------------------------

/// Applies `change` to each project in turn. Results are in input order; one
/// project failing does not stop the others.
pub fn apply<P: AsRef<Path>>(
    projects: &[P],
    change: &Change,
) -> Vec<Result<Breadcrumbs, ChangeError>> {
    projects
        .iter()
        .map(|project| apply_one(project.as_ref(), change))
        .collect()
}

/// Works out what [`apply`] would write, without writing anything.
pub fn preview<P: AsRef<Path>>(
    projects: &[P],
    change: &Change,
) -> Vec<Result<Preview, ChangeError>> {
    projects
        .iter()
        .map(|project| {
            let project = project.as_ref();
            let lock = store::lock_for(project);
            let _held = lock.lock().unwrap_or_else(|e| e.into_inner());
            let plan = plan(project, change)?;
            Ok(Preview {
                before: plan.before,
                after: plan.after,
            })
        })
        .collect()
}

fn apply_one(project: &Path, change: &Change) -> Result<Breadcrumbs, ChangeError> {
    let lock = store::lock_for(project);
    let _held = lock.lock().unwrap_or_else(|e| e.into_inner());

    let plan = plan(project, change)?;
    if plan.unchanged {
        return Ok(plan.after);
    }

    let io = |e: std::io::Error| ChangeError::Io {
        message: e.to_string(),
    };
    let json = serde_json::to_vec_pretty(&plan.after).map_err(|e| ChangeError::Io {
        message: e.to_string(),
    })?;
    if let Some(original) = &plan.backup {
        store::write_atomically(&project.join(BACKUP_NAME), original).map_err(io)?;
    }
    store::write_atomically(&project.join(FILE_NAME), &json).map_err(io)?;
    Ok(plan.after)
}

/// What a change would do to one project. Shared by apply and preview, which
/// is what keeps them in agreement.
struct Plan {
    before: Option<Breadcrumbs>,
    after: Breadcrumbs,
    /// Original bytes to keep as `breadcrumbs.json.bak` before writing.
    backup: Option<Vec<u8>>,
    /// Nothing changed and nothing needed fixing, so there is nothing to write.
    unchanged: bool,
}

fn plan(project: &Path, change: &Change) -> Result<Plan, ChangeError> {
    if !project.is_dir() {
        return Err(ChangeError::ProjectNotFound);
    }
    let on_disk = read_with_bytes(project);

    let mut plan = match (change, on_disk) {
        (Change::Create { .. }, OnDisk::Missing) => {
            Plan::new(None, new_file(project, change)?, None)
        }
        (Change::Create { .. }, _) => return Err(ChangeError::AlreadyExists),

        (Change::Rescan, OnDisk::Missing) => Plan::new(None, new_file(project, change)?, None),
        (Change::Rescan, OnDisk::Unreadable { bytes, .. }) => {
            let mut file = new_file(project, change)?;
            salvage_links(&bytes, &mut file);
            Plan::new(None, file, Some(bytes))
        }

        (_, OnDisk::Missing) => return Err(ChangeError::NoBreadcrumbs),
        (_, OnDisk::Unreadable { reason, .. }) => return Err(ChangeError::Unreadable { reason }),

        (_, OnDisk::Found { file, fixes, bytes }) => {
            let backup = (!fixes.is_empty()).then_some(bytes);
            let mut after = file.clone();
            let changed = edit(project, change, &mut after)?;
            let mut plan = Plan::new(Some(file), after, backup);
            plan.unchanged = !changed && plan.backup.is_none();
            plan
        }
    };

    plan.after.last_modified = Some(now());
    if plan.unchanged {
        plan.after.last_modified = plan.before.as_ref().and_then(|b| b.last_modified.clone());
    }
    Ok(plan)
}

impl Plan {
    fn new(before: Option<Breadcrumbs>, after: Breadcrumbs, backup: Option<Vec<u8>>) -> Self {
        Plan {
            before,
            after,
            backup,
            unchanged: false,
        }
    }
}

/// Applies a change to an existing file. Returns whether anything changed.
fn edit(project: &Path, change: &Change, file: &mut Breadcrumbs) -> Result<bool, ChangeError> {
    let in_range = |index: usize, len: usize| {
        if index < len {
            Ok(())
        } else {
            Err(ChangeError::IndexOutOfRange { index })
        }
    };

    match change {
        Change::Create { .. } => unreachable!("create never edits an existing file"),
        Change::Rescan => {
            file.files = footage::camera_files(project);
            file.number_of_cameras = footage::camera_folder_count(project);
            file.folder_size_bytes = footage::folder_size(project).ok();
            file.scanned_by = Some(BAKER.to_string());
        }
        Change::RefreshSizes => {
            let size = footage::folder_size(project).map_err(|e| ChangeError::Io {
                message: e.to_string(),
            })?;
            file.folder_size_bytes = Some(size);
        }
        Change::AddVideoLink { link } => {
            if file.video_links.len() >= MAX_VIDEO_LINKS {
                return Err(ChangeError::LimitReached {
                    limit: MAX_VIDEO_LINKS,
                });
            }
            file.video_links.push(link.clone());
        }
        Change::UpdateVideoLink {
            index,
            expected_url,
            link,
        } => {
            in_range(*index, file.video_links.len())?;
            let current = &mut file.video_links[*index];
            if &current.url != expected_url {
                return Err(ChangeError::LinkChanged {
                    expected_url: expected_url.clone(),
                    actual_url: current.url.clone(),
                });
            }
            *current = link.clone();
        }
        Change::RemoveVideoLink { index } => {
            in_range(*index, file.video_links.len())?;
            file.video_links.remove(*index);
        }
        Change::ReorderVideoLinks { from, to } => {
            in_range(*from, file.video_links.len())?;
            in_range(*to, file.video_links.len())?;
            let moved = file.video_links.remove(*from);
            file.video_links.insert(*to, moved);
        }
        Change::AddTrelloCard { card } => {
            if file.trello_cards.iter().any(|c| c.card_id == card.card_id) {
                return Ok(false);
            }
            if file.trello_cards.len() >= MAX_TRELLO_CARDS {
                return Err(ChangeError::LimitReached {
                    limit: MAX_TRELLO_CARDS,
                });
            }
            file.trello_cards.push(card.clone());
        }
        Change::RemoveTrelloCard { card_id } => {
            let before = file.trello_cards.len();
            file.trello_cards.retain(|c| &c.card_id != card_id);
            if file.trello_cards.len() == before {
                return Err(ChangeError::CardNotLinked {
                    card_id: card_id.clone(),
                });
            }
        }
    }
    Ok(true)
}

/// A file written from the folder alone: by `create`, or by `rescan` when
/// there is no usable file.
fn new_file(project: &Path, change: &Change) -> Result<Breadcrumbs, ChangeError> {
    let folder_name = project
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let (title, created_by, scanned_by) = match change {
        Change::Create { title, created_by } => (title.clone(), created_by.clone(), None),
        _ => {
            let has_footage = project.join("Footage").is_dir();
            if !has_footage && !project.join(FILE_NAME).exists() {
                return Err(ChangeError::NothingToDescribe);
            }
            (folder_name, BAKER.to_string(), Some(BAKER.to_string()))
        }
    };

    Ok(Breadcrumbs {
        project_title: title,
        number_of_cameras: footage::camera_folder_count(project),
        files: footage::camera_files(project),
        parent_folder: project
            .parent()
            .unwrap_or(project)
            .to_string_lossy()
            .to_string(),
        created_by,
        creation_date_time: now(),
        folder_size_bytes: footage::folder_size(project).ok(),
        last_modified: None,
        scanned_by,
        video_links: Vec::new(),
        trello_cards: Vec::new(),
        extra: Map::new(),
    })
}

/// Keeps whatever link lists can still be read from a file that as a whole
/// cannot. Each list is all-or-nothing; a broken one is left behind in the
/// backup rather than half-copied.
fn salvage_links(bytes: &[u8], file: &mut Breadcrumbs) {
    let Ok(Value::Object(mut map)) = serde_json::from_slice::<Value>(bytes) else {
        return;
    };
    if let Some(Value::String(url)) = map.remove("trelloCardUrl") {
        migrate_trello_card_url(&mut map, &url);
    }
    if let Some(Ok(links)) = map.remove("videoLinks").map(serde_json::from_value) {
        file.video_links = links;
    }
    if let Some(Ok(cards)) = map.remove("trelloCards").map(serde_json::from_value) {
        file.trello_cards = cards;
    }
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------------------
// TypeScript bindings
// ---------------------------------------------------------------------------

/// The generated TypeScript for every type the frontend sees, plus the limit
/// constants. Committed at [`BINDINGS_PATH`]; a test fails when it is stale.
pub fn typescript_bindings() -> String {
    // u64 sizes are far below 2^53, so a plain number is exact.
    let cfg = ts_rs::Config::new().with_large_int("number");
    let decls = [
        FileInfo::decl(&cfg),
        VideoLink::decl(&cfg),
        TrelloCard::decl(&cfg),
        Breadcrumbs::decl(&cfg),
        Fix::decl(&cfg),
        Change::decl(&cfg),
        ChangeError::decl(&cfg),
        Read::decl(&cfg),
        Preview::decl(&cfg),
        ApplyOutcome::decl(&cfg),
        PreviewOutcome::decl(&cfg),
    ];

    let mut out = String::from(
        "// Generated from src-tauri/src/breadcrumbs by\n\
         // `UPDATE_BINDINGS=1 cargo test b11_2` in src-tauri. Do not edit by hand.\n\n",
    );
    for decl in decls {
        out.push_str("export ");
        out.push_str(&decl);
        out.push_str("\n\n");
    }
    out.push_str(&format!(
        "export const MAX_VIDEO_LINKS = {MAX_VIDEO_LINKS}\n\n"
    ));
    out.push_str(&format!(
        "export const MAX_TRELLO_CARDS = {MAX_TRELLO_CARDS}\n"
    ));
    out
}
