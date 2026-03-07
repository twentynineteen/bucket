use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use app_lib::media::{TrelloCard, VideoLink};

// Performance optimization constants
pub const PROGRESS_UPDATE_INTERVAL: Duration = Duration::from_millis(100);
pub const SKIP_PATTERNS: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "vendor",
    "build",
    "dist",
    "target",
    ".cache",
    "tmp",
    "temp",
    "__pycache__",
    ".DS_Store",
];

// Stale breadcrumbs detection constants
pub const STALE_SIZE_THRESHOLD_BYTES: u64 = 1024;

// Data structures matching TypeScript interfaces
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFolder {
    pub path: String,
    pub name: String,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    #[serde(rename = "hasBreadcrumbs")]
    pub has_breadcrumbs: bool,
    #[serde(rename = "staleBreadcrumbs")]
    pub stale_breadcrumbs: bool,
    #[serde(rename = "lastScanned")]
    pub last_scanned: String,
    #[serde(rename = "cameraCount")]
    pub camera_count: i32,
    #[serde(rename = "validationErrors")]
    pub validation_errors: Vec<String>,
    #[serde(rename = "invalidBreadcrumbs")]
    pub invalid_breadcrumbs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbsFile {
    #[serde(rename = "projectTitle")]
    pub project_title: String,
    #[serde(rename = "numberOfCameras")]
    pub number_of_cameras: i32,
    pub files: Vec<FileInfo>,
    #[serde(rename = "parentFolder")]
    pub parent_folder: String,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "creationDateTime")]
    pub creation_date_time: String,
    #[serde(rename = "folderSizeBytes")]
    pub folder_size_bytes: Option<u64>,
    #[serde(rename = "lastModified")]
    pub last_modified: Option<String>,
    #[serde(rename = "scannedBy")]
    pub scanned_by: Option<String>,

    // === DEPRECATED FIELD (keep for backward compatibility) ===
    #[serde(rename = "trelloCardUrl")]
    pub trello_card_url: Option<String>,

    // === NEW FIELDS (Phase 004) ===
    /// Array of video links associated with this project
    #[serde(rename = "videoLinks", skip_serializing_if = "Option::is_none")]
    pub video_links: Option<Vec<VideoLink>>,

    /// Array of Trello cards associated with this project
    #[serde(rename = "trelloCards", skip_serializing_if = "Option::is_none")]
    pub trello_cards: Option<Vec<TrelloCard>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub camera: i32,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: Option<String>,
    #[serde(rename = "rootPath")]
    pub root_path: String,
    #[serde(rename = "totalFolders")]
    pub total_folders: i32,
    #[serde(rename = "validProjects")]
    pub valid_projects: i32,
    #[serde(rename = "updatedBreadcrumbs")]
    pub updated_breadcrumbs: i32,
    #[serde(rename = "createdBreadcrumbs")]
    pub created_breadcrumbs: i32,
    #[serde(rename = "totalFolderSize")]
    pub total_folder_size: u64,
    pub errors: Vec<ScanError>,
    pub projects: Vec<ProjectFolder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanError {
    pub path: String,
    pub r#type: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    #[serde(rename = "maxDepth")]
    pub max_depth: i32,
    #[serde(rename = "includeHidden")]
    pub include_hidden: bool,
    #[serde(rename = "createMissing")]
    pub create_missing: bool,
    #[serde(rename = "backupOriginals")]
    pub backup_originals: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUpdateResult {
    pub successful: Vec<String>,
    pub failed: Vec<FailedUpdate>,
    pub created: Vec<String>,
    pub updated: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedUpdate {
    pub path: String,
    pub error: String,
}

// Event payloads for progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgressEvent {
    #[serde(rename = "scanId")]
    pub scan_id: String,
    #[serde(rename = "foldersScanned")]
    pub folders_scanned: i32,
    #[serde(rename = "totalFolders")]
    pub total_folders: i32,
    #[serde(rename = "currentPath")]
    pub current_path: String,
    #[serde(rename = "projectsFound")]
    pub projects_found: i32,
}

// Scan state management
pub struct ScanState {
    pub scans: Arc<Mutex<HashMap<String, ScanResult>>>,
}

impl ScanState {
    pub fn new() -> Self {
        Self {
            scans: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
