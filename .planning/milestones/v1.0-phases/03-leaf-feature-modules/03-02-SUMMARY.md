---
phase: 03-leaf-feature-modules
plan: 02
subsystem: ui
tags: [trello, react-query, tauri, barrel-exports, feature-module]

# Dependency graph
requires:
  - phase: 02-shared-infrastructure
    provides: shared hooks, types, utilities, query-keys
provides:
  - Self-contained Trello feature module at src/features/Trello/
  - Single I/O boundary via api.ts for all Trello external calls
  - Barrel export with 26 named exports (10 components, 15 hooks, 1 factory)
  - Contract tests locking down public API shape and behavior
affects: [04-composite-features, Baker, BuildProject, Settings]

# Tech tracking
tech-stack:
  added: []
  patterns: [deep-feature-module, single-io-boundary, barrel-only-imports, contract-tests]

key-files:
  created:
    - src/features/Trello/index.ts
    - src/features/Trello/api.ts
    - src/features/Trello/types.ts
    - src/features/Trello/__contracts__/trello.contract.test.ts
  modified:
    - src/AppRouter.tsx
    - src/pages/Settings.tsx
    - src/pages/Baker/Baker.tsx
    - src/components/Baker/VideoLinksManager.tsx
    - src/pages/BuildProject/SuccessSection.tsx
    - src/hooks/useAppendVideoInfo.ts
    - src/hooks/useAppendBreadcrumbs.ts

key-decisions:
  - "All invoke(), fetch(), readTextFile/writeTextFile calls consolidated into api.ts as single I/O boundary"
  - "Internal utilities (groupCardsByList, validateBoardAccess, TrelloCardList, TrelloCardMembers) kept in internal/ directory, not exported from barrel"
  - "useBakerTrelloIntegration owned by Trello module per CONTEXT.md locked decision"
  - "Types merged from TrelloCards.tsx and UploadTrelloTypes.ts into single types.ts"

patterns-established:
  - "Deep feature module: api.ts wraps all external I/O, barrel exports named-only, internal/ directory for non-public code"
  - "Contract tests: shape tests verify exact export count and types, behavioral tests verify hook return shapes via renderHook"

requirements-completed: [TREL-01, TREL-02, TREL-03]

# Metrics
duration: 26min
completed: 2026-03-09
---

# Phase 03 Plan 02: Trello Module Summary

**Migrated 30+ files into self-contained Trello feature module with api.ts I/O boundary, barrel exports, and 35 contract tests**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-09T11:04:58Z
- **Completed:** 2026-03-09T11:31:47Z
- **Tasks:** 2
- **Files modified:** 64

## Accomplishments
- Created self-contained Trello module at src/features/Trello/ with 15 hooks, 10 components, merged types
- Established api.ts as single I/O boundary wrapping all invoke(), fetch(), and file plugin calls
- 35 contract tests (29 shape + 6 behavioral) locking down the public API
- All 129 test files and 2093 tests pass after migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Trello deep feature module** - `8d724de` (feat)
2. **Task 2: Add contract tests** - `bbef655` (test)
3. **Fix: Update test imports for migration** - `f32b463` (fix)

## Files Created/Modified
- `src/features/Trello/index.ts` - Barrel export with 26 named exports
- `src/features/Trello/api.ts` - Single I/O boundary (invoke, fetch, file plugins, dialogs)
- `src/features/Trello/types.ts` - Merged types from TrelloCards.tsx and UploadTrelloTypes.ts
- `src/features/Trello/__contracts__/trello.contract.test.ts` - 35 contract tests
- `src/features/Trello/hooks/` - 15 migrated hooks with updated imports
- `src/features/Trello/components/` - 10 migrated components
- `src/features/Trello/internal/` - 4 internal files (not barrel-exported)

## Decisions Made
- Consolidated all external I/O into api.ts (invoke, fetch, readTextFile, writeTextFile, dialog wrappers)
- Internal utilities kept in internal/ directory, not exported from barrel
- useBakerTrelloIntegration owned by Trello module (CONTEXT.md locked decision)
- Cross-module dynamic imports (useAppendBreadcrumbs) preserved for later resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 16 test files with broken imports after migration**
- **Found during:** Task 2 verification (full test suite run)
- **Issue:** Test files in tests/ directory referenced old import paths (@/hooks/useTrello*, @/utils/TrelloCards, @components/Baker/*)
- **Fix:** Updated all test imports to use @features/Trello barrel, fixed mock paths, added createNamespacedLogger to logger mocks, fixed fetchBoardCards/fetchBoardLists argument order
- **Files modified:** 16 test files across tests/unit/ and tests/component/
- **Verification:** All 129 test files pass (2093 tests)
- **Committed in:** f32b463

---

**Total deviations:** 1 auto-fixed (1 bug - missed test consumer updates)
**Impact on plan:** Essential fix for test suite integrity. No scope creep.

## Issues Encountered
- Several consumer files outside src/ (test files) were missed in initial migration sweep because they import from different path aliases (@/, @hooks/, @components/)
- Baker wrapper functions (bakerGetTrelloCards, etc.) had to be added to api.ts because useBreadcrumbsTrelloCards and useVideoLinksManager had direct invoke() calls

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trello module fully self-contained with stable public API
- Contract tests will catch any accidental export changes
- Ready for composite feature integration in Phase 04

---
*Phase: 03-leaf-feature-modules*
*Completed: 2026-03-09*

## Self-Check: PASSED
- All 7 key files verified present
- All 3 commits verified in git log
