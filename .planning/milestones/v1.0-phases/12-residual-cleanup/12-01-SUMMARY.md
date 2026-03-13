---
phase: 12-residual-cleanup
plan: 01
subsystem: ui
tags: [hooks, sidebar, testing, cleanup]

# Dependency graph
requires:
  - phase: 09-app-shell
    provides: Feature barrel exports and React.lazy route loading
  - phase: 11-legacy-stub-cleanup
    provides: Clean codebase baseline
provides:
  - useWindowState hook in canonical shared location
  - Complete sidebar navigation with Transcription entry
  - Modernized AppRouter test mocks using feature barrels
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - src/shared/hooks/useWindowState.ts
  modified:
    - src/App.tsx
    - src/shared/hooks/index.ts
    - src/shared/ui/layout/app-sidebar.tsx
    - tests/unit/hooks/useWindowState.test.ts
    - tests/unit/AppRouter.test.tsx
    - tests/integration/scriptFormatter.test.ts

key-decisions:
  - "useWindowState excluded from barrel (Tauri runtime dependency) matching existing convention for useMacOSEffects etc."

patterns-established: []

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 12 Plan 01: Residual Cleanup Summary

**Migrated useWindowState to shared hooks, deleted orphan src/hooks/ directory and ThemeImport stub, added Transcription sidebar entry, and replaced all @pages/* test mocks with @features/* barrels**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T15:19:02Z
- **Completed:** 2026-03-10T15:22:58Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- useWindowState hook migrated from orphan src/hooks/ to src/shared/hooks/ with barrel exclusion comment
- Deleted src/hooks/ directory (broken useAppendVideoInfo re-export), ThemeImport.tsx placeholder stub
- Added Transcription sidebar entry under Upload content group at /upload/otter
- All AppRouter test mocks now reference @features/* barrels -- zero @pages/* references remain in tests/

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate useWindowState, delete orphans, remove ThemeImport** - `1ebbe15` (refactor)
2. **Task 2: Add UploadOtter sidebar entry and modernize AppRouter test mocks** - `90ce113` (feat)

## Files Created/Modified
- `src/shared/hooks/useWindowState.ts` - Window state persistence hook in canonical shared location
- `src/shared/hooks/index.ts` - Updated barrel exclusion comment to include useWindowState
- `src/App.tsx` - Import path updated to @shared/hooks/useWindowState
- `src/shared/ui/layout/app-sidebar.tsx` - Added Transcription entry under Upload content group
- `tests/unit/hooks/useWindowState.test.ts` - Import path updated to new location
- `tests/unit/AppRouter.test.tsx` - All @pages/* mocks replaced with @features/* barrel mocks
- `tests/integration/scriptFormatter.test.ts` - Commented-out @pages/ import updated

## Decisions Made
- useWindowState excluded from barrel exports (consistent with existing Tauri-dependent hook exclusion convention)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale @pages/ reference in integration test**
- **Found during:** Task 2 (AppRouter test modernization)
- **Issue:** tests/integration/scriptFormatter.test.ts had a commented-out `@pages/AI/ScriptFormatter/ScriptFormatter` import that would fail the verification grep
- **Fix:** Updated commented import to use `@features/AITools`
- **Files modified:** tests/integration/scriptFormatter.test.ts
- **Verification:** `grep -r '@pages/' tests/` returns zero matches
- **Committed in:** 90ce113 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor fix to ensure verification criteria pass. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v1.0 milestone audit items resolved
- Codebase is clean: no orphaned files, no broken imports, complete sidebar navigation
- Full test suite passes (2152 tests across 130 files)

---
*Phase: 12-residual-cleanup*
*Completed: 2026-03-10*
