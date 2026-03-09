# Phase 7: Baker Module - Research

**Researched:** 2026-03-09
**Domain:** Feature module migration (structural refactor)
**Confidence:** HIGH

## Summary

Phase 7 migrates Baker (drive scanning, breadcrumbs management, batch operations) into a deep feature module at `src/features/Baker/`. This is the seventh module migration following the established pattern from Phases 3-6. Baker is the most I/O-heavy module so far -- 9 hooks, 11+ components, 3 event listeners, 2 Tauri invoke commands, dialog/shell/fs plugin calls, and cross-module dependencies on both Trello and Upload barrels.

The migration is purely structural with no behavioral changes. Baker follows the flat layout pattern (consistent with Upload/Phase 4). The key complexity is: (a) Baker's api.ts must wrap event listeners returning unlisten functions (new pattern), (b) useAppendBreadcrumbs has significant I/O -- Trello REST API calls, dialog plugin, readTextFile -- that must route through api.ts, and (c) several components (FolderSelector, ProjectDetailPanel, VideoLinkCard) have direct plugin imports that must be routed through api.ts.

**Primary recommendation:** Execute as 1 atomic plan. Move all files, create api.ts with ~15 I/O wrappers (invoke, listen, dialog, shell, opener, fs), wire barrel with minimal exports, fix consumer imports, replace 3 alert() calls, write contract tests. Follow exact patterns from Trello/Upload modules.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **All 9 hooks move to Baker**: useBakerScan, useBakerPreferences, useBreadcrumbsManager, useBreadcrumbsPreview, useBreadcrumbsReader, useLiveBreadcrumbsReader, useBreadcrumbsVideoLinks, useAppendBreadcrumbs, useProjectBreadcrumbs
- **useAppendBreadcrumbs and useProjectBreadcrumbs** are breadcrumb I/O hooks consumed only by Trello module hooks -- they live in Baker, exported from barrel for Trello to import
- **useBreadcrumbsReader** moves to Baker (breadcrumbs are Baker domain)
- Trello module imports breadcrumb hooks from `@features/Baker` barrel
- **Flat layout** -- components/ and hooks/ at module root (consistent with Upload/Phase 4)
- **No sub-directories** -- Baker is one cohesive workflow
- **VideoLinks/ sub-directory flattened** -- AddVideoDialog.tsx moves to components/
- **BakerPage.tsx at module root** -- entry-point page component at module root
- **Minimal exports**: BakerPage (for router), useAppendBreadcrumbs, useProjectBreadcrumbs, useBreadcrumbsReader (for Trello), and types
- **Everything else internal**
- **Fix test boundary violations** during migration -- VideoLinksManager.test.tsx imports from @features/Trello/hooks/ and @features/Upload/hooks/ must use barrel paths
- **BatchUpdateConfirmationDialog + BatchUpdate/ sub-components + batchUpdateSummary.ts** all move into Baker module
- **Full consolidation** -- all invoke(), readTextFile, writeTextFile, open (dialog), open (shell), openUrl, listen() routed through api.ts
- **Event listeners**: api.ts exports raw listener wrappers that return unlisten functions
- **Baker types** move from src/types/baker.ts into Baker module's types.ts
- Replace Baker.tsx's 3 alert() calls with logger.error() or sonner toast during migration
- **1 atomic plan** -- no broken intermediate states

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Internal file organization within components/ and hooks/
- Whether to split api.ts if it exceeds ~200 lines (unlikely given Baker's I/O surface)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAKR-01 | User can import Baker components, hooks, and types from `@features/Baker` barrel only | File inventory complete, barrel export list defined, consumer import paths identified (AppRouter.tsx, Trello hooks, VideoLinksManager.test.tsx) |
| BAKR-02 | User can see an API layer wrapping Baker-related Tauri commands | Full I/O audit complete: 5 invoke commands, 3 event listeners, 2 dialog calls, 1 shell open, 1 openUrl, 1 readTextFile, 1 writeTextFile, plus Trello REST API in useAppendBreadcrumbs |
| BAKR-03 | User can see contract tests validating Baker module's public interface | Contract test template from Trello module analyzed, export list defined for shape tests, behavioral test candidates identified |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3 | Component framework | Project standard |
| TypeScript | 5.7 | Type safety | Project standard |
| Vitest | latest | Testing framework | Project standard (migrated from Jest) |
| @testing-library/react | latest | Hook/component testing | Contract test rendering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit | latest | Concurrency control | Already used in useBreadcrumbsPreview |
| sonner | latest | Toast notifications | Replace alert() calls |
| @tauri-apps/api/core | 2.x | invoke() wrapper | Wrapped by api.ts |
| @tauri-apps/api/event | 2.x | listen() wrapper | Event listener wrappers in api.ts |
| @tauri-apps/plugin-dialog | 2.x | File/folder dialogs | Wrapped by api.ts |
| @tauri-apps/plugin-shell | 2.x | Open in Finder | Wrapped by api.ts |
| @tauri-apps/plugin-opener | 2.x | Open URLs | Wrapped by api.ts |
| @tauri-apps/plugin-fs | 2.x | readTextFile/writeTextFile | Wrapped by api.ts |

## Architecture Patterns

### Target Directory Structure
```
src/features/Baker/
├── BakerPage.tsx              # Entry-point page component (module root)
├── index.ts                    # Barrel exports (minimal public API)
├── api.ts                      # I/O boundary (all external calls)
├── types.ts                    # Baker types (moved from src/types/baker.ts)
├── components/
│   ├── BakerPreferences.tsx
│   ├── BatchActions.tsx
│   ├── FolderSelector.tsx
│   ├── PreviewProgress.tsx
│   ├── ProjectDetailPanel.tsx
│   ├── ProjectListPanel.tsx
│   ├── ProjectList.tsx
│   ├── ScanResults.tsx
│   ├── VideoLinkCard.tsx
│   ├── VideoLinksManager.tsx
│   ├── VideoLinksManager.test.tsx
│   ├── AddVideoDialog.tsx       # Flattened from VideoLinks/ sub-dir
│   ├── BatchUpdateConfirmationDialog.tsx  # Moved from src/components/
│   ├── ChangesSummary.tsx       # Moved from src/components/BatchUpdate/
│   ├── CommonUpdates.tsx        # Moved from src/components/BatchUpdate/
│   ├── DetailedChangesSection.tsx # Moved from src/components/BatchUpdate/
│   └── SummaryStats.tsx         # Moved from src/components/BatchUpdate/
├── hooks/
│   ├── useBakerScan.ts
│   ├── useBakerPreferences.ts
│   ├── useBreadcrumbsManager.ts
│   ├── useBreadcrumbsPreview.ts
│   ├── useBreadcrumbsReader.ts
│   ├── useLiveBreadcrumbsReader.ts
│   ├── useBreadcrumbsVideoLinks.ts
│   ├── useAppendBreadcrumbs.ts
│   └── useProjectBreadcrumbs.ts
├── utils/
│   └── batchUpdateSummary.ts    # Moved from src/utils/
└── __contracts__/
    └── baker.contract.test.ts
```

### Pattern 1: api.ts I/O Boundary with Event Listeners
**What:** Single file wrapping ALL external I/O. New for Baker: event listener wrappers returning unlisten functions.
**When to use:** Every module -- established in Phase 3.
**Example:**
```typescript
// api.ts - Baker I/O boundary
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { open as openShell } from '@tauri-apps/plugin-shell'
import { openUrl } from '@tauri-apps/plugin-opener'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import type {
  ScanProgressEvent,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanOptions,
  BatchUpdateResult,
  BreadcrumbsFile,
  FileInfo,
  VideoLink
} from './types'

// --- Tauri Commands ---
export async function bakerStartScan(
  rootPath: string,
  options: ScanOptions
): Promise<string> {
  return invoke<string>('baker_start_scan', { rootPath, options })
}

export async function bakerCancelScan(scanId: string): Promise<void> {
  return invoke('baker_cancel_scan', { scanId })
}

export async function bakerReadBreadcrumbs(
  projectPath: string
): Promise<BreadcrumbsFile | null> {
  return invoke<BreadcrumbsFile | null>('baker_read_breadcrumbs', { projectPath })
}

export async function bakerReadRawBreadcrumbs(
  projectPath: string
): Promise<string | null> {
  return invoke<string | null>('baker_read_raw_breadcrumbs', { projectPath })
}

export async function bakerScanCurrentFiles(
  projectPath: string
): Promise<FileInfo[]> {
  return invoke<FileInfo[]>('baker_scan_current_files', { projectPath })
}

export async function bakerUpdateBreadcrumbs(
  projectPaths: string[],
  createMissing: boolean,
  backupOriginals: boolean
): Promise<BatchUpdateResult> {
  return invoke<BatchUpdateResult>('baker_update_breadcrumbs', {
    projectPaths, createMissing, backupOriginals
  })
}

export async function bakerGetVideoLinks(
  projectPath: string
): Promise<VideoLink[]> {
  return invoke<VideoLink[]>('baker_get_video_links', { projectPath })
}

export async function bakerAssociateVideoLink(
  projectPath: string,
  videoLink: VideoLink
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_associate_video_link', {
    projectPath, videoLink
  })
}

export async function bakerRemoveVideoLink(
  projectPath: string,
  videoIndex: number
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_remove_video_link', {
    projectPath, videoIndex
  })
}

export async function bakerUpdateVideoLink(
  projectPath: string,
  videoIndex: number,
  updatedLink: VideoLink
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_update_video_link', {
    projectPath, videoIndex, updatedLink
  })
}

export async function bakerReorderVideoLinks(
  projectPath: string,
  fromIndex: number,
  toIndex: number
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_reorder_video_links', {
    projectPath, fromIndex, toIndex
  })
}

export async function getFolderSize(folderPath: string): Promise<number> {
  return invoke<number>('get_folder_size', { folderPath })
}

// --- Event Listeners ---
export async function listenScanProgress(
  callback: (event: Event<ScanProgressEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_progress', callback)
}

export async function listenScanComplete(
  callback: (event: Event<ScanCompleteEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_complete', callback)
}

export async function listenScanError(
  callback: (event: Event<ScanErrorEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_error', callback)
}

// --- Dialog ---
export async function openFolderDialog(title: string): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false, title })
  return typeof selected === 'string' ? selected : null
}

export async function openJsonFileDialog(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  return typeof selected === 'string' ? selected : null
}

// --- Shell / Opener ---
export async function openInShell(path: string): Promise<void> {
  return openShell(path)
}

export async function openExternalUrl(url: string): Promise<void> {
  return openUrl(url)
}

// --- File System ---
export async function readTextFileContents(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeTextFileContents(
  path: string,
  content: string
): Promise<void> {
  return writeTextFile(path, content)
}
```

### Pattern 2: Minimal Barrel Exports
**What:** Only export what external consumers need.
**When to use:** Every feature module barrel.
**Example:**
```typescript
// index.ts
// Page
export { default as BakerPage } from './BakerPage'

// Hooks (consumed by Trello module)
export { useAppendBreadcrumbs, generateBreadcrumbsBlock, updateTrelloCardWithBreadcrumbs } from './hooks/useAppendBreadcrumbs'
export { useProjectBreadcrumbs } from './hooks/useProjectBreadcrumbs'
export { useBreadcrumbsReader } from './hooks/useBreadcrumbsReader'

// Types (consumed by Trello and other modules)
export type {
  BreadcrumbsFile,
  ProjectFolder,
  ScanResult,
  VideoLink,
  // ... other types needed externally
} from './types'
```

### Pattern 3: Contract Tests
**What:** Shape + behavioral tests locking the public API.
**When to use:** Every module's `__contracts__/` directory.

### Anti-Patterns to Avoid
- **Deep imports past barrel:** `@features/Baker/hooks/useBakerScan` -- always use `@features/Baker`
- **Direct plugin imports in components:** Components must use api.ts wrappers, not `@tauri-apps/*` directly
- **Barrel files in internal directories:** No `components/index.ts` or `hooks/index.ts`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event listener cleanup | Manual unlisten tracking | api.ts wrapper returning unlisten fn | Consistent pattern, single mock point |
| Toast notifications | Custom alert replacement | sonner toast (already in project) | Phase 4/5 established pattern |
| Concurrency control | Custom queue | p-limit (already used) | Battle-tested, already a dependency |

## Common Pitfalls

### Pitfall 1: useAppendBreadcrumbs Has Trello REST API Calls
**What goes wrong:** useAppendBreadcrumbs directly calls `fetch()` to update Trello cards and add comments. This I/O must route through api.ts, but the fetch calls are to Trello API -- not Baker Tauri commands.
**Why it happens:** This hook is a cross-domain bridge between Baker (breadcrumbs) and Trello (card updates).
**How to avoid:** Route the Trello REST calls through Baker's api.ts (since the hook lives in Baker). The Trello module's api.ts already has similar wrappers (`updateTrelloCard`, `addCardComment`) but useAppendBreadcrumbs does its own fetch calls. Wrap these in Baker api.ts as `updateTrelloCardDescription` and `addTrelloCardComment`, or import from `@features/Trello` api if the Trello barrel re-exports them.
**Warning signs:** Direct `fetch()` calls remaining in hook files after migration.

### Pitfall 2: VideoLinksManager.test.tsx Has Deep Import Violations
**What goes wrong:** The test file imports from `@features/Trello/hooks/useBreadcrumbsTrelloCards`, `@features/Upload/hooks/useFileUpload`, etc. -- bypassing barrels.
**Why it happens:** Test was written before barrel enforcement.
**How to avoid:** Update all vi.mock() paths to barrel paths: `@features/Trello`, `@features/Upload`, `@hooks/useBreadcrumbsVideoLinks` -> `../hooks/useBreadcrumbsVideoLinks` (internal).
**Warning signs:** ESLint boundary warnings on test files.

### Pitfall 3: Trello Module Currently Imports from @hooks/useAppendBreadcrumbs
**What goes wrong:** Four files in `src/features/Trello/` import `useAppendBreadcrumbs` from `@hooks/useAppendBreadcrumbs`. After migration, this path will be dead.
**How to avoid:** Update these imports to `@features/Baker` barrel: `useTrelloBreadcrumbs.ts`, `useUploadTrello.ts`, `useVideoLinksManager.ts`, `TrelloIntegrationModal.tsx`.
**Warning signs:** Import resolution errors after file moves.

### Pitfall 4: Trello Contract Test Mocks @hooks/useAppendBreadcrumbs
**What goes wrong:** `trello.contract.test.ts` mocks `@hooks/useAppendBreadcrumbs` and `@hooks/useBreadcrumbsVideoLinks`. These paths change.
**How to avoid:** Update mock paths to `@features/Baker` in the Trello contract test.
**Warning signs:** Contract test failures after migration.

### Pitfall 5: BatchUpdate/index.ts Sub-barrel
**What goes wrong:** `src/components/BatchUpdate/index.ts` is a sub-barrel that re-exports 4 components. Moving these into Baker's components/ means this barrel file should be deleted, and the BatchUpdateConfirmationDialog should import directly.
**How to avoid:** Delete the BatchUpdate/index.ts barrel, update BatchUpdateConfirmationDialog to use direct imports from sibling files.
**Warning signs:** Orphaned barrel file, or duplicate exports.

### Pitfall 6: useProjectBreadcrumbs Imports from Sibling Hook
**What goes wrong:** `useProjectBreadcrumbs.ts` imports `FootageFile` type from `./useCameraAutoRemap`. useCameraAutoRemap is a BuildProject hook (not Baker). This import must be updated.
**How to avoid:** Import `FootageFile` type from `@hooks/useCameraAutoRemap` (stays in shared hooks until Phase 8 BuildProject migration). Or inline the type if it's simple.
**Warning signs:** Broken import after file move.

### Pitfall 7: Component Uses BreadcrumbsViewer from Old Path
**What goes wrong:** ProjectDetailPanel imports `formatFileSize` from `@/components/BreadcrumbsViewer/fieldUtils`. This is NOT a Baker-internal file -- it stays external.
**How to avoid:** Keep this import as-is (it's a shared utility import, not a Baker internal).
**Warning signs:** Over-aggressively moving non-Baker files.

## Code Examples

### alert() Replacement (3 instances in Baker.tsx)
```typescript
// BEFORE (line 77, 128, 164 in Baker.tsx)
alert('Please select a folder to scan')
alert(errorMessage)
alert(`Failed to update breadcrumbs: ${error}`)

// AFTER - use sonner toast (Phase 4/5 pattern)
import { toast } from 'sonner'

toast.warning('Please select a folder to scan')
toast.error(errorMessage)
toast.error(`Failed to update breadcrumbs: ${error}`)
```

### Consumer Import Update (AppRouter.tsx)
```typescript
// BEFORE
import Baker from './pages/Baker/Baker'

// AFTER
import { BakerPage as Baker } from '@features/Baker'
```

### Trello Module Import Update
```typescript
// BEFORE (in src/features/Trello/hooks/useTrelloBreadcrumbs.ts)
import { useAppendBreadcrumbs } from '@hooks/useAppendBreadcrumbs'

// AFTER
import { useAppendBreadcrumbs } from '@features/Baker'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct plugin imports in components | api.ts wraps all I/O | Phase 3 | Single mock point for testing |
| alert() for user feedback | sonner toast / logger.error() | Phase 4/5 | Consistent UX, no blocking dialogs |
| Deep imports into feature modules | Barrel-only imports | Phase 2 | Enforced module boundaries |

## Open Questions

1. **useAppendBreadcrumbs Trello fetch() calls**
   - What we know: The hook has direct Trello REST API fetch() calls for updating card descriptions and adding comments
   - What's unclear: Whether to wrap these in Baker's api.ts or import from Trello's api.ts
   - Recommendation: Wrap in Baker's api.ts since the hook lives in Baker. This keeps api.ts as the single I/O boundary. The functions are simple fetch wrappers (update card desc, add comment) -- ~15 lines each.

2. **FootageFile type import in useProjectBreadcrumbs**
   - What we know: Currently imports from `./useCameraAutoRemap` which is a BuildProject hook
   - What's unclear: Whether to copy the type or keep cross-hook import
   - Recommendation: Import from `@hooks/useCameraAutoRemap` using the legacy path alias. This hook stays in src/hooks/ until Phase 8 (BuildProject migration). The type is small (just `{ camera: number; file: { name: string; path: string } }`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | vite.config.ts (Vitest configured inline) |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAKR-01 | Barrel exports correct shape, no deep imports possible | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 |
| BAKR-02 | api.ts wraps all I/O, hooks use api.ts not direct imports | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 |
| BAKR-03 | Contract tests validate public interface | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/Baker/__contracts__/baker.contract.test.ts` -- covers BAKR-01, BAKR-02, BAKR-03
- [ ] `src/features/Baker/api.ts` -- I/O boundary (must exist before contract tests run)
- [ ] `src/features/Baker/index.ts` -- barrel exports (must exist before contract tests run)

## File Inventory (Complete)

### Files Moving INTO Baker Module

**Page (1 file):**
- `src/pages/Baker/Baker.tsx` -> `src/features/Baker/BakerPage.tsx`

**Components (12 files):**
- `src/components/Baker/BakerPreferences.tsx` -> `components/BakerPreferences.tsx`
- `src/components/Baker/BatchActions.tsx` -> `components/BatchActions.tsx`
- `src/components/Baker/FolderSelector.tsx` -> `components/FolderSelector.tsx`
- `src/components/Baker/PreviewProgress.tsx` -> `components/PreviewProgress.tsx`
- `src/components/Baker/ProjectDetailPanel.tsx` -> `components/ProjectDetailPanel.tsx`
- `src/components/Baker/ProjectListPanel.tsx` -> `components/ProjectListPanel.tsx`
- `src/components/Baker/ProjectList.tsx` -> `components/ProjectList.tsx`
- `src/components/Baker/ScanResults.tsx` -> `components/ScanResults.tsx`
- `src/components/Baker/VideoLinkCard.tsx` -> `components/VideoLinkCard.tsx`
- `src/components/Baker/VideoLinksManager.tsx` -> `components/VideoLinksManager.tsx`
- `src/components/Baker/VideoLinksManager.test.tsx` -> `components/VideoLinksManager.test.tsx`
- `src/components/Baker/VideoLinks/AddVideoDialog.tsx` -> `components/AddVideoDialog.tsx`

**Batch Update Components (5 files):**
- `src/components/BatchUpdateConfirmationDialog.tsx` -> `components/BatchUpdateConfirmationDialog.tsx`
- `src/components/BatchUpdate/ChangesSummary.tsx` -> `components/ChangesSummary.tsx`
- `src/components/BatchUpdate/CommonUpdates.tsx` -> `components/CommonUpdates.tsx`
- `src/components/BatchUpdate/DetailedChangesSection.tsx` -> `components/DetailedChangesSection.tsx`
- `src/components/BatchUpdate/SummaryStats.tsx` -> `components/SummaryStats.tsx`

**Hooks (9 files):**
- `src/hooks/useBakerScan.ts` -> `hooks/useBakerScan.ts`
- `src/hooks/useBakerPreferences.ts` -> `hooks/useBakerPreferences.ts`
- `src/hooks/useBreadcrumbsManager.ts` -> `hooks/useBreadcrumbsManager.ts`
- `src/hooks/useBreadcrumbsPreview.ts` -> `hooks/useBreadcrumbsPreview.ts`
- `src/hooks/useBreadcrumbsReader.ts` -> `hooks/useBreadcrumbsReader.ts`
- `src/hooks/useLiveBreadcrumbsReader.ts` -> `hooks/useLiveBreadcrumbsReader.ts`
- `src/hooks/useBreadcrumbsVideoLinks.ts` -> `hooks/useBreadcrumbsVideoLinks.ts`
- `src/hooks/useAppendBreadcrumbs.ts` -> `hooks/useAppendBreadcrumbs.ts`
- `src/hooks/useProjectBreadcrumbs.ts` -> `hooks/useProjectBreadcrumbs.ts`

**Types (1 file):**
- `src/types/baker.ts` -> `types.ts`

**Utils (1 file):**
- `src/utils/batchUpdateSummary.ts` -> `utils/batchUpdateSummary.ts`

**Deleted after move:**
- `src/components/BatchUpdate/index.ts` (sub-barrel, no longer needed)
- `src/pages/Baker/` (empty directory)
- `src/components/Baker/` (empty directory)
- `src/components/Baker/VideoLinks/` (empty directory)

### Files to DELETE (sub-barrels/empties)
- `src/components/BatchUpdate/index.ts`

### I/O Audit (api.ts Functions)

| I/O Call | Source File(s) | api.ts Wrapper |
|----------|---------------|----------------|
| `invoke('baker_start_scan')` | useBakerScan | `bakerStartScan` |
| `invoke('baker_cancel_scan')` | useBakerScan | `bakerCancelScan` |
| `invoke('baker_read_breadcrumbs')` | useBreadcrumbsReader, useLiveBreadcrumbsReader, useBreadcrumbsPreview | `bakerReadBreadcrumbs` |
| `invoke('baker_read_raw_breadcrumbs')` | useLiveBreadcrumbsReader | `bakerReadRawBreadcrumbs` |
| `invoke('baker_scan_current_files')` | useLiveBreadcrumbsReader, useBreadcrumbsPreview | `bakerScanCurrentFiles` |
| `invoke('baker_update_breadcrumbs')` | useBreadcrumbsManager | `bakerUpdateBreadcrumbs` |
| `invoke('baker_get_video_links')` | useBreadcrumbsVideoLinks | `bakerGetVideoLinks` |
| `invoke('baker_associate_video_link')` | useBreadcrumbsVideoLinks | `bakerAssociateVideoLink` |
| `invoke('baker_remove_video_link')` | useBreadcrumbsVideoLinks | `bakerRemoveVideoLink` |
| `invoke('baker_update_video_link')` | useBreadcrumbsVideoLinks | `bakerUpdateVideoLink` |
| `invoke('baker_reorder_video_links')` | useBreadcrumbsVideoLinks | `bakerReorderVideoLinks` |
| `invoke('get_folder_size')` | useProjectBreadcrumbs, useBreadcrumbsPreview | `getFolderSize` |
| `listen('baker_scan_progress')` | useBakerScan | `listenScanProgress` |
| `listen('baker_scan_complete')` | useBakerScan | `listenScanComplete` |
| `listen('baker_scan_error')` | useBakerScan | `listenScanError` |
| `open({ directory: true })` | FolderSelector | `openFolderDialog` |
| `open({ filters: [...] })` | useAppendBreadcrumbs | `openJsonFileDialog` |
| `open(url)` (shell) | ProjectDetailPanel | `openInShell` |
| `openUrl(url)` (opener) | VideoLinkCard | `openExternalUrl` |
| `readTextFile(path)` | useAppendBreadcrumbs | `readTextFileContents` |
| `writeTextFile(path, content)` | useProjectBreadcrumbs | `writeTextFileContents` |
| `fetch(trello API)` | useAppendBreadcrumbs (2 calls) | `updateTrelloCardDesc`, `addTrelloCardComment` |
| `ask()/confirm()` (dialog) | useAppendBreadcrumbs | `askDialog`, `confirmDialog` |

**Total: ~24 api.ts wrapper functions.** This exceeds the expected ~200 lines. Consider splitting into logical groups within a single file using section comments (commands, events, dialog, fs, external API), rather than splitting into multiple files.

### Consumer Updates Required

| Consumer File | Current Import | New Import |
|---------------|---------------|------------|
| `src/AppRouter.tsx` | `import Baker from './pages/Baker/Baker'` | `import { BakerPage as Baker } from '@features/Baker'` |
| `src/features/Trello/hooks/useTrelloBreadcrumbs.ts` | `from '@hooks/useAppendBreadcrumbs'` | `from '@features/Baker'` |
| `src/features/Trello/hooks/useUploadTrello.ts` | `from '@hooks/useAppendBreadcrumbs'` | `from '@features/Baker'` |
| `src/features/Trello/hooks/useVideoLinksManager.ts` | `from '@hooks/useAppendBreadcrumbs'` | `from '@features/Baker'` |
| `src/features/Trello/components/TrelloIntegrationModal.tsx` | `from '@hooks/useAppendBreadcrumbs'` | `from '@features/Baker'` |
| `src/features/Trello/__contracts__/trello.contract.test.ts` | `vi.mock('@hooks/useAppendBreadcrumbs')` | `vi.mock('@features/Baker')` |
| `src/features/Trello/__contracts__/trello.contract.test.ts` | `vi.mock('@hooks/useBreadcrumbsVideoLinks')` | `vi.mock('@features/Baker')` |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all Baker source files (9 hooks, 12+ components, types, utils)
- Existing module patterns from Trello (Phase 3), Upload (Phase 4), Settings (Phase 5), AITools (Phase 6)
- CONTEXT.md locked decisions from user discussion

### Secondary (MEDIUM confidence)
- Phase 2 `// Target: @features/Baker` tags confirming hook assignments
- STATE.md accumulated decisions from Phases 3-6

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - identical to Phases 3-6, no new libraries needed
- Architecture: HIGH - follows exact established pattern, all decisions locked
- Pitfalls: HIGH - complete I/O audit performed, all consumer imports identified through grep
- File inventory: HIGH - every file verified via glob, every I/O call verified via grep

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- structural refactor, no external dependencies)
