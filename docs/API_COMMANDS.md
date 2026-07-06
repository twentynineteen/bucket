# Bucket Tauri Commands API Reference

## Overview

This document provides complete reference documentation for all Tauri commands exposed by the Bucket Rust backend. These commands are called from the React frontend using Tauri's `invoke()` function.

**Target audience:** Frontend developers building features that interact with the Rust backend.

**Last updated:** July 2026 (v0.16.0)

---

## Table of Contents

1. [Authentication](#authentication)
2. [System Utilities](#system-utilities)
3. [File Operations (BuildProject)](#file-operations-buildproject)
4. [Baker: Scanning](#baker-scanning)
5. [Baker: Breadcrumbs](#baker-breadcrumbs)
6. [Baker: Video Links](#baker-video-links)
7. [Baker: Trello Cards](#baker-trello-cards)
8. [Trello Boards](#trello-boards)
9. [Sprout Video](#sprout-video)
10. [DOCX Processing](#docx-processing)
11. [AI Provider Validation](#ai-provider-validation)
12. [RAG: Script Similarity Search](#rag-script-similarity-search)
13. [RAG: Example Management](#rag-example-management)
14. [Adobe Premiere Integration](#adobe-premiere-integration)
15. [Premiere Pro Plugin Management](#premiere-pro-plugin-management)

---

## Authentication

Simple token-based authentication for user sessions.

### `check_auth`

**Purpose:** Verify if a token is valid.

**Rust signature:**

```rust
pub fn check_auth(token: String, state: State<AuthState>) -> String
```

**Parameters:**

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `token`   | `String` | Authentication token to verify |

**Returns:** `String` -- `"authenticated"` or `"unauthorized"`

**Frontend usage** (`Auth/api.ts`):

```typescript
const result = await invoke<string>('check_auth', { token })
```

### `add_token`

**Purpose:** Add a token to the authenticated tokens list.

**Rust signature:**

```rust
pub fn add_token(token: String, state: State<AuthState>)
```

**Parameters:**

| Parameter | Type     | Description                       |
| --------- | -------- | --------------------------------- |
| `token`   | `String` | Token to add to valid tokens list |

**Returns:** `void`

**Frontend usage** (`Auth/api.ts`):

```typescript
await invoke('add_token', { token })
```

---

## System Utilities

### `get_username`

**Purpose:** Get the current OS username from environment variables.

**Rust signature:**

```rust
pub fn get_username() -> String
```

**Parameters:** None

**Returns:** `String` -- Username from `$USERNAME` or `$USER`, or `"Unknown User"` on failure.

**Frontend usage** (`shared/ui/layout/nav-user.tsx`, `shared/hooks/useUsername.ts`):

```typescript
const name = await invoke<string>('get_username')
```

### `open_folder`

**Purpose:** Open a folder in the system file explorer.

**Rust signature:**

```rust
pub fn open_folder(path: String)
```

**Parameters:**

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| `path`    | `String` | Folder path to open |

**Returns:** `void` (no Result -- panics on failure)

**Platform behavior:** macOS: Finder, Windows: Explorer, Linux: xdg-open.

**Frontend usage** (`Upload/api.ts`):

```typescript
await invoke('open_folder', { path })
```

### `graceful_restart`

**Purpose:** Restart the application by spawning a new process and exiting the current one. No-op in debug/development mode.

**Rust signature:**

```rust
pub async fn graceful_restart(_app_handle: AppHandle) -> Result<(), String>
```

**Parameters:** None (AppHandle auto-injected)

**Returns:** `Result<(), String>`

**Frontend usage** (`shared/hooks/useUpdateMutation.ts`):

```typescript
await invoke('graceful_restart')
```

### `open_resource_file`

**Purpose:** Read a file from the bundled resource directory and return its raw bytes.

**Rust signature:**

```rust
pub fn open_resource_file(handle: AppHandle, relative_file_path: &str) -> Result<Vec<u8>, String>
```

**Parameters:**

| Parameter            | Type     | Description                                    |
| -------------------- | -------- | ---------------------------------------------- |
| `relative_file_path` | `String` | Path relative to the resource directory         |

**Returns:** `Result<Vec<u8>, String>` -- Raw file bytes

**Note:** Used internally by `copy_premiere_project`; not directly called from frontend api.ts files.

### `show_confirmation_dialog`

**Purpose:** Display a Yes/No dialog and open the specified folder if the user clicks Yes.

**Rust signature:**

```rust
pub fn show_confirmation_dialog(
    app: tauri::AppHandle,
    message: String,
    title: String,
    destination: String,
) -> Result<(), String>
```

**Parameters:**

| Parameter     | Type     | Description                                 |
| ------------- | -------- | ------------------------------------------- |
| `message`     | `String` | Dialog message text                         |
| `title`       | `String` | Dialog title                                |
| `destination` | `String` | Folder path to open if user selects Yes     |

**Returns:** `Result<(), String>`

**Frontend usage** (`BuildProject/api.ts`, `Premiere/api.ts`):

```typescript
await invoke('show_confirmation_dialog', { message, title, destination })
```

---

## File Operations (BuildProject)

### `transfer_files_with_progress`

**Purpose:** Transfer files from source to destination paths with real-time progress tracking, cancellation support, and stall detection. On macOS, uses Apple's `copyfile(3)` syscall for O(1) APFS clones and kernel-level copies.

**Rust signature:**

```rust
pub async fn transfer_files_with_progress(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    request: TransferRequest,
) -> Result<String, FileTransferError>
```

**Parameters:**

| Parameter | Type              | Description                              |
| --------- | ----------------- | ---------------------------------------- |
| `request` | `TransferRequest` | Transfer request with file source/dest pairs |

**TransferRequest structure:**

```typescript
interface TransferRequest {
  files: Array<{
    source: string       // Source file path
    destination: string  // Destination file path
  }>
}
```

**Returns:** `Result<String, FileTransferError>` -- Operation ID (transfer runs in background)

**Events emitted:**

- `file-transfer-progress` -- Throttled progress updates (every 100ms)

  ```typescript
  interface TransferProgressEvent {
    operationId: string
    currentFile: string
    filesCompleted: number
    totalFiles: number
    bytesTransferred: number
    totalBytes: number
    percentage: number  // 0-100
  }
  ```

- `file-transfer-complete` -- Transfer finished (success, failure, or cancellation)

  ```typescript
  interface TransferComplete {
    operationId: string
    success: boolean
    filesTransferred: number
    error: string | null
  }
  ```

**Frontend usage** (`build-project/stages/fileTransfer.ts`):

```typescript
const operationId = await invoke<string>('transfer_files_with_progress', {
  request: { files: [{ source: '/path/to/file.mov', destination: '/dest/file.mov' }] }
})
```

### `cancel_file_transfer`

**Purpose:** Signal cancellation to an in-progress file transfer operation. The transfer stops at the next safe point and cleans up partial files.

**Rust signature:**

```rust
pub async fn cancel_file_transfer(
    registry: State<'_, OperationRegistry>,
    operation_id: String,
) -> Result<bool, String>
```

**Parameters:**

| Parameter      | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `operation_id` | `String` | Operation ID returned by `transfer_files_with_progress` |

**Returns:** `Result<bool, String>` -- `true` if cancellation was signalled, `false` if operation not found

**Frontend usage** (`build-project/stages/fileTransfer.ts`):

```typescript
await invoke('cancel_file_transfer', { operationId })
```

---

## Baker: Scanning

### `baker_start_scan`

**Purpose:** Start an asynchronous recursive directory scan to find BuildProject-compatible folders. Returns immediately with a scan ID; results arrive via events.

**Rust signature:**

```rust
pub async fn baker_start_scan(
    root_path: String,
    options: ScanOptions,
    state: State<'_, ScanState>,
    app_handle: AppHandle,
) -> Result<String, String>
```

**Parameters:**

| Parameter   | Type          | Description                                |
| ----------- | ------------- | ------------------------------------------ |
| `root_path` | `String`      | Root directory to scan                     |
| `options`   | `ScanOptions` | Scan configuration                         |

**ScanOptions structure:**

```typescript
interface ScanOptions {
  max_depth: number       // Minimum 1
  include_hidden: boolean
}
```

**Returns:** `Result<String, String>` -- Scan ID (UUID)

**Events emitted:** `baker_scan_complete`, `baker_scan_error`

**Frontend usage** (`Baker/api.ts`):

```typescript
const scanId = await invoke<string>('baker_start_scan', { rootPath, options })
```

### `baker_get_scan_status`

**Purpose:** Retrieve the result of a completed scan by its ID.

**Rust signature:**

```rust
pub async fn baker_get_scan_status(
    scan_id: String,
    state: State<'_, ScanState>,
) -> Result<ScanResult, String>
```

**Parameters:**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `scan_id` | `String` | Scan UUID   |

**Returns:** `Result<ScanResult, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const result = await invoke<ScanResult>('baker_get_scan_status', { scanId })
```

### `baker_cancel_scan`

**Purpose:** Cancel a running scan by setting its end time.

**Rust signature:**

```rust
pub async fn baker_cancel_scan(scan_id: String, state: State<'_, ScanState>) -> Result<(), String>
```

**Parameters:**

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `scan_id` | `String` | Scan UUID   |

**Returns:** `Result<(), String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
await invoke('baker_cancel_scan', { scanId })
```

### `baker_validate_folder`

**Purpose:** Validate whether a folder has the required BuildProject structure (Footage/, Graphics/, Renders/, Projects/, Scripts/) and check breadcrumbs state.

**Rust signature:**

```rust
pub async fn baker_validate_folder(folder_path: String) -> Result<ProjectFolder, String>
```

**Parameters:**

| Parameter     | Type     | Description          |
| ------------- | -------- | -------------------- |
| `folder_path` | `String` | Path to folder       |

**Returns:** `Result<ProjectFolder, String>`

**ProjectFolder structure:**

```typescript
interface ProjectFolder {
  path: string
  name: string
  is_valid: boolean
  has_breadcrumbs: boolean
  stale_breadcrumbs: boolean
  last_scanned: string
  camera_count: number
  validation_errors: string[]
  invalid_breadcrumbs: boolean
}
```

**Note:** Not currently called from frontend api.ts files; used internally by the scan pipeline.

---

## Baker: Breadcrumbs

### `baker_read_breadcrumbs`

**Purpose:** Read and parse the breadcrumbs.json file from a project directory.

**Rust signature:**

```rust
pub async fn baker_read_breadcrumbs(
    project_path: String,
) -> Result<Option<BreadcrumbsFile>, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<Option<BreadcrumbsFile>, String>` -- `None` if no breadcrumbs.json exists

**Frontend usage** (`Baker/api.ts`, `Trello/api.ts`):

```typescript
const breadcrumbs = await invoke<BreadcrumbsFile | null>('baker_read_breadcrumbs', { projectPath })
```

### `baker_read_raw_breadcrumbs`

**Purpose:** Read the raw JSON string of breadcrumbs.json without parsing into a typed struct. Useful for debugging or when the file has drifted schema.

**Rust signature:**

```rust
pub async fn baker_read_raw_breadcrumbs(project_path: String) -> Result<Option<String>, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<Option<String>, String>` -- Raw JSON string or `None`

**Frontend usage** (`Baker/api.ts`):

```typescript
const raw = await invoke<string | null>('baker_read_raw_breadcrumbs', { projectPath })
```

### `baker_update_breadcrumbs`

**Purpose:** Batch update or create breadcrumbs.json files for multiple project directories. Handles schema-drifted files by salvaging Trello cards and video links.

**Rust signature:**

```rust
pub async fn baker_update_breadcrumbs(
    project_paths: Vec<String>,
    create_missing: bool,
    backup_originals: bool,
) -> Result<BatchUpdateResult, String>
```

**Parameters:**

| Parameter          | Type           | Description                              |
| ------------------ | -------------- | ---------------------------------------- |
| `project_paths`    | `Vec<String>`  | List of project directories to update    |
| `create_missing`   | `bool`         | Create breadcrumbs.json if missing       |
| `backup_originals` | `bool`         | Backup existing files as .bak before update |

**Returns:** `Result<BatchUpdateResult, String>`

**BatchUpdateResult structure:**

```typescript
interface BatchUpdateResult {
  successful: string[]
  failed: Array<{ path: string; error: string }>
  created: string[]
  updated: string[]
}
```

**Frontend usage** (`Baker/api.ts`):

```typescript
const result = await invoke<BatchUpdateResult>('baker_update_breadcrumbs', {
  projectPaths,
  createMissing,
  backupOriginals
})
```

### `baker_scan_current_files`

**Purpose:** Scan camera files (Footage/Camera */) in a project directory and return file information.

**Rust signature:**

```rust
pub async fn baker_scan_current_files(project_path: String) -> Result<Vec<FileInfo>, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<Vec<FileInfo>, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const files = await invoke<FileInfo[]>('baker_scan_current_files', { projectPath })
```

### `get_folder_size`

**Purpose:** Calculate the total size of a directory in bytes.

**Rust signature:**

```rust
pub async fn get_folder_size(folder_path: String) -> Result<u64, String>
```

**Parameters:**

| Parameter     | Type     | Description    |
| ------------- | -------- | -------------- |
| `folder_path` | `String` | Directory path |

**Returns:** `Result<u64, String>` -- Size in bytes

**Frontend usage** (`Baker/api.ts`, `BuildProject/api.ts`):

```typescript
const size = await invoke<number>('get_folder_size', { folderPath })
```

---

## Baker: Video Links

### `baker_get_video_links`

**Purpose:** Get all video links from a project's breadcrumbs.json.

**Rust signature:**

```rust
pub async fn baker_get_video_links(project_path: String) -> Result<Vec<VideoLink>, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<Vec<VideoLink>, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const links = await invoke<VideoLink[]>('baker_get_video_links', { projectPath })
```

### `baker_associate_video_link`

**Purpose:** Add a video link to a project's breadcrumbs. Maximum 20 videos per project.

**Rust signature:**

```rust
pub async fn baker_associate_video_link(
    project_path: String,
    video_link: VideoLink,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type        | Description           |
| -------------- | ----------- | --------------------- |
| `project_path` | `String`    | Project directory path |
| `video_link`   | `VideoLink` | Video link to add     |

**Returns:** `Result<BreadcrumbsFile, String>` -- Updated breadcrumbs

**Frontend usage** (`Baker/api.ts`):

```typescript
const updated = await invoke<BreadcrumbsFile>('baker_associate_video_link', {
  projectPath,
  videoLink
})
```

### `baker_remove_video_link`

**Purpose:** Remove a video link by its index in the array.

**Rust signature:**

```rust
pub async fn baker_remove_video_link(
    project_path: String,
    video_index: usize,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |
| `video_index`  | `usize`  | Zero-based index      |

**Returns:** `Result<BreadcrumbsFile, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const updated = await invoke<BreadcrumbsFile>('baker_remove_video_link', {
  projectPath,
  videoIndex
})
```

### `baker_update_video_link`

**Purpose:** Replace a video link at a specific index with updated data.

**Rust signature:**

```rust
pub async fn baker_update_video_link(
    project_path: String,
    video_index: usize,
    updated_link: VideoLink,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type        | Description             |
| -------------- | ----------- | ----------------------- |
| `project_path` | `String`    | Project directory path   |
| `video_index`  | `usize`     | Zero-based index         |
| `updated_link` | `VideoLink` | Replacement video link   |

**Returns:** `Result<BreadcrumbsFile, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const updated = await invoke<BreadcrumbsFile>('baker_update_video_link', {
  projectPath,
  videoIndex,
  updatedLink
})
```

### `baker_reorder_video_links`

**Purpose:** Move a video link from one position to another.

**Rust signature:**

```rust
pub async fn baker_reorder_video_links(
    project_path: String,
    from_index: usize,
    to_index: usize,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |
| `from_index`   | `usize`  | Source position        |
| `to_index`     | `usize`  | Target position        |

**Returns:** `Result<BreadcrumbsFile, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const updated = await invoke<BreadcrumbsFile>('baker_reorder_video_links', {
  projectPath,
  fromIndex,
  toIndex
})
```

---

## Baker: Trello Cards

### `baker_get_trello_cards`

**Purpose:** Get all Trello cards associated with a project. Handles legacy migration from single `trelloCardUrl` to `trelloCards` array.

**Rust signature:**

```rust
pub async fn baker_get_trello_cards(project_path: String) -> Result<Vec<TrelloCard>, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<Vec<TrelloCard>, String>`

**Frontend usage** (`Trello/api.ts`):

```typescript
const cards = await invoke('baker_get_trello_cards', { projectPath })
```

### `baker_associate_trello_card`

**Purpose:** Associate a Trello card with a project. Maximum 10 cards per project. Prevents duplicate card IDs.

**Rust signature:**

```rust
pub async fn baker_associate_trello_card(
    project_path: String,
    trello_card: TrelloCard,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type         | Description           |
| -------------- | ------------ | --------------------- |
| `project_path` | `String`     | Project directory path |
| `trello_card`  | `TrelloCard` | Card to associate     |

**Returns:** `Result<BreadcrumbsFile, String>`

**Frontend usage** (`Trello/api.ts`):

```typescript
const updated = await invoke('baker_associate_trello_card', { projectPath, trelloCard })
```

### `baker_remove_trello_card`

**Purpose:** Remove a Trello card association by index.

**Rust signature:**

```rust
pub async fn baker_remove_trello_card(
    project_path: String,
    card_index: usize,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |
| `card_index`   | `usize`  | Zero-based index      |

**Returns:** `Result<BreadcrumbsFile, String>`

**Frontend usage** (`Trello/api.ts`):

```typescript
const updated = await invoke('baker_remove_trello_card', { projectPath, cardIndex })
```

### `baker_fetch_trello_card_details`

**Purpose:** Fetch card details (title, board name) from the Trello REST API given a card URL. Also resolves the board name via a second API call.

**Rust signature:**

```rust
pub async fn baker_fetch_trello_card_details(
    card_url: String,
    api_key: String,
    api_token: String,
) -> Result<TrelloCard, String>
```

**Parameters:**

| Parameter   | Type     | Description          |
| ----------- | -------- | -------------------- |
| `card_url`  | `String` | Full Trello card URL |
| `api_key`   | `String` | Trello API key       |
| `api_token` | `String` | Trello API token     |

**Returns:** `Result<TrelloCard, String>`

**TrelloCard structure:**

```typescript
interface TrelloCard {
  url: string
  cardId: string
  title: string
  boardName: string | null
  lastFetched: string | null
}
```

**Frontend usage** (`Trello/api.ts`):

```typescript
const card = await invoke('baker_fetch_trello_card_details', {
  cardUrl,
  apiKey,
  apiToken
})
```

---

## Trello Boards

### `fetch_trello_boards`

**Purpose:** Fetch all Trello boards the authenticated user is a member of.

**Rust signature:**

```rust
pub async fn fetch_trello_boards(
    api_key: String,
    api_token: String,
) -> Result<Vec<TrelloBoard>, String>
```

**Parameters:**

| Parameter   | Type     | Description      |
| ----------- | -------- | ---------------- |
| `api_key`   | `String` | Trello API key   |
| `api_token` | `String` | Trello API token |

**Returns:** `Result<Vec<TrelloBoard>, String>`

**Frontend usage** (`Trello/api.ts`):

```typescript
const boards = await invoke<TrelloBoard[]>('fetch_trello_boards', { apiKey, apiToken })
```

---

## Sprout Video

### `get_folders`

**Purpose:** List folders from the Sprout Video API.

**Rust signature:**

```rust
pub async fn get_folders(
    api_key: String,
    folder_id: Option<String>,
) -> Result<serde_json::Value, String>
```

**Parameters:**

| Parameter   | Type             | Description                          |
| ----------- | ---------------- | ------------------------------------ |
| `api_key`   | `String`         | Sprout Video API key                 |
| `folder_id` | `Option<String>` | Optional parent folder ID to filter  |

**Returns:** `Result<Value, String>` -- Raw JSON response from Sprout Video API

**Frontend usage** (`Upload/api.ts`):

```typescript
const folders = await invoke<GetFoldersResponse>('get_folders', {
  apiKey,
  parent_id: parentId
})
```

### `upload_video`

**Purpose:** Upload a video file to Sprout Video with progress tracking. Runs asynchronously in the background; emits progress events.

**Rust signature:**

```rust
pub fn upload_video(
    app_handle: AppHandle,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
)
```

**Parameters:**

| Parameter   | Type             | Description                        |
| ----------- | ---------------- | ---------------------------------- |
| `file_path` | `String`         | Full path to video file            |
| `api_key`   | `String`         | Sprout Video API key               |
| `folder_id` | `Option<String>` | Optional destination folder ID     |

**Returns:** `void` (returns immediately; upload runs in background)

**Events emitted:**

- `upload_progress` -- Percentage complete (0-100)
- `upload_complete` -- JSON response from Sprout Video API
- `upload_error` -- Error message string

**Frontend usage** (`Upload/api.ts`):

```typescript
await invoke('upload_video', { filePath, apiKey, folderId })
```

### `fetch_sprout_video_details`

**Purpose:** Fetch video metadata from the Sprout Video API given a video ID.

**Rust signature:**

```rust
pub async fn fetch_sprout_video_details(
    video_id: String,
    api_key: String,
) -> Result<SproutVideoDetails, String>
```

**Parameters:**

| Parameter  | Type     | Description            |
| ---------- | -------- | ---------------------- |
| `video_id` | `String` | Sprout Video video ID  |
| `api_key`  | `String` | Sprout Video API key   |

**Returns:** `Result<SproutVideoDetails, String>`

**Frontend usage** (`Upload/api.ts`):

```typescript
const details = await invoke<SproutVideoDetails>('fetch_sprout_video_details', {
  videoId,
  apiKey
})
```

---

## DOCX Processing

### `parse_docx_file`

**Purpose:** Validate a .docx file (existence, extension, size limit of 1GB) and return an empty `ParseResult` shell. Actual parsing is done in the frontend via mammoth.js.

**Rust signature:**

```rust
pub fn parse_docx_file(file_path: String) -> Result<ParseResult, String>
```

**Parameters:**

| Parameter   | Type     | Description           |
| ----------- | -------- | --------------------- |
| `file_path` | `String` | Path to .docx file    |

**Returns:** `Result<ParseResult, String>`

**ParseResult structure:**

```typescript
interface ParseResult {
  text_content: string
  html_content: string
  formatting_metadata: {
    bold_ranges: Array<{ start: number; end: number; text: string }>
    italic_ranges: Array<{ start: number; end: number; text: string }>
    underline_ranges: Array<{ start: number; end: number; text: string }>
    headings: Array<{ level: number; text: string; position: number }>
    lists: Array<{ item_type: string; text: string; level: number; position: number }>
    paragraphs: Array<{ text: string; start: number; end: number }>
  }
}
```

**Note:** Not currently invoked from any frontend api.ts file. Validation-only backend command.

### `generate_docx_file`

**Purpose:** Placeholder for future backend .docx generation. Currently returns the suggested download path. Actual generation is done in the frontend via the `docx` npm package.

**Rust signature:**

```rust
pub fn generate_docx_file(
    _content: String,
    default_filename: String,
) -> Result<DownloadPath, String>
```

**Parameters:**

| Parameter          | Type     | Description                  |
| ------------------ | -------- | ---------------------------- |
| `content`          | `String` | Content (currently unused)   |
| `default_filename` | `String` | Suggested output filename    |

**Returns:** `Result<DownloadPath, String>` where `DownloadPath = { path: String }`

**Note:** Not currently invoked from any frontend api.ts file.

### `validate_docx_file`

**Purpose:** Validate a .docx file's existence, extension, readability, and size (1GB limit).

**Rust signature:**

```rust
pub fn validate_docx_file(file_path: String) -> Result<bool, String>
```

**Parameters:**

| Parameter   | Type     | Description        |
| ----------- | -------- | ------------------ |
| `file_path` | `String` | Path to .docx file |

**Returns:** `Result<bool, String>` -- `true` if valid

**Note:** Not currently invoked from any frontend api.ts file.

---

## AI Provider Validation

### `validate_provider_connection`

**Purpose:** Generic HTTP health check for AI provider endpoints. Tests connectivity and measures latency.

**Rust signature:**

```rust
pub async fn validate_provider_connection(
    provider_url: String,
    timeout_ms: Option<u64>,
) -> Result<ConnectionStatus, String>
```

**Parameters:**

| Parameter      | Type             | Description                                |
| -------------- | ---------------- | ------------------------------------------ |
| `provider_url` | `String`         | Provider health endpoint URL               |
| `timeout_ms`   | `Option<u64>`    | Connection timeout in ms (default: 5000)   |

**Returns:** `Result<ConnectionStatus, String>`

**ConnectionStatus structure:**

```typescript
interface ConnectionStatus {
  connected: boolean
  message: string | null
  latency_ms: number | null
}
```

**Note:** Not currently invoked from frontend api.ts files. The frontend uses the `providerRegistry` adapter pattern in `Settings/api.ts` instead.

### `validate_provider_with_auth`

**Purpose:** Test AI provider availability with a custom Authorization header.

**Rust signature:**

```rust
pub async fn validate_provider_with_auth(
    provider_url: String,
    auth_header: String,
    timeout_ms: Option<u64>,
) -> Result<ConnectionStatus, String>
```

**Parameters:**

| Parameter      | Type             | Description                                |
| -------------- | ---------------- | ------------------------------------------ |
| `provider_url` | `String`         | Provider endpoint URL                      |
| `auth_header`  | `String`         | Value for Authorization header             |
| `timeout_ms`   | `Option<u64>`    | Connection timeout in ms (default: 5000)   |

**Returns:** `Result<ConnectionStatus, String>`

**Note:** Not currently invoked from frontend api.ts files.

---

## RAG: Script Similarity Search

Commands for vector similarity search over script formatting examples.

### `search_similar_scripts`

**Purpose:** Find script examples most similar to a given embedding vector using cosine similarity. Filters by minimum quality score (>= 4).

**Rust signature:**

```rust
pub async fn search_similar_scripts(
    app: tauri::AppHandle,
    query_embedding: Vec<f32>,
    top_k: usize,
    min_similarity: Option<f32>,
) -> Result<Vec<SimilarExample>, String>
```

**Parameters:**

| Parameter         | Type            | Description                                      |
| ----------------- | --------------- | ------------------------------------------------ |
| `query_embedding` | `Vec<f32>`      | Vector embedding (384 or 768 dimensions)         |
| `top_k`           | `usize`         | Maximum results to return                        |
| `min_similarity`  | `Option<f32>`   | Minimum cosine similarity threshold (0.0-1.0)    |

**Returns:** `Result<Vec<SimilarExample>, String>`

**SimilarExample structure:**

```typescript
interface SimilarExample {
  id: string
  title: string
  category: string
  before_text: string  // Raw script text (snake_case from Rust)
  after_text: string   // Formatted script text
  similarity: number   // Cosine similarity score (0-1)
}
```

**Frontend usage** (`AITools/api.ts`):

```typescript
const examples = await invoke<SimilarExample[]>('search_similar_scripts', {
  queryEmbedding: embedding,
  topK: 3,
  minSimilarity: 0.5
})
```

### `get_example_by_id`

**Purpose:** Retrieve a single RAG example by its ID.

**Rust signature:**

```rust
pub async fn get_example_by_id(app: tauri::AppHandle, id: String) -> Result<SimilarExample, String>
```

**Parameters:**

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `id`      | `String` | Example UUID  |

**Returns:** `Result<SimilarExample, String>` -- similarity is always 1.0

**Note:** Not currently invoked from frontend api.ts files.

### `get_all_examples`

**Purpose:** Retrieve all RAG examples without full metadata. Ordered by quality score descending, then title ascending.

**Rust signature:**

```rust
pub async fn get_all_examples(app: tauri::AppHandle) -> Result<Vec<SimilarExample>, String>
```

**Parameters:** None

**Returns:** `Result<Vec<SimilarExample>, String>` -- similarity is always 1.0

**Note:** Not currently invoked from frontend api.ts files. Use `get_all_examples_with_metadata` instead.

---

## RAG: Example Management

### `get_all_examples_with_metadata`

**Purpose:** Retrieve all examples with full metadata for the management UI.

**Rust signature:**

```rust
pub async fn get_all_examples_with_metadata(
    app: tauri::AppHandle,
) -> Result<Vec<ExampleWithMetadata>, String>
```

**Parameters:** None

**Returns:** `Result<Vec<ExampleWithMetadata>, String>`

**ExampleWithMetadata structure:**

```typescript
interface ExampleWithMetadata {
  id: string
  title: string
  category: string
  beforeText: string       // camelCase (serde rename_all)
  afterText: string
  tags: string[]
  wordCount: number | null
  qualityScore: number | null
  source: string           // "bundled" or "user-uploaded"
  createdAt: string
}
```

**Frontend usage** (`AITools/api.ts`):

```typescript
const examples = await invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')
```

### `upload_example`

**Purpose:** Upload a new user script example to the RAG database.

**Rust signature:**

```rust
pub async fn upload_example(
    app: tauri::AppHandle,
    request: UploadExampleRequest,
) -> Result<String, String>
```

**Parameters:**

| Parameter | Type                   | Description                              |
| --------- | ---------------------- | ---------------------------------------- |
| `request` | `UploadExampleRequest` | Upload payload with content and metadata |

**UploadExampleRequest structure:**

```typescript
interface UploadExampleRequest {
  beforeContent: string  // Raw script (min 50, max 100,000 chars)
  afterContent: string   // Formatted script (min 50, max 100,000 chars)
  metadata: {
    title: string              // 1-200 chars, no newlines
    category: string           // educational | business | narrative | interview | documentary | user-custom
    tags?: string[]
    qualityScore?: number
  }
  embedding: number[]    // 384 or 768 dimensions
}
```

**Returns:** `Result<String, String>` -- New example ID (UUID)

**Frontend usage** (`AITools/api.ts`):

```typescript
const exampleId = await invoke<string>('upload_example', { request })
```

### `replace_example`

**Purpose:** Replace the content and embedding of an existing user-uploaded example. Cannot replace bundled examples.

**Rust signature:**

```rust
pub async fn replace_example(
    app: tauri::AppHandle,
    id: String,
    request: ReplaceExampleRequest,
) -> Result<(), String>
```

**Parameters:**

| Parameter | Type                    | Description               |
| --------- | ----------------------- | ------------------------- |
| `id`      | `String`                | Example ID to replace     |
| `request` | `ReplaceExampleRequest` | New content and embedding |

**ReplaceExampleRequest structure:**

```typescript
interface ReplaceExampleRequest {
  beforeContent: string
  afterContent: string
  embedding: number[]
}
```

**Returns:** `Result<(), String>`

**Frontend usage** (`AITools/api.ts`):

```typescript
await invoke('replace_example', { id, request })
```

### `delete_example`

**Purpose:** Delete a user-uploaded example. Cannot delete bundled examples.

**Rust signature:**

```rust
pub async fn delete_example(app: tauri::AppHandle, id: String) -> Result<(), String>
```

**Parameters:**

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `id`      | `String` | Example ID to delete |

**Returns:** `Result<(), String>`

**Frontend usage** (`AITools/api.ts`):

```typescript
await invoke('delete_example', { id })
```

---

## Adobe Premiere Integration

### `copy_premiere_project`

**Purpose:** Copy the bundled Premiere Pro 4K template to a project's destination folder with a custom filename. Includes sync-all with filesystem tolerance for network shares (ENOTSUP is non-fatal).

**Rust signature:**

```rust
pub fn copy_premiere_project(
    handle: AppHandle,
    destination_folder: String,
    new_title: String,
) -> Result<(), String>
```

**Parameters:**

| Parameter            | Type     | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| `destination_folder` | `String` | Destination folder path                       |
| `new_title`          | `String` | Project name (without .prproj extension)      |

**Returns:** `Result<(), String>`

**Frontend usage** (`BuildProject/api.ts`, `Premiere/api.ts`):

```typescript
await invoke('copy_premiere_project', { destinationFolder, newTitle })
```

**Implementation details:**

- Reads template via `open_resource_file` from `resources/Premiere 4K Template 2025.prproj`
- Creates destination folder if it doesn't exist
- Returns error if file with the same name already exists
- Uses `file.sync_all()` to flush OS buffers, with ENOTSUP tolerance for network shares

---

## Premiere Pro Plugin Management

Commands for installing and managing CEP (Common Extensibility Platform) extensions.

### `get_available_plugins`

**Purpose:** Return the hardcoded list of bundled CEP plugins with install status.

**Rust signature:**

```rust
pub async fn get_available_plugins() -> Result<Vec<PluginInfo>, String>
```

**Parameters:** None

**Returns:** `Result<Vec<PluginInfo>, String>`

**PluginInfo structure:**

```typescript
interface PluginInfo {
  name: string
  displayName: string
  version: string
  filename: string
  size: number
  installed: boolean
  description: string
  features: string[]
  icon: string
}
```

**Frontend usage** (`Premiere/api.ts`):

```typescript
const plugins = await invoke<PluginInfo[]>('get_available_plugins')
```

### `install_plugin`

**Purpose:** Install a CEP plugin by extracting its bundled ZXP file to the user-level CEP extensions directory. Backs up existing installations and removes macOS quarantine attributes.

**Rust signature:**

```rust
pub async fn install_plugin(
    app_handle: AppHandle,
    plugin_filename: String,
    plugin_name: String,
) -> Result<InstallResult, String>
```

**Parameters:**

| Parameter         | Type     | Description                                    |
| ----------------- | -------- | ---------------------------------------------- |
| `plugin_filename` | `String` | ZXP filename in assets/plugins/ directory      |
| `plugin_name`     | `String` | Plugin directory name (e.g., "BreadcrumbsPremiere") |

**Returns:** `Result<InstallResult, String>`

**InstallResult structure:**

```typescript
interface InstallResult {
  success: boolean
  message: string
  pluginName: string
  installedPath: string
}
```

**Frontend usage** (`Premiere/api.ts`):

```typescript
const result = await invoke<InstallResult>('install_plugin', {
  pluginFilename,
  pluginName
})
```

### `check_plugin_installed`

**Purpose:** Check if a specific CEP plugin is installed by verifying its directory and CSXS/manifest.xml exist.

**Rust signature:**

```rust
pub async fn check_plugin_installed(plugin_name: String) -> Result<bool, String>
```

**Parameters:**

| Parameter     | Type     | Description        |
| ------------- | -------- | ------------------ |
| `plugin_name` | `String` | Plugin folder name |

**Returns:** `Result<bool, String>`

**Note:** Not currently invoked from frontend api.ts files; used internally by `get_available_plugins`.

### `get_cep_directory`

**Purpose:** Get the CEP extensions directory path for the current platform.

**Rust signature:**

```rust
pub async fn get_cep_directory() -> Result<String, String>
```

**Parameters:** None

**Returns:** `Result<String, String>` -- Directory path

**Note:** Not currently invoked from frontend api.ts files.

### `enable_cep_debug_mode`

**Purpose:** Enable CEP debug mode on macOS (sets `PlayerDebugMode` to `1` for CSXS.11). Allows self-signed extensions to load without certificate warnings. No-op on non-macOS platforms.

**Rust signature:**

```rust
pub async fn enable_cep_debug_mode() -> Result<(), String>
```

**Parameters:** None

**Returns:** `Result<(), String>`

**Note:** Not currently invoked from frontend api.ts files.

### `open_cep_folder`

**Purpose:** Open the CEP extensions directory in the system file manager. Creates the directory if it doesn't exist.

**Rust signature:**

```rust
pub async fn open_cep_folder() -> Result<(), String>
```

**Parameters:** None

**Returns:** `Result<(), String>`

**Frontend usage** (`Premiere/api.ts`):

```typescript
await invoke('open_cep_folder')
```

---

## Error Handling

All Tauri commands return `Result<T, String>` (or `Result<T, FileTransferError>` for transfer commands) where the error variant is a string message. Commands that return `void` (no Result) do not propagate errors to the frontend.

**Frontend error handling pattern:**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

try {
  const result = await invoke<ResultType>('command_name', { args })
  // Handle success
} catch (error) {
  // Error is the Rust error string
  console.error('Command failed:', error)
  toast.error(`Operation failed: ${error}`)
}
```

---

**Document Version:** 2.0.0
**Last Updated:** July 2026
**Applies to:** Bucket v0.16.0
