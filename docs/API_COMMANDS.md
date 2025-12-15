# Bucket Tauri Commands API Reference

## Overview

This document provides complete reference documentation for all Tauri commands exposed by the Bucket Rust backend. These commands are called from the React frontend using Tauri's `invoke()` function.

**Target audience:** Frontend developers building features that interact with the Rust backend.

**Last updated:** January 2025 (v0.9.3)

---

## Table of Contents

1. [File Operations](#file-operations)
2. [Authentication](#authentication)
3. [RAG (Retrieval-Augmented Generation)](#rag-retrieval-augmented-generation)
4. [Adobe Premiere Integration](#adobe-premiere-integration)
5. [DOCX Processing](#docx-processing)
6. [Sprout Video](#sprout-video)
7. [AI Provider Management](#ai-provider-management)
8. [System Utilities](#system-utilities)

---

## File Operations

Commands for file system operations with progress tracking.

### `move_files`

**Purpose:** Copy files to camera-specific folders with real-time progress tracking.

**Signature:**

```rust
pub fn move_files(
    files: Vec<(String, u32)>,  // [(file_path, camera_number), ...]
    base_dest: String,          // Base destination folder
    app_handle: AppHandle,      // For emitting progress events
) -> Result<(), String>
```

**Parameters:**

| Parameter    | Type                 | Description                                   |
| ------------ | -------------------- | --------------------------------------------- |
| `files`      | `Vec<(String, u32)>` | Array of tuples: `(file_path, camera_number)` |
| `base_dest`  | `String`             | Destination project folder path               |
| `app_handle` | `AppHandle`          | Tauri app handle (automatically provided)     |

**Returns:** `Result<(), String>` - Immediate success (runs async in background)

**Events Emitted:**

- `copy_progress` - Emitted during file copy with progress data

  ```typescript
  interface CopyProgressEvent {
    current: number // Current file index
    total: number // Total files
    filename: string // Current file name
    progress: number // 0-100 percentage
  }
  ```

- `copy_complete` - Emitted when all files are copied
  ```typescript
  type CopyCompleteEvent = string[] // Array of destination file paths
  ```

**Example Usage:**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Listen to progress events
const unlisten = await listen('copy_progress', event => {
  const { current, total, filename, progress } = event.payload
  console.log(`Copying ${filename}: ${progress}% (${current}/${total})`)
})

// Start file copy
await invoke('move_files', {
  files: [
    ['/path/to/clip1.mov', 1],
    ['/path/to/clip2.mov', 1],
    ['/path/to/clip3.mov', 2]
  ],
  baseDest: '/path/to/project'
})

// Listen for completion
await listen('copy_complete', event => {
  console.log('All files copied:', event.payload)
  unlisten() // Clean up listener
})
```

**Implementation Details:**

- Runs in a separate thread to avoid blocking the UI
- Creates camera folders if they don't exist (`Footage/Camera 1/`, etc.)
- Uses buffered I/O for performance (~100 MB/s on SSD)
- Emits progress events every 10% of file size
- Continues on error (logs error, skips file)

**Error Handling:**

- Returns immediately with `Ok(())` (errors logged to stderr)
- Failed files are skipped, not included in `copy_complete` event

---

## Authentication

Simple token-based authentication for user sessions.

### `check_auth`

**Purpose:** Verify if a token is valid.

**Signature:**

```rust
pub fn check_auth(
    token: String,
    state: State<AuthState>,
) -> String
```

**Parameters:**

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `token`   | `String` | Authentication token to verify |

**Returns:** `String` - `"authenticated"` or `"unauthorized"`

**Example Usage:**

```typescript
const result = await invoke<string>('check_auth', { token: userToken })

if (result === 'authenticated') {
  // User is logged in
} else {
  // Redirect to login
}
```

### `add_token`

**Purpose:** Add a token to the authenticated tokens list.

**Signature:**

```rust
pub fn add_token(
    token: String,
    state: State<AuthState>,
)
```

**Parameters:**

| Parameter | Type     | Description                       |
| --------- | -------- | --------------------------------- |
| `token`   | `String` | Token to add to valid tokens list |

**Returns:** `void`

**Example Usage:**

```typescript
// After successful login, add token
await invoke('add_token', { token: newToken })
```

**Note:** Current implementation is simplified. Production apps should use JWT verification with expiration.

---

## RAG (Retrieval-Augmented Generation)

Commands for managing script examples and vector similarity search.

### `find_similar_examples`

**Purpose:** Find script examples most similar to a given embedding vector.

**Signature:**

```rust
pub fn find_similar_examples(
    app: tauri::AppHandle,
    query_embedding: Vec<f32>,
    top_k: usize,
) -> Result<Vec<SimilarExample>, String>
```

**Parameters:**

| Parameter         | Type       | Description                                 |
| ----------------- | ---------- | ------------------------------------------- |
| `query_embedding` | `Vec<f32>` | Vector embedding (typically 768 dimensions) |
| `top_k`           | `usize`    | Number of results to return (e.g., 3)       |

**Returns:** `Result<Vec<SimilarExample>, String>`

**SimilarExample Structure:**

```typescript
interface SimilarExample {
  id: string // Unique example ID
  title: string // Example title (e.g., "Educational Lecture")
  category: string // Category (e.g., "educational", "business")
  beforeText: string // Raw script text
  afterText: string // Formatted script text
  similarity: number // Cosine similarity score (0-1)
}
```

**Example Usage:**

```typescript
// 1. First, generate embedding for user's script
const embedding = await invoke<number[]>('embed_text_ollama', {
  text: userScript,
  model: 'nomic-embed-text'
})

// 2. Find similar examples
const examples = await invoke<SimilarExample[]>('find_similar_examples', {
  queryEmbedding: embedding,
  topK: 3
})

// 3. Use examples to construct LLM prompt
const prompt = `
Format this script like these examples:

${examples
  .map(
    ex => `
Example: ${ex.title}
Before: ${ex.beforeText}
After: ${ex.afterText}
`
  )
  .join('\n')}

Now format this script:
${userScript}
`
```

**Implementation Details:**

- Uses cosine similarity for vector comparison
- SQLite performs linear scan (fast for <1000 examples)
- Results sorted by similarity (descending)
- Database located in `app_data_dir()/embeddings/examples.db`

### `get_all_examples_with_metadata`

**Purpose:** Retrieve all examples with full metadata for management UI.

**Signature:**

```rust
pub fn get_all_examples_with_metadata(
    app: tauri::AppHandle,
) -> Result<Vec<ExampleWithMetadata>, String>
```

**Parameters:** None

**Returns:** `Result<Vec<ExampleWithMetadata>, String>`

**ExampleWithMetadata Structure:**

```typescript
interface ExampleWithMetadata {
  id: string
  title: string
  category: string
  beforeText: string
  afterText: string
  tags: string[]
  wordCount: number | null
  qualityScore: number | null
  source: 'bundled' | 'user-uploaded'
  createdAt: string // ISO 8601 timestamp
}
```

**Example Usage:**

```typescript
const examples = await invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')

// Filter by source
const bundled = examples.filter(ex => ex.source === 'bundled')
const userUploaded = examples.filter(ex => ex.source === 'user-uploaded')
```

### `upload_example`

**Purpose:** Upload a new user script example to the database.

**Signature:**

```rust
pub fn upload_example(
    app: tauri::AppHandle,
    request: UploadExampleRequest,
) -> Result<String, String>
```

**Parameters:**

| Parameter | Type                   | Description                              |
| --------- | ---------------------- | ---------------------------------------- |
| `request` | `UploadExampleRequest` | Upload payload with content and metadata |

**UploadExampleRequest Structure:**

```typescript
interface UploadExampleRequest {
  beforeContent: string // Raw script
  afterContent: string // Formatted script
  metadata: {
    title: string
    category: string
    tags?: string[]
    qualityScore?: number // 1-10
  }
  embedding: number[] // 768-dimensional vector
}
```

**Returns:** `Result<String, String>` - New example ID (UUID)

**Example Usage:**

```typescript
// 1. Generate embedding
const embedding = await invoke<number[]>('embed_text_ollama', {
  text: beforeContent,
  model: 'nomic-embed-text'
})

// 2. Upload example
const exampleId = await invoke<string>('upload_example', {
  request: {
    beforeContent: rawScript,
    afterContent: formattedScript,
    metadata: {
      title: 'My Conference Script',
      category: 'business',
      tags: ['conference', 'keynote'],
      qualityScore: 8
    },
    embedding
  }
})

console.log('Uploaded example:', exampleId)
```

**Validation Rules:**

- `beforeContent` and `afterContent`: 10-100,000 characters
- `title`: 1-200 characters
- `category`: Must be valid category (educational, business, narrative, etc.)
- `embedding`: Must be 768 dimensions

**Error Responses:**

- `"Invalid text content length"` - Text too short/long
- `"Invalid category"` - Category not recognized
- `"Invalid embedding dimensions"` - Embedding not 768-dimensional
- `"Database error: ..."` - SQLite error

### `replace_example`

**Purpose:** Replace an existing user-uploaded example.

**Signature:**

```rust
pub fn replace_example(
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

**ReplaceExampleRequest Structure:**

```typescript
interface ReplaceExampleRequest {
  beforeContent: string
  afterContent: string
  embedding: number[]
}
```

**Returns:** `Result<(), String>`

**Example Usage:**

```typescript
await invoke('replace_example', {
  id: exampleId,
  request: {
    beforeContent: updatedRawScript,
    afterContent: updatedFormattedScript,
    embedding: newEmbedding
  }
})
```

**Security:**

- Can only replace user-uploaded examples (not bundled)
- Returns error if trying to replace bundled example

### `delete_example`

**Purpose:** Delete a user-uploaded example.

**Signature:**

```rust
pub fn delete_example(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String>
```

**Parameters:**

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `id`      | `String` | Example ID to delete |

**Returns:** `Result<(), String>`

**Example Usage:**

```typescript
await invoke('delete_example', { id: exampleId })
```

**Security:**

- Can only delete user-uploaded examples (not bundled)
- Returns error if trying to delete bundled example

---

## Adobe Premiere Integration

### `copy_premiere_template`

**Purpose:** Copy Premiere Pro template to project folder with proper file sync.

**Signature:**

```rust
pub fn copy_premiere_template(
    destination_path: String,
) -> Result<(), String>
```

**Parameters:**

| Parameter          | Type     | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| `destination_path` | `String` | Full path including filename (`.prproj`) |

**Returns:** `Result<(), String>`

**Example Usage:**

```typescript
await invoke('copy_premiere_template', {
  destinationPath: '/path/to/project/Projects/My Project.prproj'
})
```

**Implementation Details:**

- Copies `Premiere 4K Template 2025.prproj` from bundled assets
- Uses `file.sync_all()` to flush OS buffers (prevents corruption)
- Template supports multi-camera projects
- Fixed corruption bug in v0.9.1

**Error Handling:**

- Returns error if template file not found in assets
- Returns error if destination folder doesn't exist
- Returns error if file write fails

---

## DOCX Processing

Commands for parsing and generating Word documents.

### `parse_docx`

**Purpose:** Extract plain text from a Word document (.docx).

**Signature:**

```rust
pub fn parse_docx(
    file_data: Vec<u8>,
) -> Result<String, String>
```

**Parameters:**

| Parameter   | Type      | Description             |
| ----------- | --------- | ----------------------- |
| `file_data` | `Vec<u8>` | Raw bytes of .docx file |

**Returns:** `Result<String, String>` - Plain text content

**Example Usage:**

```typescript
// 1. Read file as ArrayBuffer
const file = await open({ accept: ['.docx'] })
const contents = await file.read()

// 2. Convert to array
const fileData = Array.from(new Uint8Array(contents))

// 3. Parse
const text = await invoke<string>('parse_docx', { fileData })
```

**Implementation Details:**

- Uses `mammoth` crate for parsing
- Strips all formatting, images, tables (plain text only)
- Preserves paragraph breaks
- Maximum file size: ~100 MB (practical limit)

**Error Handling:**

- Returns error if file is corrupted
- Returns error if file is not valid .docx format

---

## Sprout Video

Commands for Sprout Video API integration.

### `upload_to_sprout`

**Purpose:** Upload video file to Sprout Video.

**Signature:**

```rust
pub fn upload_to_sprout(
    file_path: String,
    api_key: String,
    title: String,
) -> Result<SproutVideoResponse, String>
```

**Parameters:**

| Parameter   | Type     | Description             |
| ----------- | -------- | ----------------------- |
| `file_path` | `String` | Full path to video file |
| `api_key`   | `String` | Sprout Video API key    |
| `title`     | `String` | Video title             |

**Returns:** `Result<SproutVideoResponse, String>`

**SproutVideoResponse Structure:**

```typescript
interface SproutVideoResponse {
  videoId: string
  embedCode: string
  thumbnailUrl: string
}
```

**Example Usage:**

```typescript
const response = await invoke<SproutVideoResponse>('upload_to_sprout', {
  filePath: '/path/to/video.mp4',
  apiKey: settings.sproutApiKey,
  title: 'My Video'
})

// Save to breadcrumbs
breadcrumbs.videoLinks.push({
  video_id: response.videoId,
  embed_code: response.embedCode,
  thumbnailUrl: response.thumbnailUrl
})
```

**Note:** Command implementation varies - check source code for exact API.

---

## AI Provider Management

### `list_ollama_models`

**Purpose:** List available Ollama models.

**Signature:**

```rust
pub fn list_ollama_models(
    base_url: String,
) -> Result<Vec<OllamaModel>, String>
```

**Parameters:**

| Parameter  | Type     | Description                                        |
| ---------- | -------- | -------------------------------------------------- |
| `base_url` | `String` | Ollama server URL (e.g., `http://localhost:11434`) |

**Returns:** `Result<Vec<OllamaModel>, String>`

**OllamaModel Structure:**

```typescript
interface OllamaModel {
  name: string // e.g., "llama3.1:latest"
  modifiedAt: string // ISO timestamp
  size: number // Bytes
}
```

**Example Usage:**

```typescript
const models = await invoke<OllamaModel[]>('list_ollama_models', {
  baseUrl: 'http://localhost:11434'
})

console.log(
  'Available models:',
  models.map(m => m.name)
)
```

### `embed_text_ollama`

**Purpose:** Generate embedding vector for text using Ollama.

**Signature:**

```rust
pub fn embed_text_ollama(
    text: String,
    model: String,
    base_url: String,
) -> Result<Vec<f32>, String>
```

**Parameters:**

| Parameter  | Type     | Description                                     |
| ---------- | -------- | ----------------------------------------------- |
| `text`     | `String` | Text to embed                                   |
| `model`    | `String` | Embedding model name (e.g., `nomic-embed-text`) |
| `base_url` | `String` | Ollama server URL                               |

**Returns:** `Result<Vec<f32>, String>` - 768-dimensional vector

**Example Usage:**

```typescript
const embedding = await invoke<number[]>('embed_text_ollama', {
  text: 'This is my script to format...',
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434'
})

console.log('Embedding dimensions:', embedding.length) // 768
```

**Recommended Models:**

- `nomic-embed-text` - Fast, good quality (768 dimensions)
- `all-minilm` - Smaller, faster (384 dimensions - requires code changes)

---

## System Utilities

### `get_app_version`

**Purpose:** Get current app version.

**Signature:**

```rust
pub fn get_app_version() -> String
```

**Returns:** `String` - Version from `Cargo.toml` (e.g., `"0.9.3"`)

**Example Usage:**

```typescript
const version = await invoke<string>('get_app_version')
console.log('Bucket version:', version)
```

### `open_folder`

**Purpose:** Open a folder in the system file explorer.

**Signature:**

```rust
pub fn open_folder(path: String) -> Result<(), String>
```

**Parameters:**

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| `path`    | `String` | Folder path to open |

**Returns:** `Result<(), String>`

**Example Usage:**

```typescript
// Open project folder after creation
await invoke('open_folder', {
  path: '/path/to/project'
})
```

**Platform Behavior:**

- **macOS:** Opens in Finder
- **Windows:** Opens in File Explorer
- **Linux:** Opens in default file manager

---

## Error Handling

All Tauri commands return `Result<T, String>` where the error variant is a `String` message.

**Frontend Error Handling Pattern:**

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

**Common Error Messages:**

| Error                            | Cause                                 | Solution                            |
| -------------------------------- | ------------------------------------- | ----------------------------------- |
| `"Failed to get app data dir"`   | Tauri can't access app data directory | Check file permissions              |
| `"Database not found"`           | embeddings database missing           | Run `npm run embed:examples:ollama` |
| `"Invalid embedding dimensions"` | Wrong embedding size                  | Use 768-dimensional embeddings      |
| `"Failed to copy file"`          | I/O error during file copy            | Check disk space, permissions       |
| `"Template not found"`           | Premiere template missing             | Verify `src-tauri/assets/` folder   |
| `"Connection refused"`           | Ollama not running                    | Start Ollama: `ollama serve`        |

---

## TypeScript Type Definitions

For type safety, define interfaces matching Rust structures:

```typescript
// Type-safe invoke wrapper
import { invoke as tauriInvoke } from '@tauri-apps/api/core'

// src/types/tauri-commands.ts

export interface SimilarExample {
  id: string
  title: string
  category: string
  beforeText: string
  afterText: string
  similarity: number
}

export interface ExampleWithMetadata extends SimilarExample {
  tags: string[]
  wordCount: number | null
  qualityScore: number | null
  source: 'bundled' | 'user-uploaded'
  createdAt: string
}

export interface UploadExampleRequest {
  beforeContent: string
  afterContent: string
  metadata: {
    title: string
    category: string
    tags?: string[]
    qualityScore?: number
  }
  embedding: number[]
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return tauriInvoke<T>(command, args)
}
```

---

## Performance Tips

1. **Use React Query for caching:**

   ```typescript
   const { data } = useQuery({
     queryKey: ['examples'],
     queryFn: () => invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata'),
     staleTime: 5 * 60 * 1000 // 5 minutes
   })
   ```

2. **Batch file operations:**
   - Use `move_files` with all files at once (not one-by-one)
   - Backend handles parallelization internally

3. **Debounce search queries:**

   ```typescript
   const debouncedSearch = useDebouncedCallback(
     (query: string) => invoke('search_examples', { query }),
     300
   )
   ```

4. **Stream large results:**
   - For large file operations, use event-based progress tracking
   - Don't await completion, listen to `copy_complete` event instead

---

## Testing Commands

Use Vitest to test Tauri command integration:

```typescript
// tests/tauri-commands.test.ts
import { invoke } from '@tauri-apps/api/core'
import { describe, expect, it } from 'vitest'

describe('RAG Commands', () => {
  it('should fetch all examples', async () => {
    const examples = await invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')

    expect(examples).toBeInstanceOf(Array)
    expect(examples.length).toBeGreaterThan(0)
    expect(examples[0]).toHaveProperty('id')
    expect(examples[0]).toHaveProperty('title')
  })

  it('should find similar examples', async () => {
    // Mock embedding
    const mockEmbedding = new Array(768).fill(0.1)

    const results = await invoke<SimilarExample[]>('find_similar_examples', {
      queryEmbedding: mockEmbedding,
      topK: 3
    })

    expect(results).toHaveLength(3)
    expect(results[0].similarity).toBeGreaterThan(0)
  })
})
```

---

## Additional Resources

- **[Tauri Command Documentation](https://tauri.app/v2/guides/features/commands/)** - Official Tauri guide
- **[Rust Source Code](../src-tauri/src/commands/)** - Command implementations
- **[Frontend Hooks](../src/hooks/)** - React hooks wrapping these commands

---

**Document Version:** 1.0.0
**Last Updated:** January 2025
**Applies to:** Bucket v0.9.3
