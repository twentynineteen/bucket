---
phase: 14-dead-export-removal
plan: 01
subsystem: testing
tags: [barrel-exports, dead-code, contract-tests, cleanup]

# Dependency graph
requires:
  - phase: 09-app-shell-final
    provides: barrel exports and contract tests
provides:
  - Cleaned barrel surfaces with only actively-consumed exports
  - Updated contract tests matching reduced export counts
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead export removal: remove barrel re-export, keep internal source if still used internally"

key-files:
  created: []
  modified:
    - src/features/Premiere/index.ts
    - src/features/AITools/index.ts
    - src/features/Trello/index.ts
    - src/shared/services/index.ts
    - src/features/Premiere/__contracts__/premiere.contract.test.ts
    - src/features/Trello/__contracts__/trello.contract.test.ts
    - src/shared/services/__contracts__/services.contract.test.ts

key-decisions:
  - "Deleted stale unit test files for removed source files (usePremiereIntegration.test.tsx, ProgressTracker.test.ts, UserFeedbackService.test.ts)"

patterns-established:
  - "Dead export removal pattern: verify zero external consumers via grep, remove barrel line, delete source only if zero internal consumers too"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 14 Plan 01: Dead Export Removal Summary

**Removed 7 dead barrel exports, deleted 3 unused source files and 3 stale test files, updated 3 contract tests to match reduced surfaces**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T20:31:11Z
- **Completed:** 2026-03-10T20:35:29Z
- **Tasks:** 2
- **Files modified:** 13 (7 source + 3 contract tests modified, 3 stale tests deleted)

## Accomplishments
- Premiere barrel reduced from 3 exports to 1 (PremierePluginManager only)
- AITools barrel reduced from 6 exports to 5 (removed SimilarExample type re-export)
- Trello barrel reduced from 26 exports to 25 (removed createDefaultSproutUploadResponse)
- Services barrel reduced from 12 exports to 5 (removed ProgressTracker and UserFeedbackService entirely)
- Deleted 3 source files: usePremiereIntegration.ts, ProgressTracker.ts, UserFeedbackService.ts
- Deleted 3 stale unit test files that tested deleted source
- All 127 test files pass (2064 tests), build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dead barrel exports and delete unused source files** - `9a39b63` (chore)
2. **Task 2: Update contract tests to match reduced barrel surfaces** - `6ac3848` (test)

## Files Created/Modified
- `src/features/Premiere/index.ts` - Reduced to 1 export (PremierePluginManager)
- `src/features/AITools/index.ts` - Reduced to 5 runtime exports (removed SimilarExample type)
- `src/features/Trello/index.ts` - Reduced to 25 exports (removed createDefaultSproutUploadResponse)
- `src/shared/services/index.ts` - Reduced to cache-invalidation exports only (5 exports)
- `src/features/Premiere/__contracts__/premiere.contract.test.ts` - Expects 1 export, removed behavioral tests
- `src/features/Trello/__contracts__/trello.contract.test.ts` - Expects 25 exports, removed factory function test
- `src/shared/services/__contracts__/services.contract.test.ts` - Removed ProgressTracker/UserFeedbackService tests
- `src/features/Premiere/hooks/usePremiereIntegration.ts` - DELETED (zero consumers)
- `src/shared/services/ProgressTracker.ts` - DELETED (only consumer was UserFeedbackService)
- `src/shared/services/UserFeedbackService.ts` - DELETED (zero consumers)
- `tests/unit/hooks/usePremiereIntegration.test.tsx` - DELETED (stale test for deleted source)
- `tests/unit/services/ProgressTracker.test.ts` - DELETED (stale test for deleted source)
- `tests/unit/services/UserFeedbackService.test.ts` - DELETED (stale test for deleted source)

## Decisions Made
- Deleted stale unit test files alongside deleted source files (Rule 1 - tests for deleted code are broken tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deleted 3 stale unit test files**
- **Found during:** Task 2
- **Issue:** Unit tests in tests/unit/ imported deleted source files directly, causing 70 test failures
- **Fix:** Deleted usePremiereIntegration.test.tsx, ProgressTracker.test.ts, UserFeedbackService.test.ts
- **Files modified:** 3 files deleted
- **Verification:** Full test suite passes (127 files, 2064 tests)
- **Committed in:** 6ac3848 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary cleanup -- stale tests for deleted source files cannot pass. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All dead exports removed, barrel surfaces clean
- No further phases planned

---
*Phase: 14-dead-export-removal*
*Completed: 2026-03-10*
