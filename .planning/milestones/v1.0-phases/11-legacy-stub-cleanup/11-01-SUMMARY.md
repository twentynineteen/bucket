---
phase: 11-legacy-stub-cleanup
plan: 01
subsystem: cleanup
tags: [dead-code, legacy, refactor, routes]

# Dependency graph
requires:
  - phase: 10-api-bypass-fixes
    provides: All feature modules with clean api.ts boundaries
provides:
  - Clean src/ tree with zero orphaned legacy files
  - AppRouter.tsx with only active @features/* barrel routes
  - Closed stale ESLint boundaries todo
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/AppRouter.tsx

key-decisions:
  - "Deleted src/components/lib/utils.ts as additional orphan (zero consumers, canonical cn() in @shared/utils)"
  - "Deleted tests/unit/utils/breadcrumbsValidation.test.ts (tested deleted legacy file with no canonical counterpart)"
  - "Removed src/services/ parent directory (empty after ai/ subdirectory deletion)"

patterns-established: []

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 11 Plan 01: Legacy Stub Cleanup Summary

**Deleted 16 orphaned legacy files, removed IngestHistory stub route, and cleaned 6 empty directories from src/**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T14:12:56Z
- **Completed:** 2026-03-10T14:16:02Z
- **Tasks:** 2
- **Files modified:** 19 (16 deleted, 1 modified, 1 moved, 1 test deleted)

## Accomplishments
- Deleted 15 orphaned legacy files from src/utils/, src/components/, src/services/ai/, src/types/, src/pages/ (12 legacy copies + 2 stub pages + 1 additional orphan)
- Removed IngestHistory lazy import and route declaration from AppRouter.tsx
- Removed 6 empty directories: src/utils/, src/components/, src/services/ai/, src/services/, src/types/, src/pages/
- Closed stale ESLint boundaries todo (moved from pending/ to done/)
- Deleted orphaned test file for deleted legacy module
- Verified: 130 test files pass (2152 tests), eslint:fix reports 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete orphaned files, remove stub route, clean empty directories** - `e3a1028` (chore)
2. **Task 2: Close stale todo and run verification suite** - `c797215` (chore)

## Files Created/Modified
- `src/AppRouter.tsx` - Removed IngestHistory lazy import and route; all routes now use @features/* barrels
- `src/utils/breadcrumbsValidation.ts` - Deleted (legacy copy)
- `src/utils/breadcrumbsMigration.ts` - Deleted (legacy copy)
- `src/utils/breadcrumbsComparison.ts` - Deleted (legacy copy)
- `src/utils/updateManifest.ts` - Deleted (legacy copy)
- `src/components/BreadcrumbsViewer.tsx` - Deleted (legacy copy)
- `src/components/ProjectChangeDetailView.tsx` - Deleted (legacy copy)
- `src/components/lib/utils.ts` - Deleted (legacy orphan, zero consumers)
- `src/services/ai/modelFactory.ts` - Deleted (legacy copy)
- `src/services/ai/providerConfig.ts` - Deleted (legacy copy)
- `src/services/ai/types.ts` - Deleted (legacy copy)
- `src/types/exampleEmbeddings.ts` - Deleted (legacy copy)
- `src/types/plugins.ts` - Deleted (legacy copy)
- `src/types/scriptFormatter.ts` - Deleted (legacy copy)
- `src/pages/IngestHistory.tsx` - Deleted (stub page)
- `src/pages/FolderTreeNavigator.tsx` - Deleted (orphaned page)
- `tests/unit/utils/breadcrumbsValidation.test.ts` - Deleted (tested deleted legacy module)
- `.planning/todos/done/2026-03-10-fix-eslint-boundaries-no-unknown-files-warning-on-lazy-routes.md` - Moved from pending/

## Decisions Made
- Deleted src/components/lib/utils.ts as an additional orphan not listed in the plan (zero consumers confirmed via grep, canonical cn() lives in @shared/utils)
- Deleted tests/unit/utils/breadcrumbsValidation.test.ts because it tested only the deleted legacy file with no canonical counterpart remaining
- Removed src/services/ parent directory since it was empty after ai/ subdirectory deletion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deleted additional orphan src/components/lib/utils.ts**
- **Found during:** Task 1 (directory cleanup)
- **Issue:** src/components/ directory contained lib/utils.ts with zero consumers, preventing clean directory removal
- **Fix:** Verified zero import consumers via grep, deleted the file
- **Files modified:** src/components/lib/utils.ts
- **Verification:** Directory clean removal succeeded
- **Committed in:** e3a1028

**2. [Rule 1 - Bug] Deleted stale test file tests/unit/utils/breadcrumbsValidation.test.ts**
- **Found during:** Task 2 (verification suite)
- **Issue:** Test file imported from deleted src/utils/breadcrumbsValidation.ts, causing test suite failure
- **Fix:** Deleted the stale test file (tested functions with no canonical counterpart)
- **Files modified:** tests/unit/utils/breadcrumbsValidation.test.ts
- **Verification:** bun run test passes (130 files, 2152 tests)
- **Committed in:** c797215

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for clean directory removal and passing test suite. No scope creep.

## Issues Encountered
None - all deletions were clean with zero consumer dependencies as predicted by RESEARCH.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 plan 01 is the final cleanup plan -- the deep module refactor (Phases 1-10) is complete
- src/ tree is clean: all code lives in src/features/*/, src/shared/*/, and src/app/
- All 130 test files pass, ESLint reports 0 errors

---
*Phase: 11-legacy-stub-cleanup*
*Completed: 2026-03-10*
