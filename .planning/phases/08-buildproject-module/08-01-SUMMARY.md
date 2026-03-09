---
phase: 08-buildproject-module
plan: 01
subsystem: ui
tags: [xstate, react, tauri, feature-module, barrel-exports, contract-tests]

# Dependency graph
requires:
  - phase: 07-baker-module
    provides: Baker deep module pattern (api.ts, barrel, contract tests)
  - phase: 02-shared-infrastructure
    provides: Shared hooks, store, types, utils
provides:
  - BuildProject deep feature module at src/features/BuildProject/
  - api.ts wrapping 14 I/O functions (invoke, listen, dialog, fs)
  - types.ts with shared types (FootageFile, BuildProjectContext, VideoInfoData)
  - Barrel exports (BuildProjectPage, useVideoInfoBlock, type-only FootageFile, VideoInfoData)
  - Contract tests validating barrel shape, api shape, no-bypass, XState colocation
  - Upload module owns useAutoFileSelection and useBackgroundFolder hooks
  - src/machines/ directory deleted, @machines/ path alias removed
affects: [09-app-shell]

# Tech tracking
tech-stack:
  added: []
  patterns: [deep-feature-module-with-api-boundary, xstate-machine-at-module-root]

key-files:
  created:
    - src/features/BuildProject/api.ts
    - src/features/BuildProject/types.ts
    - src/features/BuildProject/index.ts
    - src/features/BuildProject/buildProjectMachine.ts
    - src/features/BuildProject/BuildProjectPage.tsx
    - src/features/BuildProject/components/AddFootageStep.tsx
    - src/features/BuildProject/components/CreateProjectStep.tsx
    - src/features/BuildProject/components/ProjectConfigurationStep.tsx
    - src/features/BuildProject/components/ProjectFileList.tsx
    - src/features/BuildProject/components/ProjectInputs.tsx
    - src/features/BuildProject/components/FolderSelector.tsx
    - src/features/BuildProject/components/ProgressBar.tsx
    - src/features/BuildProject/components/SuccessSection.tsx
    - src/features/BuildProject/hooks/useBuildProjectMachine.ts
    - src/features/BuildProject/hooks/useCreateProjectWithMachine.ts
    - src/features/BuildProject/hooks/useProjectState.ts
    - src/features/BuildProject/hooks/useFileSelector.ts
    - src/features/BuildProject/hooks/useCameraAutoRemap.ts
    - src/features/BuildProject/hooks/useFileOperations.ts
    - src/features/BuildProject/hooks/useProjectValidation.ts
    - src/features/BuildProject/hooks/useProjectFolders.ts
    - src/features/BuildProject/hooks/usePostProjectCompletion.ts
    - src/features/BuildProject/hooks/useVideoInfoBlock.ts
    - src/features/BuildProject/__contracts__/buildproject.contract.test.ts
    - src/features/Upload/hooks/useAutoFileSelection.ts
    - src/features/Upload/hooks/useBackgroundFolder.ts
  modified:
    - src/AppRouter.tsx
    - src/features/Baker/hooks/useProjectBreadcrumbs.ts
    - src/features/Trello/hooks/useTrelloVideoInfo.ts
    - src/features/Trello/hooks/useUploadTrello.ts
    - src/features/Trello/components/CardDetailsDialog.tsx
    - src/utils/trello/CardDetailsAccordion.tsx
    - src/utils/trello/VideoInfoAccordionItem.tsx
    - src/features/Upload/components/Posterframe.tsx
    - src/hooks/index.ts
    - tsconfig.json
    - tests/unit/hooks/useFileOperations.test.tsx
    - tests/unit/hooks/useProjectFolders.test.tsx
    - tests/unit/hooks/useProjectValidation.test.tsx
    - tests/unit/hooks/useTrelloVideoInfo.test.tsx
    - tests/unit/hooks/useProjectBreadcrumbs.test.tsx
    - tests/unit/components/CreateProjectStep.test.tsx
    - tests/unit/pages/BuildProject/ProjectFileList.test.tsx

key-decisions:
  - "XState machine colocated at module root (not hooks/ or sub-directory) for visibility"
  - "useAutoFileSelection and useBackgroundFolder moved to Upload module (their only consumer is Posterframe)"
  - "useBackgroundFolder rewired to use Upload api.ts listDirectory instead of direct readDir"
  - "Existing unit tests updated to mock api.ts layer instead of direct Tauri plugins"

patterns-established:
  - "Deep feature module: api.ts I/O boundary + types.ts + barrel + contract tests"
  - "XState machine at module root (parallel to api.ts and types.ts)"

requirements-completed: [BLDP-01, BLDP-02, BLDP-03, BLDP-04]

# Metrics
duration: 14min
completed: 2026-03-09
---

# Phase 8 Plan 01: BuildProject Module Migration Summary

**BuildProject migrated to deep feature module with 14-function api.ts I/O boundary, XState machine at root, and 31 contract tests**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-09T21:46:19Z
- **Completed:** 2026-03-09T22:00:34Z
- **Tasks:** 2
- **Files modified:** 44

## Accomplishments
- BuildProject is fully self-contained at src/features/BuildProject/ with api.ts wrapping all 14 I/O functions
- All external consumers (AppRouter, Baker, Trello, utils/trello) updated to import from @features/BuildProject barrel
- useAutoFileSelection and useBackgroundFolder moved to Upload module where Posterframe (their only consumer) lives
- src/machines/ directory deleted and @machines/ tsconfig alias removed
- 31 contract tests validate barrel shape (2 exports), api shape (14 functions), no-bypass, and XState colocation
- 2158 tests pass across 130 test files with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BuildProject module structure, api.ts, types.ts, move all files, wire barrel, update all consumers** - `992d856` (feat)
2. **Task 2: Write contract tests for BuildProject module** - `4cfb8d4` (test)

## Files Created/Modified
- `src/features/BuildProject/api.ts` - I/O boundary wrapping 14 functions (invoke, listen, dialog, fs)
- `src/features/BuildProject/types.ts` - Shared types (FootageFile, BuildProjectContext, VideoInfoData, etc.)
- `src/features/BuildProject/index.ts` - Barrel exporting BuildProjectPage, useVideoInfoBlock, type-only exports
- `src/features/BuildProject/buildProjectMachine.ts` - XState machine at module root
- `src/features/BuildProject/BuildProjectPage.tsx` - Main page component (moved from pages/)
- `src/features/BuildProject/components/*.tsx` - 8 component files (moved from pages/BuildProject/)
- `src/features/BuildProject/hooks/*.ts` - 10 hook files (moved from src/hooks/)
- `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` - 31 contract tests
- `src/features/Upload/hooks/useAutoFileSelection.ts` - Moved to Upload module
- `src/features/Upload/hooks/useBackgroundFolder.ts` - Moved to Upload module, uses listDirectory from Upload api.ts

## Decisions Made
- XState machine colocated at module root (not hooks/) for visibility alongside api.ts and types.ts
- useAutoFileSelection and useBackgroundFolder moved to Upload module since Posterframe is their only consumer
- useBackgroundFolder rewired to use Upload api.ts `listDirectory` instead of direct `readDir` import
- Existing unit tests updated to mock api.ts layer instead of direct Tauri plugin imports (6 test files updated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 6 existing test files referencing old import paths**
- **Found during:** Task 1 (verification step)
- **Issue:** Test files in tests/unit/ imported hooks from old `@/hooks/` and `@/pages/` paths that no longer exist
- **Fix:** Updated import paths to use `@features/BuildProject/` and changed mocks from direct Tauri plugin mocks to api.ts layer mocks
- **Files modified:** tests/unit/hooks/useFileOperations.test.tsx, tests/unit/hooks/useProjectFolders.test.tsx, tests/unit/hooks/useProjectValidation.test.tsx, tests/unit/hooks/useTrelloVideoInfo.test.tsx, tests/unit/hooks/useProjectBreadcrumbs.test.tsx, tests/unit/components/CreateProjectStep.test.tsx, tests/unit/pages/BuildProject/ProjectFileList.test.tsx
- **Verification:** All 2158 tests pass
- **Committed in:** 992d856 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test file updates were necessary to maintain full test suite. No scope creep.

## Issues Encountered
- Pre-existing test failure in Baker VideoLinksManager.test.tsx (33 tests) - not related to this migration, mock setup issue predates these changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All feature modules are now migrated to deep module structure
- Ready for Phase 9 (app shell) - all modules have barrel exports, api.ts boundaries, and contract tests
- No blockers or concerns

---
*Phase: 08-buildproject-module*
*Completed: 2026-03-09*
