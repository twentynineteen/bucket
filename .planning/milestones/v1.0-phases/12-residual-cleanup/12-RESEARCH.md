# Phase 12: Residual Cleanup & Navigation Fixes - Research

**Researched:** 2026-03-10
**Domain:** Tech debt cleanup -- file migration, sidebar navigation, test mock updates, dead code removal
**Confidence:** HIGH

## Summary

Phase 12 addresses 5 discrete tech debt items identified in the v1.0 milestone audit. All items are straightforward file operations with well-understood patterns already established in prior phases. No new libraries, no architectural decisions, no external research needed.

The work breaks into two natural groups: (1) file moves/deletions (useWindowState migration, broken re-export cleanup, ThemeImport removal) and (2) integration updates (sidebar navigation entry for UploadOtter, AppRouter test mock modernization). All affected files have been inspected and their current state is documented below.

**Primary recommendation:** Execute as a single plan with two waves -- file operations first, integration updates second.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- useWindowState moves to `src/shared/hooks/useWindowState.ts`, excluded from barrel (follows Phase 9 Tauri-dependent hook pattern)
- App.tsx import changes to `@shared/hooks/useWindowState` (direct path, not barrel)
- Delete `src/hooks/useWindowState.ts`, `src/hooks/index.ts`, and entire `src/hooks/` directory
- Test at `tests/unit/hooks/useWindowState.test.ts` stays in place (don't move)
- UploadOtter sidebar entry: label "Transcription", placed after Trello in "Upload content" group
- Route changes from `/otter` to `/upload/otter` (already at `/upload/otter` in AppRouter -- see findings below)
- Update all 9 stale `@pages/*` mocks in AppRouter.test.tsx to `@features/*` barrel paths
- Remove IngestHistory mock if route was removed (it was -- Phase 11)
- Remove ConnectedApps mock if route no longer exists (it doesn't)
- Delete `src/shared/ui/theme/ThemeImport.tsx` entirely (stub with TODO, not imported anywhere)

### Claude's Discretion
- Exact sidebar icon choice for Transcription/Otter entry
- Which specific `@features/*` barrel path maps to each stale `@pages/*` mock
- Whether dashboard page mock path needs updating
- Add barrel exclusion comment for useWindowState in shared hooks index.ts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Current State of Affected Files

### File Inventory (verified via direct inspection)

| File | Current State | Action |
|------|--------------|--------|
| `src/hooks/useWindowState.ts` | 124 lines, imports `@tauri-apps/api/window` | Move to `src/shared/hooks/useWindowState.ts` |
| `src/hooks/index.ts` | 1 line: `export { useAppendVideoInfo } from './useAppendVideoInfo'` (broken -- file doesn't exist) | Delete |
| `src/hooks/` directory | Contains only the 2 files above | Delete entire directory after moves |
| `src/App.tsx` line 14 | `import { useWindowState } from './hooks/useWindowState'` | Update to `@shared/hooks/useWindowState` |
| `src/shared/hooks/index.ts` | 7 exports + comment about Tauri-excluded hooks (line 13-15) | Add useWindowState exclusion comment |
| `src/shared/ui/theme/ThemeImport.tsx` | 46-line stub with TODO placeholder, zero importers | Delete |
| `src/shared/ui/layout/app-sidebar.tsx` | Upload content group has 3 items: Sprout, Posterframe, Trello | Add "Transcription" after Trello |
| `src/AppRouter.tsx` line 168 | Route already at `path="otter"` under `<Route path="upload">` -- resolves to `/upload/otter` | No change needed (already correct) |
| `tests/unit/AppRouter.test.tsx` | 9 stale `@pages/*` mocks (lines 20-67) | Replace with `@features/*` barrel mocks |
| `tests/unit/hooks/useWindowState.test.ts` | 426 lines, imports from `../../../src/hooks/useWindowState` | Update import path only |

### Key Finding: Route Already Correct

The CONTEXT.md says to "change route from `/otter` to `/upload/otter`". Inspection of `src/AppRouter.tsx` shows the route is already nested correctly:
```tsx
<Route path="upload">
  ...
  <Route path="otter" element={<UploadOtter />} />
</Route>
```
This resolves to `/upload/otter`. No route change is needed -- only the sidebar entry is missing.

## Architecture Patterns

### Tauri-Dependent Hook Barrel Exclusion Pattern

Established in Phase 9 (decision [09-01]). The shared hooks barrel at `src/shared/hooks/index.ts` ends with:

```typescript
// Note: useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck
// are NOT barrel-exported because they depend on Tauri runtime plugins.
// Import them directly: import { useMacOSEffects } from '@shared/hooks/useMacOSEffects'
```

useWindowState must follow this exact same pattern. Add it to the comment list and provide the direct import path.

### Sidebar Navigation Entry Pattern

From `app-sidebar.tsx`, each entry in a nav group is:
```typescript
{
  title: 'Sprout video',
  url: '/upload/sprout'
}
```

The "Upload content" group items array (lines 71-85) currently has: Sprout video, Posterframe, Trello. Add Transcription after Trello.

### AppRouter Lazy Import Pattern

All routes use this pattern:
```typescript
const ComponentName = React.lazy(() =>
  import('@features/ModuleName').then((m) => ({ default: m.ExportedName }))
)
```

UploadOtter already follows this pattern (line 42-44):
```typescript
const UploadOtter = React.lazy(() =>
  import('@features/Upload').then((m) => ({ default: m.UploadOtter }))
)
```

No changes needed to the lazy import or route definition.

## Stale Mock Mapping (AppRouter.test.tsx)

Confidence: HIGH -- verified by cross-referencing AppRouter.tsx imports with test mocks.

| Line | Stale Mock Path | Current Barrel | Export Name | Action |
|------|----------------|----------------|-------------|--------|
| 20-22 | `@pages/AI/ExampleEmbeddings/ExampleEmbeddings` | `@features/AITools` | `ExampleEmbeddings` | Update mock |
| 24-26 | `@pages/AI/ScriptFormatter/ScriptFormatter` | `@features/AITools` | `ScriptFormatter` | Update mock |
| 41-43 | `@pages/BuildProject/BuildProject` | `@features/BuildProject` | `BuildProjectPage` | Update mock |
| 45-47 | `@pages/ConnectedApps` | N/A (route removed) | N/A | Delete mock |
| 49-51 | `@pages/IngestHistory` | N/A (route removed) | N/A | Delete mock |
| 53-55 | `@pages/Posterframe` | `@features/Upload` | `Posterframe` | Update mock |
| 57-59 | `@pages/Settings` | `@features/Settings` | `Settings` | Update mock |
| 61-63 | `@pages/UploadOtter` | `@features/Upload` | `UploadOtter` | Update mock |
| 65-67 | `@pages/UploadSprout` | `@features/Upload` | `UploadSprout` | Update mock |

Note: `@features/Auth` (line 28-31), `@features/Premiere` (line 33-35), `@features/Baker` (line 37-39), and `@features/Trello` (line 69-71) are already correct. The dashboard page mock (line 16-18) uses a relative path `../../src/app/dashboard/page` which is still valid.

**Mocks to update:** 7 (replace `@pages/*` with `@features/*` barrel paths)
**Mocks to delete:** 2 (ConnectedApps, IngestHistory -- routes no longer exist)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar icon for transcription | Custom SVG | Lucide `AudioLines` or `Mic` icon | Already using Lucide throughout; `AudioLines` best represents transcription |

## Common Pitfalls

### Pitfall 1: Test Import Path After useWindowState Move
**What goes wrong:** Test file at `tests/unit/hooks/useWindowState.test.ts` imports via relative path `../../../src/hooks/useWindowState`. After the move, this path breaks.
**How to avoid:** Update the import to `../../../src/shared/hooks/useWindowState`. Do NOT use the `@shared/hooks` alias -- test files use relative paths for this hook (since it's not barrel-exported).

### Pitfall 2: Stale Mocks Still "Pass"
**What goes wrong:** The 9 stale `@pages/*` mocks in AppRouter.test.tsx don't cause test failures because `@pages/*` alias was removed in Phase 9, so vitest registers a mock for a non-existent module that's never imported. Tests pass but with dead mock code.
**How to avoid:** After updating mocks, verify tests still pass. The updated mocks should actually intercept the lazy imports now, making the tests more meaningful.

### Pitfall 3: Forgetting to Delete src/hooks/ Directory
**What goes wrong:** After moving useWindowState.ts and deleting index.ts, the empty `src/hooks/` directory lingers.
**How to avoid:** Explicitly delete the directory as the final step. Git won't track empty directories, but the filesystem will keep it.

### Pitfall 4: Mock Export Shape Mismatch
**What goes wrong:** Old mocks use `default` exports (`default: () => ...`), but feature barrels use named exports. If the mock shape doesn't match what `React.lazy(...then(m => ({ default: m.ExportName })))` expects, tests break.
**How to avoid:** Mock the barrel with named exports matching what AppRouter destructures. Example: `vi.mock('@features/Upload', () => ({ UploadOtter: () => <div>...</div>, ... }))`.

## Sidebar Icon Recommendation

For the Transcription/Otter entry, recommend `AudioLines` from lucide-react:
- Visually represents audio/transcription
- Already in the lucide-react package used throughout the app
- Alternative: `Mic` (microphone) -- also reasonable but `AudioLines` is more distinctive

Import addition for app-sidebar.tsx:
```typescript
import {
  AudioLines,  // Add this
  Clapperboard,
  FileText,
  HardDriveUpload,
  Puzzle,
  Save,
  Settings
} from 'lucide-react'
```

Note: The `AudioLines` icon is NOT needed in the items array -- only parent nav groups use icons. The "Upload content" group already has `HardDriveUpload` as its icon. The individual items (Sprout, Posterframe, Trello, Transcription) are just `{ title, url }` objects without icons. So no icon import change is needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test` |

### Phase Requirements --> Test Map

This phase has no formal requirement IDs (tech debt). Success criteria are file-level:

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| SC-1 | useWindowState importable from @shared/hooks/useWindowState | unit | `bun run test -- --run tests/unit/hooks/useWindowState.test.ts` | Yes (needs import path update) |
| SC-2 | UploadOtter reachable via sidebar navigation at /upload/otter | manual-only | Visual check -- sidebar entry present | N/A |
| SC-3 | No broken re-exports in src/hooks/index.ts | smoke | `ls src/hooks/ 2>/dev/null` (directory should not exist) | N/A |
| SC-4 | No stale vi.mock in AppRouter test | unit | `bun run test -- --run tests/unit/AppRouter.test.tsx` | Yes (needs mock updates) |
| SC-5 | ThemeImport.tsx removed | smoke | `ls src/shared/ui/theme/ThemeImport.tsx 2>/dev/null` (should not exist) | N/A |

### Sampling Rate
- **Per task commit:** `bun run test -- --run tests/unit/hooks/useWindowState.test.ts tests/unit/AppRouter.test.tsx`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Only import path updates needed in existing test files.

## Sources

### Primary (HIGH confidence)
- Direct file inspection of all 10 affected files (see File Inventory above)
- Phase 9 decisions (09-01) for Tauri hook exclusion pattern
- Phase 11 verification confirming stale mocks are dead code

### Secondary (MEDIUM confidence)
- Lucide React icon names -- based on training data, lucide-react includes `AudioLines`

## Metadata

**Confidence breakdown:**
- File operations: HIGH -- all files inspected, paths verified
- Mock mapping: HIGH -- cross-referenced AppRouter.tsx imports with test mocks
- Sidebar pattern: HIGH -- existing pattern clearly visible in app-sidebar.tsx
- Icon choice: MEDIUM -- lucide-react icon name from training data

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal tech debt, no external dependencies)
