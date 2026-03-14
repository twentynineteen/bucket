# Phase 4: Upload Module - Research

**Researched:** 2026-03-09
**Domain:** Feature module extraction (Sprout Video upload, Posterframe, Otter) with barrel exports, API layers, contract tests
**Confidence:** HIGH

## Summary

Phase 4 migrates Upload-related functionality (Sprout Video upload, Posterframe generation, Otter transcription) into a unified `src/features/Upload/` deep module following the established pattern from Phase 3 (Auth, Trello, Premiere). The existing code is scattered across `src/pages/` (3 page components) and `src/hooks/` (10 hooks tagged `// Target: @features/Upload`), plus one utility in `src/utils/`.

The primary complexity is the **cross-module dependency**: the Trello module's `useVideoLinksManager` hook currently imports `useFileUpload`, `useUploadEvents`, `useSproutVideoApi`, and `useSproutVideoProcessor` directly from `@hooks/`. After migration, these imports must be updated to come from `@features/Upload` barrel. Additionally, the Posterframe page has two hooks tagged `// Target: @features/BuildProject` (`useBackgroundFolder`, `useAutoFileSelection`) that remain in `@hooks/` for now -- they are NOT part of this module.

The Otter page (`UploadOtter.tsx`) is a stub -- 7 lines, no invoke() calls, no hooks. It needs to move into the module but requires minimal work.

**Primary recommendation:** Create a single api.ts wrapping the 4 invoke() calls (upload_video, get_folders, fetch_sprout_video_details, open_folder) plus the Tauri event listeners (upload_progress, upload_complete, upload_error) and Tauri file plugins (writeFile, readFile, open dialog). Move all 10 hooks, 3 page components, and 1 utility. Update Trello module imports from `@hooks/` to `@features/Upload`. Write contract tests following the Trello pattern.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-01 | Import Upload components, hooks, types from `@features/Upload` barrel only | 10 hooks + 3 page components + 1 utility + types identified; barrel pattern established in Phase 3 |
| UPLD-02 | API layer wrapping Sprout/Posterframe/Otter Tauri commands | 4 invoke() calls + 3 Tauri event listeners + dialog/fs plugins identified across hooks |
| UPLD-03 | Contract tests validating Upload module's public interface | Trello contract test pattern provides exact template; ~15 public exports to validate |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (project standard) | Contract test runner | Used for all Phase 2/3 contract tests |
| @testing-library/react | (project standard) | renderHook for behavioral tests | Established in Phase 3 hooks contract tests |
| eslint-plugin-boundaries | (project standard) | Enforce barrel-only imports | Already configured with `@features/*` zone |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api/core | 2.x | invoke() wrapper target | upload_video, get_folders, fetch_sprout_video_details, open_folder |
| @tauri-apps/api/event | 2.x | listen() wrapper target | upload_progress, upload_complete, upload_error events |
| @tauri-apps/plugin-dialog | 2.x | File/folder dialog wrapper target | open() calls in useFileUpload, Posterframe |
| @tauri-apps/plugin-fs | 2.x | File read/write wrapper target | writeFile in Posterframe, readFile in useFileSelection |
| @tauri-apps/api/path | 2.x | Font directory path | fontDir() in loadFont utility |

No new dependencies needed. All tools are already in the project.

## Architecture Patterns

### Recommended Module Structure

```
src/features/Upload/
  api.ts                           # Single I/O boundary: all invoke(), listen(), dialog, fs calls
  types.ts                         # Module-specific types (re-exports from shared where needed)
  index.ts                         # Barrel exports (public API)
  __contracts__/
    upload.contract.test.ts        # Shape + behavioral contract tests
  hooks/
    useFileUpload.ts               # Sprout video file upload with Tauri events
    useUploadEvents.ts             # Upload progress/status via Tauri events
    useImageRefresh.ts             # Post-upload thumbnail refresh
    useSproutVideoApi.ts           # Fetch video metadata from Sprout API
    useSproutVideoPlayer.ts        # SproutVideo player integration
    useSproutVideoProcessor.ts     # Process upload responses into VideoLink
    usePosterframeCanvas.ts        # Canvas rendering for posterframes
    usePosterframeAutoRedraw.ts    # Auto-redraw on input changes
    useFileSelection.ts            # File selection with blob URL management
    useZoomPan.ts                  # Canvas zoom/pan state management
  components/
    UploadSprout.tsx               # Sprout Video upload page
    Posterframe.tsx                 # Posterframe generation page
    UploadOtter.tsx                # Otter transcription page (stub)
    FolderTreeSprout.tsx           # Sprout folder tree browser
  internal/
    parseSproutVideoUrl.ts         # URL parser utility (not exported from barrel)
    loadFont.ts                    # Font loading utility for posterframe canvas
```

### Pattern: API Layer as Single I/O Boundary

Following the Trello module pattern exactly, `api.ts` wraps ALL external calls:

**Tauri invoke() commands:**
- `upload_video(filePath, apiKey, folderId)` -- starts video upload
- `get_folders(apiKey, parent_id)` -- fetches Sprout folder tree
- `fetch_sprout_video_details(videoId, apiKey)` -- fetches video metadata
- `open_folder(path)` -- opens system folder (shared with Premiere, see pitfalls)

**Tauri event listeners:**
- `listen('upload_progress', callback)` -- progress updates during upload
- `listen('upload_complete', callback)` -- upload success notification
- `listen('upload_error', callback)` -- upload error notification

**Tauri file/dialog plugins:**
- `open({ multiple, filters })` -- file selection dialog
- `open({ directory })` -- folder selection dialog
- `writeFile(path, data)` -- save posterframe image
- `readFile(path)` -- read file for blob generation
- `readDir(folderPath)` -- list background folder files
- `fontDir()` -- get font directory path
- `exists(path)` -- check font file exists

### Pattern: Barrel Export Structure

```typescript
// src/features/Upload/index.ts

// Components
export { default as UploadSprout } from './components/UploadSprout'
export { default as Posterframe } from './components/Posterframe'
export { default as UploadOtter } from './components/UploadOtter'
export { default as FolderTreeSprout } from './components/FolderTreeSprout'

// Hooks
export { useFileUpload } from './hooks/useFileUpload'
export { useUploadEvents } from './hooks/useUploadEvents'
export { useImageRefresh } from './hooks/useImageRefresh'
export { useSproutVideoApi } from './hooks/useSproutVideoApi'
export { useSproutVideoPlayer } from './hooks/useSproutVideoPlayer'
export { useSproutVideoProcessor } from './hooks/useSproutVideoProcessor'
export { usePosterframeCanvas } from './hooks/usePosterframeCanvas'
export { usePosterframeAutoRedraw } from './hooks/usePosterframeAutoRedraw'
export { useFileSelection } from './hooks/useFileSelection'
export { useZoomPan } from './hooks/useZoomPan'

// Types (re-export relevant types for consumers)
export type { ... } from './types'
```

### Anti-Patterns to Avoid

- **DO NOT export `parseSproutVideoUrl` or `loadFont`:** These are internal implementation details. Place in `internal/` directory following Trello module pattern.
- **DO NOT split into sub-modules per sub-feature (Sprout/, Posterframe/, Otter/):** The module is "Upload" -- keep it flat with hooks/ and components/ directories. Sub-feature boundaries are communicated via naming (prefix `useSproutVideo*`, `usePosterframe*`).
- **DO NOT create separate api.ts files per sub-feature:** One api.ts per module is the established pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module boundary enforcement | Custom import checks | eslint-plugin-boundaries (already configured) | Catches violations at lint time |
| Contract test structure | Custom test patterns | Phase 3 Trello contract test template | Proven pattern with shape + behavioral tests |
| Mock strategy for api.ts | Per-file mocks | Single `vi.mock('../api')` | Established pattern -- mock one file to isolate module |
| Import path updates | Manual find-and-replace | IDE refactoring or Python script (Phase 2 pattern) | Bulk updates safer with atomic operations |

## Common Pitfalls

### Pitfall 1: Cross-Module Import Breakage (Trello -> Upload)
**What goes wrong:** The Trello module's `useVideoLinksManager.ts` currently imports 4 hooks from `@hooks/` that are moving to `@features/Upload`. If you move the hooks without updating Trello imports, Trello breaks.
**Why it happens:** Cross-module dependencies created before modules existed.
**How to avoid:** After moving hooks to Upload module, update Trello's `useVideoLinksManager.ts` imports from `@hooks/useFileUpload` to `@features/Upload` barrel. Also update the Trello contract test mocks accordingly.
**Warning signs:** Trello contract tests fail after Upload module migration. `bun run test` catches this immediately.
**Files affected:**
- `src/features/Trello/hooks/useVideoLinksManager.ts` (imports useFileUpload, useUploadEvents, useSproutVideoApi, useSproutVideoProcessor)
- `src/features/Trello/__contracts__/trello.contract.test.ts` (mocks for these hooks)
- `src/components/Baker/VideoLinksManager.test.tsx` (mocks for useFileUpload, useUploadEvents)

### Pitfall 2: `open_folder` Command Shared Between Modules
**What goes wrong:** The `open_folder` Tauri command is used by both Posterframe (in Upload module) and Premiere module. Wrapping it in Upload's api.ts creates a duplication question.
**Why it happens:** Generic system commands don't belong to one feature.
**How to avoid:** Wrap `open_folder` in Upload's api.ts for Posterframe's use. Premiere already has its own api.ts wrapper for the same command (as `showConfirmationDialog`). This duplication is acceptable -- each module wraps its own I/O calls independently. Alternatively, this could live in `@shared/services` if it bothers you, but the module-per-api-file pattern says each module wraps what it needs.

### Pitfall 3: Missing Type Import for SproutVideoPlayer
**What goes wrong:** `useSproutVideoPlayer.ts` imports `SproutVideoPlayer` from `@/types/transcript` which does not exist.
**Why it happens:** The file `src/types/transcript.ts` was deleted or never created. The type is used via `declare global { interface Window { SV: { Player: ... } } }` inline.
**How to avoid:** When moving this hook, either define the `SproutVideoPlayer` interface in Upload's `types.ts` or keep the existing inline `declare global`. Check if the hook is actually used anywhere first -- it may be orphan code from Phase 007 (AI Script Example Embedding). If unused, consider not exporting it.

### Pitfall 4: Posterframe Uses BuildProject-Targeted Hooks
**What goes wrong:** `Posterframe.tsx` imports `useBackgroundFolder` and `useAutoFileSelection` which are tagged `// Target: @features/BuildProject`, not Upload.
**Why it happens:** These hooks are generic file utilities used by both Posterframe and BuildProject.
**How to avoid:** Leave these hooks in `@hooks/` for now. They will move to `@features/BuildProject` in Phase 8. Posterframe.tsx will import them from `@hooks/` until then. This is the same deferred-import pattern used during Phase 3.

### Pitfall 5: `useFileUpload` Uses `alert()` Instead of Sonner Toast
**What goes wrong:** The `useFileUpload` hook uses `alert()` calls for error messages (line 44, 48, 142). This is flagged by DOCS-04 requirement.
**Why it happens:** Legacy code predating toast adoption.
**How to avoid:** This is Phase 9 cleanup (DOCS-04). Do NOT fix during this structural refactor -- move the code as-is. Changing behavior is out of scope.

### Pitfall 6: `appStore` Direct Access in useFileUpload
**What goes wrong:** `useFileUpload.ts` calls `appStore.getState().setLatestSproutUpload(finalResponse)` -- direct store mutation outside React lifecycle.
**Why it happens:** Legacy pattern for sharing upload state between pages.
**How to avoid:** Move as-is. The store import comes from `@shared/store` which is already properly exported. This is a Phase 9 / v2 concern (store decomposition).

## Code Examples

### api.ts Pattern (Following Trello Module)

```typescript
// src/features/Upload/api.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { readDir, readFile, writeFile, exists } from '@tauri-apps/plugin-fs'
import { fontDir } from '@tauri-apps/api/path'

import type { SproutUploadResponse, GetFoldersResponse } from '@shared/types/types'
import type { SproutVideoDetails } from '@shared/types/media'

// --- Tauri Commands ---

export async function uploadVideo(
  filePath: string,
  apiKey: string,
  folderId: string | null
): Promise<void> {
  return invoke('upload_video', { filePath, apiKey, folderId })
}

export async function getFolders(
  apiKey: string,
  parentId: string
): Promise<GetFoldersResponse> {
  return invoke<GetFoldersResponse>('get_folders', { apiKey, parent_id: parentId })
}

export async function fetchSproutVideoDetails(
  videoId: string,
  apiKey: string
): Promise<SproutVideoDetails> {
  return invoke<SproutVideoDetails>('fetch_sprout_video_details', { videoId, apiKey })
}

export async function openFolder(path: string): Promise<void> {
  return invoke('open_folder', { path })
}

// --- Tauri Events ---

export async function listenUploadProgress(
  callback: (progress: number) => void
): Promise<() => void> {
  return listen('upload_progress', (event) => callback(event.payload as number))
}

export async function listenUploadComplete(
  callback: (response: SproutUploadResponse) => void
): Promise<() => void> {
  return listen('upload_complete', (event) => callback(event.payload as SproutUploadResponse))
}

export async function listenUploadError(
  callback: (error: string) => void
): Promise<() => void> {
  return listen('upload_error', (event) => callback(event.payload as string))
}

// --- Dialog Wrappers ---

export async function openFileDialog(options: {
  multiple: boolean
  filters: Array<{ name: string; extensions: string[] }>
}): Promise<string | null> {
  const result = await openDialog(options)
  return typeof result === 'string' ? result : null
}

export async function openFolderDialog(): Promise<string | null> {
  const result = await openDialog({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
}

// --- File System ---

export async function saveFile(path: string, data: Uint8Array): Promise<void> {
  return writeFile(path, data)
}

export async function readFileAsBytes(path: string): Promise<Uint8Array> {
  return readFile(path)
}

export async function listDirectory(folderPath: string): Promise<string[]> {
  const entries = await readDir(folderPath)
  return entries
    .filter((f) => f.name?.endsWith('.jpg'))
    .map((f) => `${folderPath}/${f.name}`)
    .sort((a, b) => a.localeCompare(b))
}

export async function getFontDir(): Promise<string> {
  return fontDir()
}

export async function fileExists(path: string): Promise<boolean> {
  return exists(path)
}
```

### Contract Test Pattern (Following Trello Module)

```typescript
// src/features/Upload/__contracts__/upload.contract.test.ts
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Upload I/O)
vi.mock('../api', () => ({
  uploadVideo: vi.fn().mockResolvedValue(undefined),
  getFolders: vi.fn().mockResolvedValue({ folders: [] }),
  fetchSproutVideoDetails: vi.fn().mockResolvedValue({}),
  openFolder: vi.fn().mockResolvedValue(undefined),
  listenUploadProgress: vi.fn().mockResolvedValue(() => {}),
  listenUploadComplete: vi.fn().mockResolvedValue(() => {}),
  listenUploadError: vi.fn().mockResolvedValue(() => {}),
  openFileDialog: vi.fn().mockResolvedValue(null),
  openFolderDialog: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(undefined),
  readFileAsBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  listDirectory: vi.fn().mockResolvedValue([]),
  getFontDir: vi.fn().mockResolvedValue('/fonts'),
  fileExists: vi.fn().mockResolvedValue(false),
}))

// ... shared dependency mocks (same pattern as Trello)

import * as uploadBarrel from '../index'

describe('Upload Barrel Exports - Shape', () => {
  const expectedExports = [
    // Components
    'UploadSprout', 'Posterframe', 'UploadOtter', 'FolderTreeSprout',
    // Hooks
    'useFileUpload', 'useUploadEvents', 'useImageRefresh',
    'useSproutVideoApi', 'useSproutVideoPlayer', 'useSproutVideoProcessor',
    'usePosterframeCanvas', 'usePosterframeAutoRedraw',
    'useFileSelection', 'useZoomPan',
  ].sort()

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(uploadBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })
})
```

### Updating Trello Cross-Module Imports

```typescript
// BEFORE (src/features/Trello/hooks/useVideoLinksManager.ts)
import { useFileUpload } from '@hooks/useFileUpload'
import { useSproutVideoApi } from '@hooks/useSproutVideoApi'
import { useSproutVideoProcessor } from '@hooks/useSproutVideoProcessor'
import { useUploadEvents } from '@hooks/useUploadEvents'

// AFTER
import {
  useFileUpload,
  useSproutVideoApi,
  useSproutVideoProcessor,
  useUploadEvents
} from '@features/Upload'
```

## Inventory of Files to Move

### Hooks (10 files) -- all tagged `// Target: @features/Upload`

| Current Path | Target Path | invoke() Calls | Notes |
|---|---|---|---|
| `src/hooks/useFileUpload.ts` | `hooks/useFileUpload.ts` | `invoke('upload_video')`, `listen('upload_complete')`, `listen('upload_error')`, `open()` | Also uses `appStore` from shared |
| `src/hooks/useUploadEvents.ts` | `hooks/useUploadEvents.ts` | `listen('upload_progress')`, `listen('upload_complete')`, `listen('upload_error')` | React Query based state |
| `src/hooks/useImageRefresh.ts` | `hooks/useImageRefresh.ts` | None | Pure React Query hook |
| `src/hooks/useSproutVideoApi.ts` | `hooks/useSproutVideoApi.ts` | `invoke('fetch_sprout_video_details')` (via parseSproutVideoUrl) | React Query mutation |
| `src/hooks/useSproutVideoPlayer.ts` | `hooks/useSproutVideoPlayer.ts` | None | Browser SV Player API; imports missing `@/types/transcript` |
| `src/hooks/useSproutVideoProcessor.ts` | `hooks/useSproutVideoProcessor.ts` | None | Pure processing logic |
| `src/hooks/usePosterframeCanvas.ts` | `hooks/usePosterframeCanvas.ts` | None (but calls `loadFont` which uses Tauri fs) | Canvas rendering |
| `src/hooks/usePosterframeAutoRedraw.ts` | `hooks/usePosterframeAutoRedraw.ts` | None | React Query debounced redraw |
| `src/hooks/useFileSelection.ts` | `hooks/useFileSelection.ts` | `readFile()` from Tauri plugin-fs | Blob URL management |
| `src/hooks/useZoomPan.ts` | `hooks/useZoomPan.ts` | None | Pure React Query state |

### Page Components (3 files)

| Current Path | Target Path | invoke() Calls | Notes |
|---|---|---|---|
| `src/pages/UploadSprout.tsx` | `components/UploadSprout.tsx` | None (hooks handle I/O) | Has existing test file |
| `src/pages/Posterframe.tsx` | `components/Posterframe.tsx` | `invoke('open_folder')`, `writeFile()`, `open()` | Direct invoke in component -- wrap via api.ts |
| `src/pages/UploadOtter.tsx` | `components/UploadOtter.tsx` | None | 7-line stub |
| `src/pages/FolderTreeSprout.tsx` | `components/FolderTreeSprout.tsx` | `invoke('get_folders')` | Direct invoke in component -- wrap via api.ts |

### Utilities (2 files) -> `internal/`

| Current Path | Target Path | Notes |
|---|---|---|
| `src/utils/parseSproutVideoUrl.ts` | `internal/parseSproutVideoUrl.ts` | Used only by useSproutVideoApi |
| `src/utils/loadFont.ts` | `internal/loadFont.ts` | Used only by usePosterframeCanvas; uses Tauri fs plugins |

### Test Files (1 file)

| Current Path | Target Path | Notes |
|---|---|---|
| `src/pages/UploadSprout.test.tsx` | `components/UploadSprout.test.tsx` or keep co-located | Mock paths need updating |

### External Consumers to Update

| File | Current Import | New Import |
|---|---|---|
| `src/features/Trello/hooks/useVideoLinksManager.ts` | `@hooks/useFileUpload`, `@hooks/useSproutVideoApi`, `@hooks/useSproutVideoProcessor`, `@hooks/useUploadEvents` | `@features/Upload` barrel |
| `src/features/Trello/__contracts__/trello.contract.test.ts` | `vi.mock('@hooks/useFileUpload')` etc. | `vi.mock('@features/Upload')` |
| `src/components/Baker/VideoLinksManager.test.tsx` | `vi.mock('@hooks/useFileUpload')`, `vi.mock('@hooks/useUploadEvents')` | `vi.mock('@features/Upload')` |
| App router / sidebar | `@pages/UploadSprout`, `@pages/Posterframe`, `@pages/UploadOtter` | `@features/Upload` barrel |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| invoke() in components | api.ts wraps all invoke() | Phase 3 (2026-03-09) | Single mock point per module |
| Scattered hooks in src/hooks/ | Colocated in feature module | Phase 3 (2026-03-09) | Clear ownership boundaries |
| No public API contracts | Contract tests in __contracts__/ | Phase 2 (2026-03-08) | Stable exports for consumers |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `bun run test -- --run src/features/Upload` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLD-01 | Barrel exports exactly the expected members | unit | `bun run test -- --run src/features/Upload/__contracts__/upload.contract.test.ts` | Wave 0 |
| UPLD-02 | api.ts wraps all Sprout/Posterframe/Otter Tauri commands | unit | Same contract test (api mock validates boundary) | Wave 0 |
| UPLD-03 | Contract tests validate public interface | unit | Same contract test | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run src/features/Upload`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/Upload/__contracts__/upload.contract.test.ts` -- covers UPLD-01, UPLD-02, UPLD-03
- [ ] `src/features/Upload/api.ts` -- wraps all I/O (api layer must exist before contract tests)
- [ ] `src/features/Upload/index.ts` -- barrel exports
- [ ] `src/features/Upload/types.ts` -- module types

## Open Questions

1. **useSproutVideoPlayer -- is it actively used?**
   - What we know: Tagged `// Target: @features/Upload`, imports from missing `@/types/transcript`
   - What's unclear: Whether any component actually imports this hook
   - Recommendation: Move it into the module regardless (it's Upload-related). Fix the missing type import by defining `SproutVideoPlayer` interface in Upload types.ts or inline. Verify usage with grep before deciding to export or keep internal.

2. **loadFont.ts -- should it stay in internal/ or go to api.ts?**
   - What we know: Uses Tauri plugins (fontDir, exists, readFile) and opentype.js
   - What's unclear: Whether the font loading should be wrapped in api.ts or kept as an internal utility
   - Recommendation: Keep as `internal/loadFont.ts` but have it call api.ts wrappers for Tauri operations (getFontDir, fileExists, readFileAsBytes). This maintains the single I/O boundary.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 10 hooks, 3 pages, 2 utils inspected directly
- Phase 3 research and implementation: Established module pattern verified against actual code
- Trello contract test: `src/features/Trello/__contracts__/trello.contract.test.ts` -- exact pattern to follow

### Secondary (MEDIUM confidence)
- Hook target tags: `// Target: @features/Upload` annotations from Phase 2 research
- `useBackgroundFolder` and `useAutoFileSelection` are `// Target: @features/BuildProject` per Phase 2 classification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using exact same libraries as Phase 3
- Architecture: HIGH - Following established deep module pattern verbatim
- Pitfalls: HIGH - All cross-dependencies verified by grepping actual imports
- Inventory: HIGH - Every file inspected, all invoke() calls catalogued

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependencies changing)
