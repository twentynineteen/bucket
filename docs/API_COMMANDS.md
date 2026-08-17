# Bucket Tauri Commands API Reference

## Overview

This document provides complete reference documentation for all Tauri commands exposed by the Bucket Rust backend. These commands are called from the React frontend using Tauri's `invoke()` function.

**Target audience:** Frontend developers building features that interact with the Rust backend.

**Last updated:** August 2026 (v0.17.0)

---

## Table of Contents

1. [System Utilities](#system-utilities)
2. [File Operations (BuildProject)](#file-operations-buildproject)
3. [Baker: Scanning](#baker-scanning)
4. [Baker: Breadcrumbs](#baker-breadcrumbs)
5. [Baker: Video Links](#baker-video-links)
6. [Baker: Trello Cards](#baker-trello-cards)
7. [Trello Boards](#trello-boards)
8. [Sprout Video](#sprout-video)
9. [Poster Frames](#poster-frames)
10. [Video Metadata](#video-metadata)
11. [DOCX Processing](#docx-processing)
12. [AI Provider Validation](#ai-provider-validation)
13. [RAG: Script Similarity Search](#rag-script-similarity-search)
14. [RAG: Example Management](#rag-example-management)
15. [Adobe Premiere Integration](#adobe-premiere-integration)
16. [Premiere Pro Plugin Management](#premiere-pro-plugin-management)
17. [Video Quality Control (Kavanagh)](#video-quality-control-kavanagh)

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

### `paths_exist`

**Purpose:** Batch-check whether each of the given filesystem paths exists on this machine. Returns one boolean per path in the order asked. Batched deliberately: the Baker detail panel renders one path per footage file, so probing a path at a time would be one IPC message per row.

**Rust signature:**

```rust
pub fn paths_exist(paths: Vec<String>) -> Vec<bool>
```

**Parameters:**

| Parameter | Type           | Description            |
| --------- | -------------- | ---------------------- |
| `paths`   | `Vec<String>`  | Paths to check         |

**Returns:** `Vec<bool>` -- One answer per path, in the same order

**Note:** `Path::exists()` collapses every IO error to `false`. Callers should phrase the result as "not found on this machine" rather than asserting the path is gone - these paths are routinely authored on another machine.

**Frontend usage** (`Baker/api.ts`, `Trello/api.ts`):

```typescript
const results = await invoke<boolean[]>('paths_exist', { paths })
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

### `baker_update_breadcrumbs_sizes`

**Purpose:** Rewrite only the `folderSizeBytes` and `lastModified` fields of each project's `breadcrumbs.json`, recalculating the folder size live. Narrower than `baker_update_breadcrumbs`: the file is edited as raw JSON so every other field - including unknown or drifted ones - is preserved untouched.

**Rust signature:**

```rust
pub async fn baker_update_breadcrumbs_sizes(
    project_paths: Vec<String>,
) -> Result<BatchUpdateResult, String>
```

**Parameters:**

| Parameter       | Type          | Description                           |
| --------------- | ------------- | ------------------------------------- |
| `project_paths` | `Vec<String>` | List of project directories to update |

**Returns:** `Result<BatchUpdateResult, String>`

**Frontend usage** (`Baker/api.ts`):

```typescript
const result = await invoke<BatchUpdateResult>('baker_update_breadcrumbs_sizes', {
  projectPaths
})
```

### `baker_repair_breadcrumbs`

**Purpose:** Regenerate a single project's `breadcrumbs.json` from the folder contents, salvaging user-managed link fields (`trelloCards`, `videoLinks`) from the old file. Always backs the existing file up to `breadcrumbs.json.bak` first. Allowed for any folder with a `Footage/` directory or an existing breadcrumbs file.

**Rust signature:**

```rust
pub async fn baker_repair_breadcrumbs(
    project_path: String,
) -> Result<BreadcrumbsFile, String>
```

**Parameters:**

| Parameter      | Type     | Description           |
| -------------- | -------- | --------------------- |
| `project_path` | `String` | Project directory path |

**Returns:** `Result<BreadcrumbsFile, String>` -- The regenerated breadcrumbs

**Frontend usage** (`Baker/api.ts`):

```typescript
const repaired = await invoke<BreadcrumbsFile>('baker_repair_breadcrumbs', { projectPath })
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

**Purpose:** List folders from the Sprout Video API. Paginates internally (up to 10 pages of 100) so the frontend never sees pages. Returns rate-limit headers for the frontend's budget guard.

**Rust signature:**

```rust
pub async fn get_folders(
    api_key: String,
    parent_id: Option<String>,
) -> Result<SproutFoldersPage, String>
```

**Parameters:**

| Parameter   | Type             | Description                                    |
| ----------- | ---------------- | ---------------------------------------------- |
| `api_key`   | `String`         | Sprout Video API key                           |
| `parent_id` | `Option<String>` | Parent folder ID, or `None` for root folders   |

**Returns:** `Result<SproutFoldersPage, String>`

**SproutFoldersPage structure:**

```typescript
interface SproutFoldersPage {
  folders: Array<{
    id: string
    name: string
    parent_id: string | null
  }>
  total: number | null          // Sprout's total for this level
  truncated: boolean            // true when the page cap stopped pagination early
  rate_limit_remaining: number | null  // X-RateLimit-Remaining from last page
  rate_limit_reset: number | null      // X-RateLimit-Reset (UTC epoch seconds)
}
```

**Frontend usage** (`Upload/api.ts`):

```typescript
const result = await invoke<SproutFoldersPage>('get_folders', {
  apiKey,
  parentId
})
```

### `upload_video`

**Purpose:** Upload a video file to Sprout Video with progress tracking, cancellation support and stall detection. Returns an operation ID the upload can be addressed by (for cancellation via `cancel_upload`). Files over 5 GiB are rejected before any bytes are streamed.

**Rust signature:**

```rust
pub async fn upload_video(
    app_handle: AppHandle,
    registry: State<'_, OperationRegistry>,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<String, String>
```

**Parameters:**

| Parameter   | Type             | Description                                     |
| ----------- | ---------------- | ----------------------------------------------- |
| `file_path` | `String`         | Full path to video file                         |
| `api_key`   | `String`         | Sprout Video API key                            |
| `folder_id` | `Option<String>` | Optional destination folder ID                  |
| `title`     | `Option<String>` | Optional title (otherwise Sprout derives one from the filename) |

**Returns:** `Result<String, String>` -- Operation ID (upload runs in background)

**Events emitted:**

- `upload_progress` -- Throttled progress updates (every 100ms)

  ```typescript
  interface UploadProgressEvent {
    operationId: string
    bytesSent: number
    totalBytes: number
    percentage: number  // 0-100
  }
  ```

- `upload_complete` -- Upload succeeded

  ```typescript
  interface UploadCompleteEvent {
    operationId: string
    video: object  // Raw Sprout Video API response
  }
  ```

- `upload_error` -- Upload failed (classified error message)

  ```typescript
  interface UploadErrorEvent {
    operationId: string
    message: string
  }
  ```

- `upload_cancelled` -- User cancelled the upload

  ```typescript
  interface UploadCancelledEvent {
    operationId: string
    bytesSent: number
    totalBytes: number
  }
  ```

- `upload_stall_warning` -- Non-terminal warning that no data has reached Sprout for a while (raised at ~35s, terminal stall at ~70s). `message` is `null` when the warning is being withdrawn because progress resumed.

  ```typescript
  interface UploadStallWarningEvent {
    operationId: string
    bytesSent: number
    totalBytes: number
    silentForSeconds: number
    message: string | null
  }
  ```

**Frontend usage** (`Upload/api.ts`):

```typescript
const operationId = await invoke<string>('upload_video', {
  filePath, apiKey, folderId, title
})
```

### `cancel_upload`

**Purpose:** Signal cancellation for a running Sprout upload. Returns `false` when the operation is not found, which is the normal outcome when the upload had already finished.

**Rust signature:**

```rust
pub async fn cancel_upload(
    registry: State<'_, OperationRegistry>,
    operation_id: String,
) -> Result<bool, String>
```

**Parameters:**

| Parameter      | Type     | Description                                |
| -------------- | -------- | ------------------------------------------ |
| `operation_id` | `String` | Operation ID returned by `upload_video`    |

**Returns:** `Result<bool, String>` -- `true` if cancellation was signalled

**Frontend usage** (`Upload/api.ts`):

```typescript
await invoke<boolean>('cancel_upload', { operationId })
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

## Poster Frames

Commands for uploading branded poster frames to Sprout Video and saving local copies.

### `set_sprout_poster_frame`

**Purpose:** Upload a custom poster frame image for an existing Sprout video. The image is generated on the frontend canvas; this command only moves the bytes to Sprout's API.

**Rust signature:**

```rust
pub async fn set_sprout_poster_frame(
    video_id: String,
    api_key: String,
    image_bytes: Vec<u8>,
    file_name: Option<String>,
) -> Result<(), PosterFrameError>
```

**Parameters:**

| Parameter     | Type             | Description                                    |
| ------------- | ---------------- | ---------------------------------------------- |
| `video_id`    | `String`         | Sprout Video video ID                          |
| `api_key`     | `String`         | Sprout Video API key                           |
| `image_bytes` | `Vec<u8>`        | JPEG image bytes                               |
| `file_name`   | `Option<String>` | Filename for the upload (default: `posterframe.jpg`) |

**Returns:** `Result<(), PosterFrameError>`

**PosterFrameError structure:**

```typescript
interface PosterFrameError {
  status: number | null  // HTTP status, or null for transport errors
  message: string
}
```

**Frontend usage** (`Upload/api.ts`):

```typescript
await invoke('set_sprout_poster_frame', {
  videoId, apiKey, imageBytes, fileName
})
```

### `save_poster_frame_copy`

**Purpose:** Write a copy of the poster frame into `<project_path>/Graphics/`, creating the folder if needed. Never overwrites existing files - auto-suffixes with `-2`, `-3`, etc.

**Rust signature:**

```rust
pub fn save_poster_frame_copy(
    project_path: String,
    file_stem: String,
    image_bytes: Vec<u8>,
) -> Result<String, String>
```

**Parameters:**

| Parameter      | Type      | Description                              |
| -------------- | --------- | ---------------------------------------- |
| `project_path` | `String`  | Project directory path                   |
| `file_stem`    | `String`  | Filename stem (e.g. `posterframe-Managing_Change`) |
| `image_bytes`  | `Vec<u8>` | JPEG image bytes                         |

**Returns:** `Result<String, String>` -- The path that was written

**Frontend usage** (`Upload/api.ts`):

```typescript
const writtenPath = await invoke<string>('save_poster_frame_copy', {
  projectPath, fileStem, imageBytes
})
```

---

## Video Metadata

### `get_video_duration`

**Purpose:** Read the duration (in seconds) of a local MP4/MOV file by parsing the `moov/mvhd` box directly, without any external media dependencies. Used as a fallback when Sprout Video has not finished processing an upload and cannot report a duration yet.

**Rust signature:**

```rust
pub fn get_video_duration(file_path: String) -> Result<f64, String>
```

**Parameters:**

| Parameter   | Type     | Description           |
| ----------- | -------- | --------------------- |
| `file_path` | `String` | Path to MP4/MOV file  |

**Returns:** `Result<f64, String>` -- Duration in seconds

**Frontend usage** (`Upload/api.ts`):

```typescript
const seconds = await invoke<number>('get_video_duration', { filePath })
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

## Video Quality Control (Kavanagh)

Commands for automated video quality control: watermark presence, closing transition (tail/sting) analysis. Requires ffmpeg and ffprobe on the system.

### `kavanagh_detect_ffmpeg`

**Purpose:** Check whether ffmpeg and ffprobe are available and runnable. Probes a configured custom directory first, then standard locations (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`). Does not use `which` because a Tauri app launched from Finder does not inherit the shell PATH.

**Rust signature:**

```rust
pub fn kavanagh_detect_ffmpeg(custom_dir: Option<String>) -> FfmpegAvailability
```

**Parameters:**

| Parameter    | Type             | Description                                       |
| ------------ | ---------------- | ------------------------------------------------- |
| `custom_dir` | `Option<String>` | Directory configured in Settings, or `None` for defaults |

**Returns:** `FfmpegAvailability` (tagged union, serialised with `status` discriminator)

**FfmpegAvailability structure:**

```typescript
type FfmpegAvailability =
  | { status: 'ready'; ffmpeg: string; ffprobe: string }
  | { status: 'notFound'; missing: string[]; searched: string[] }
  | { status: 'notExecutable'; path: string }
```

**Frontend usage** (`Kavanagh/api.ts`):

```typescript
const availability = await invoke<FfmpegAvailability>('kavanagh_detect_ffmpeg', {
  customDir
})
```

### `kavanagh_run_check`

**Purpose:** Run the full quality control suite over one video: watermark presence check, closing transition (tail) analysis, and sting verification. Only one run at a time is allowed; a second request is rejected rather than queued.

**Rust signature:**

```rust
pub async fn kavanagh_run_check(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    runs: State<'_, KavanaghRunState>,
    request: WatermarkCheckRequest,
) -> Result<CheckReport, KavanaghError>
```

**Parameters:**

| Parameter | Type                    | Description          |
| --------- | ----------------------- | -------------------- |
| `request` | `WatermarkCheckRequest` | Check configuration  |

**WatermarkCheckRequest structure:**

```typescript
interface WatermarkCheckRequest {
  videoPath: string
  referenceFiles: string[]         // Watermark pool files
  stingReferenceFiles?: string[]   // Sting pool files (defaults to [])
  ffmpegDirectory?: string | null  // Settings ffmpeg directory override
  matchThreshold?: number | null   // Advanced: custom match threshold
}
```

**Returns:** `Result<CheckReport, KavanaghError>`

**Events emitted:**

- `kavanagh-progress` -- Progress updates throughout the run

  ```typescript
  interface KavanaghProgressEvent {
    operationId: string
    phase: string       // "probe" | "tail" | "watermark"
    percentage: number  // 0-100, never decreases
    detail: string
  }
  ```

**Frontend usage** (`Kavanagh/api.ts`):

```typescript
const report = await invoke<KavanaghCheckReport>('kavanagh_run_check', { request })
```

### `kavanagh_cancel_run`

**Purpose:** Cancel the quality control run in flight, if there is one. Takes no argument because only one run can exist at a time.

**Rust signature:**

```rust
pub async fn kavanagh_cancel_run(
    registry: State<'_, OperationRegistry>,
    runs: State<'_, KavanaghRunState>,
) -> Result<bool, KavanaghError>
```

**Parameters:** None

**Returns:** `Result<bool, KavanaghError>` -- `true` if a run was cancelled, `false` if nothing was running

**Frontend usage** (`Kavanagh/api.ts`):

```typescript
await invoke<boolean>('kavanagh_cancel_run')
```

### `kavanagh_save_evidence`

**Purpose:** Write a report's failure thumbnails (JPEG) into a folder the operator chose. Never overwrites existing files. Returns the paths that were written.

**Rust signature:**

```rust
pub fn kavanagh_save_evidence(
    folder: String,
    prefix: String,
    items: Vec<EvidenceItem>,
) -> Result<Vec<String>, KavanaghError>
```

**Parameters:**

| Parameter | Type               | Description                              |
| --------- | ------------------ | ---------------------------------------- |
| `folder`  | `String`           | Destination folder path                  |
| `prefix`  | `String`           | Filename prefix (e.g. `kavanagh-render`) |
| `items`   | `Vec<EvidenceItem>` | Thumbnails to save                       |

**EvidenceItem structure:**

```typescript
interface EvidenceItem {
  label: string   // Human-readable label (used in filename)
  jpeg: number[]  // JPEG image bytes
}
```

**Returns:** `Result<Vec<String>, KavanaghError>` -- Paths of the written files

**Frontend usage** (`Kavanagh/api.ts`):

```typescript
const paths = await invoke<string[]>('kavanagh_save_evidence', {
  folder, prefix, items
})
```

---

## Error Handling

All Tauri commands return `Result<T, String>` (or `Result<T, FileTransferError>` for transfer commands, `Result<T, KavanaghError>` for QC commands, `Result<T, PosterFrameError>` for poster frame commands) where the error variant is a string message or a structured error. Commands that return `void` (no Result) do not propagate errors to the frontend.

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

**Document Version:** 3.0.0
**Last Updated:** August 2026
**Applies to:** Bucket v0.17.0
