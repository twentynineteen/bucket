# Phase 8: BuildProject Module - Research

**Researched:** 2026-03-09
**Domain:** Feature module migration (structural refactor, zero behavioral changes)
**Confidence:** HIGH

## Summary

Phase 8 migrates the BuildProject workflow (file ingest, camera assignment, XState machine, project creation) from scattered `src/pages/BuildProject/` and `src/hooks/` locations into a consolidated deep feature module at `src/features/BuildProject/`. This follows the exact same pattern established by Baker (Phase 7), Upload (Phase 4), and other completed modules.

The migration is mechanical: move 9 page/component files, 10 hooks, and 1 XState machine into the new module directory; create an api.ts wrapping ~15 I/O functions; create a minimal barrel exporting only BuildProjectPage; write contract tests; update 2 consumers (AppRouter + Upload/Posterframe); clean up the now-empty `src/machines/` directory and `@machines/*` path alias. Two hooks (useAutoFileSelection, useBackgroundFolder) move to the Upload module instead, resolving TODO(Phase 8) comments.

**Primary recommendation:** Execute as a single atomic plan following the Baker module pattern exactly -- flat layout, api.ts I/O boundary, minimal barrel, no-bypass contract tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **10 hooks move to BuildProject**: useBuildProjectMachine, useCreateProjectWithMachine, useProjectState, useFileSelector, useCameraAutoRemap, useFileOperations, useProjectValidation, useProjectFolders, usePostProjectCompletion, useVideoInfoBlock
- **useAutoFileSelection moves to Upload module** -- consumed by Posterframe, not BuildProject
- **useBackgroundFolder moves to Upload module** -- consumed by Posterframe, not BuildProject
- **buildProjectMachine.ts at module root** -- sits alongside api.ts and types.ts, not in hooks/ or a sub-directory
- **Machine is internal only** -- not exported from barrel. Only useBuildProjectMachine consumes it
- **Delete src/machines/ directory** -- empty after migration
- **Remove @machines/ path alias** -- from tsconfig (only 3 consumers, all moving into BuildProject module)
- **BuildProject's api.ts wraps copy_premiere_project directly** -- no import from @features/Premiere needed
- **show_confirmation_dialog also in BuildProject's api.ts** -- it's a BuildProject I/O operation
- **No @features/Premiere barrel dependency** -- zero imports from Premiere in BuildProject files
- **Minimal barrel exports**: BuildProjectPage only (for router)
- **Everything else internal** -- all 10 hooks, machine, step components, types are module-internal
- **Flat layout** -- components/ and hooks/ at module root (consistent with Baker/Upload)
- **BuildProjectPage.tsx at module root** -- entry-point page component
- **Full I/O consolidation** -- all invoke(), dialog, fs, and event listeners routed through api.ts
- **Event listeners return unlisten functions** (same pattern as Baker)
- **1 atomic plan** -- no broken intermediate states

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Internal file organization within components/ and hooks/
- Whether to split api.ts if it exceeds ~200 lines

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BLDP-01 | User can import BuildProject components, hooks, and types from `@features/BuildProject` barrel only | Barrel exports BuildProjectPage only (minimal). Internal hooks/components not re-exported. AppRouter updated to import from barrel |
| BLDP-02 | User can see an API layer wrapping BuildProject-related Tauri commands | api.ts wraps 4 invoke commands, 4 event listeners, 2 dialog functions, 4 fs operations = ~15 I/O wrappers |
| BLDP-03 | User can see XState machine colocated within the BuildProject module | buildProjectMachine.ts moves to module root alongside api.ts. @machines/ alias removed from tsconfig |
| BLDP-04 | User can see contract tests validating BuildProject module's public interface | Contract tests follow Baker pattern: shape tests (barrel + api.ts), behavioral tests (exported hooks if any), no-bypass tests (grep for @tauri-apps) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xstate | 5.x | BuildProject workflow state machine | Already in use; machine migrates as-is |
| @xstate/react | 4.x | React bindings for XState | useMachine hook in useBuildProjectMachine |
| @tauri-apps/api | 2.x | Core invoke() for Rust commands | 4 commands: move_files, get_folder_size, copy_premiere_project, show_confirmation_dialog |
| @tauri-apps/plugin-dialog | 2.x | File picker and confirm dialogs | open() for file selection, confirm() for validation |
| @tauri-apps/plugin-fs | 2.x | File system operations | mkdir, exists, remove, writeTextFile |
| @tauri-apps/api/event | 2.x | Tauri event system | listen() for copy_progress, copy_complete, copy_file_error, copy_complete_with_errors |
| vitest | current | Test framework | Contract tests follow established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | current | renderHook for contract tests | Behavioral tests on exported hooks |
| @tanstack/react-query | current | Data fetching in useCameraAutoRemap | Already used, no changes needed |

## Architecture Patterns

### Target Module Structure
```
src/features/BuildProject/
  buildProjectMachine.ts   # XState machine (internal, NOT exported)
  BuildProjectPage.tsx     # Entry-point page component
  api.ts                   # I/O boundary (~15 functions)
  types.ts                 # Extracted types (FootageFile, BuildProjectContext, BuildProjectEvent, etc.)
  index.ts                 # Barrel: exports { default as BuildProjectPage }
  components/
    ProjectConfigurationStep.tsx
    AddFootageStep.tsx
    CreateProjectStep.tsx
    ProjectFileList.tsx
    ProjectInputs.tsx
    FolderSelector.tsx
    ProgressBar.tsx
    SuccessSection.tsx
  hooks/
    useBuildProjectMachine.ts
    useCreateProjectWithMachine.ts
    useProjectState.ts
    useFileSelector.ts
    useCameraAutoRemap.ts
    useFileOperations.ts
    useProjectValidation.ts
    useProjectFolders.ts
    usePostProjectCompletion.ts
    useVideoInfoBlock.ts
  __contracts__/
    buildproject.contract.test.ts
```

### Pattern 1: api.ts I/O Boundary
**What:** Single file wrapping ALL external calls (invoke, listen, dialog, fs plugins)
**When to use:** Every feature module -- established in Phase 3, refined through Phase 7
**Example (following Baker pattern):**
```typescript
// api.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { confirm, open as openDialog } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs'

// --- Tauri Commands ---
export async function moveFiles(files: [string, number][], baseDest: string): Promise<void> {
  return invoke('move_files', { files, baseDest })
}

export async function getFolderSize(folderPath: string): Promise<number> {
  return invoke<number>('get_folder_size', { folderPath })
}

export async function copyPremiereProject(destinationFolder: string, newTitle: string): Promise<void> {
  return invoke('copy_premiere_project', { destinationFolder, newTitle })
}

export async function showConfirmationDialog(message: string, title: string, destination: string): Promise<void> {
  return invoke('show_confirmation_dialog', { message, title, destination })
}

// --- Event Listeners ---
export async function listenCopyProgress(callback: (event: Event<number>) => void): Promise<() => void> {
  return listen('copy_progress', callback)
}
// ... etc for copy_complete, copy_file_error, copy_complete_with_errors

// --- Dialog ---
export async function openFileDialog(): Promise<string[] | null> { ... }
export async function confirmDialog(message: string): Promise<boolean> { ... }

// --- File System ---
export async function createDirectory(path: string): Promise<void> { ... }
export async function pathExists(path: string): Promise<boolean> { ... }
export async function removePath(path: string): Promise<void> { ... }
export async function writeTextFileContents(path: string, content: string): Promise<void> { ... }
```

### Pattern 2: Minimal Barrel Export
**What:** Only export what external consumers need (BuildProjectPage for router)
**When to use:** This module -- everything else is internal
```typescript
// index.ts
export { default as BuildProjectPage } from './BuildProjectPage'
```

### Pattern 3: Event Listener Wrappers
**What:** api.ts exports async functions that return unlisten callbacks
**When to use:** For Tauri event listeners (established in Baker Phase 7)
```typescript
export async function listenCopyProgress(
  callback: (event: Event<number>) => void
): Promise<() => void> {
  return listen('copy_progress', callback)
}
```

### Anti-Patterns to Avoid
- **Exporting machine from barrel:** The XState machine is internal to the module. Only useBuildProjectMachine consumes it
- **Importing @tauri-apps directly in hooks/components:** All I/O must go through api.ts
- **Keeping @machines/ alias after migration:** Remove from tsconfig to prevent stale references
- **Creating barrel files in internal directories (components/, hooks/):** Established convention from Phase 2

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module structure | Custom layout | Baker module pattern (flat layout) | 7 phases of proven pattern |
| Contract tests | Custom test framework | Baker __contracts__ pattern | Shape + behavioral + no-bypass structure established |
| I/O boundary | Partial wrapping | Full api.ts consolidation | Single mock point for all tests |
| Import updates | Manual find-replace | Bulk update (Python script or careful sed) | Phase 02 established atomic bulk update pattern |

## Common Pitfalls

### Pitfall 1: Circular Import Between Machine and Hooks
**What goes wrong:** buildProjectMachine.ts imports FootageFile type from useCameraAutoRemap; hooks import types from machine
**Why it happens:** Types are scattered across hooks and machine file
**How to avoid:** Extract ALL shared types to types.ts at module root. Both machine and hooks import from types.ts
**Warning signs:** TypeScript circular dependency errors during build

### Pitfall 2: Forgetting to Update Upload Module Imports
**What goes wrong:** Posterframe.tsx still imports useAutoFileSelection and useBackgroundFolder from @hooks/
**Why it happens:** These hooks move to Upload, not BuildProject. Easy to miss in a BuildProject-focused migration
**How to avoid:** Resolve TODO(Phase 8) comments in Posterframe.tsx -- update imports to local ./hooks/ paths
**Warning signs:** ESLint boundary violations from @hooks/ imports in Upload module

### Pitfall 3: useBackgroundFolder Has @tauri-apps Import
**What goes wrong:** Moving useBackgroundFolder to Upload module but forgetting to route readDir through Upload's api.ts
**Why it happens:** useBackgroundFolder directly imports `readDir` from `@tauri-apps/plugin-fs`
**How to avoid:** Refactor useBackgroundFolder to use Upload's api.ts (which already has readDir wrapped)
**Warning signs:** No-bypass contract tests will catch direct @tauri-apps imports

### Pitfall 4: @machines/ Path Alias Removal
**What goes wrong:** Removing alias from tsconfig but missing vite.config.ts, or vice versa
**Why it happens:** Path aliases are configured in two places
**How to avoid:** Verified: @machines/ alias is only in tsconfig.json (line 24), NOT in vite.config.ts. Only need to remove from tsconfig
**Warning signs:** Build errors about unresolved @machines/ paths

### Pitfall 5: FolderSelector Imports @components/FolderTree
**What goes wrong:** FolderSelector.tsx imports from `@components/FolderTree` -- a shared component
**Why it happens:** This is a legitimate cross-boundary import to shared UI
**How to avoid:** This is correct -- FolderTree is a shared component, not a BuildProject component. The import stays as-is (or uses @shared/ui if FolderTree was moved there)
**Warning signs:** None -- this is the expected pattern

### Pitfall 6: AddFootageStep Imports FootageFile Type from @hooks/
**What goes wrong:** AddFootageStep.tsx imports `FootageFile` from `@hooks/useCameraAutoRemap`
**Why it happens:** Type is currently defined in the hook file
**How to avoid:** Extract FootageFile to BuildProject types.ts, update component to import from `../types`
**Warning signs:** ESLint boundary violations

## Code Examples

### Contract Test Pattern (from Baker -- adapt for BuildProject)
```typescript
// __contracts__/buildproject.contract.test.ts
import * as buildProjectBarrel from '../index'
import * as buildProjectApi from '../api'

describe('BuildProject Barrel Exports - Shape', () => {
  const expectedExports = ['BuildProjectPage'].sort()

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(buildProjectBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('exports exactly 1 runtime member', () => {
    expect(Object.keys(buildProjectBarrel)).toHaveLength(1)
  })

  it('exports BuildProjectPage as a function', () => {
    expect(typeof buildProjectBarrel.BuildProjectPage).toBe('function')
  })

  it('does NOT export internal hooks', () => {
    const names = Object.keys(buildProjectBarrel)
    expect(names).not.toContain('useBuildProjectMachine')
    expect(names).not.toContain('useProjectState')
    // ... etc
  })
})
```

### api.ts I/O Function Count
Based on hook analysis, BuildProject api.ts needs approximately 15 wrappers:

| Category | Functions | Count |
|----------|-----------|-------|
| Tauri Commands | moveFiles, getFolderSize, copyPremiereProject, showConfirmationDialog | 4 |
| Event Listeners | listenCopyProgress, listenCopyComplete, listenCopyFileError, listenCopyCompleteWithErrors | 4 |
| Dialog | openFileDialog, confirmDialog | 2 |
| File System | createDirectory, pathExists, removePath, writeTextFileContents | 4 |
| **Total** | | **14** |

This is well under the 200-line threshold -- no need to split api.ts.

### Types to Extract to types.ts
```typescript
// types.ts
export interface FootageFile {
  file: { path: string; name: string }
  camera: number
}

export interface BuildProjectContext { /* from machine */ }
export type BuildProjectEvent = /* from machine */

export interface CopyFileError { file: string; error: string }
export interface CopyCompleteWithErrors {
  successful_files: string[]
  failed_files: CopyFileError[]
  failure_count: number
  success_count: number
  total_files: number
}

export interface ValidationResult { /* from useProjectValidation */ }
export interface FolderCreationResult { /* from useProjectFolders */ }
export interface MoveFilesResult { /* from useFileOperations */ }
export interface VideoInfoData { /* from useVideoInfoBlock */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hooks in src/hooks/ with // Target tags | Colocated in feature modules | Phase 3-7 | All remaining BuildProject hooks still in src/hooks/ |
| Machine in src/machines/ | Colocated in feature module root | This phase | Only 1 machine file; directory deleted after |
| @machines/* path alias | Direct relative imports within module | This phase | 3 consumers all internal to BuildProject |

## Open Questions

1. **FolderSelector's @components/FolderTree import**
   - What we know: FolderSelector.tsx imports FolderTree from `@components/FolderTree`, which is a shared reusable component
   - What's unclear: Whether FolderTree has been moved to @shared/ui/ or still lives at @components/
   - Recommendation: Keep the import as-is. FolderTree is a shared UI component, not owned by BuildProject

2. **useAutoFileSelection has no @tauri-apps imports**
   - What we know: It uses @tanstack/react-query and @shared/lib but no direct Tauri calls
   - What's unclear: Whether it needs api.ts routing or just moves as-is
   - Recommendation: Move to Upload hooks/ as-is -- no api.ts changes needed for this hook

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (current) |
| Config file | Inline in vite.config.ts (standard Vitest setup) |
| Quick run command | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLDP-01 | Barrel exports only BuildProjectPage | unit (shape) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | Wave 0 |
| BLDP-02 | api.ts wraps all I/O | unit (shape + no-bypass) | Same contract test file | Wave 0 |
| BLDP-03 | XState machine colocated | unit (file existence + import) | Same contract test file + build succeeds | Wave 0 |
| BLDP-04 | Contract tests pass | unit | Same contract test file | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts`
- **Per wave merge:** `bun run test -- --run`
- **Phase gate:** Full suite green + ESLint clean

### Wave 0 Gaps
- [ ] `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` -- covers BLDP-01, BLDP-02, BLDP-03, BLDP-04
- [ ] Types extraction to `src/features/BuildProject/types.ts` -- prerequisite for clean imports

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 10 hooks, machine, components, and existing module patterns
- Baker module (Phase 7) -- latest and most complete reference pattern
- Baker contract tests -- exact template for BuildProject contract tests

### Secondary (MEDIUM confidence)
- Phase 2 `// Target: @features/BuildProject` annotations on all hooks -- confirmed hook ownership

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - direct replication of Baker module pattern with 7 phases of precedent
- Pitfalls: HIGH - all based on actual codebase inspection (circular imports, stale aliases, Upload hook routing)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- structural refactor with established patterns)
