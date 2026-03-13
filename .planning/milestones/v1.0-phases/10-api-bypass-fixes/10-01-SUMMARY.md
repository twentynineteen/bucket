---
phase: 10-api-bypass-fixes
plan: 01
subsystem: api
tags: [tauri, plugin-opener, plugin-shell, api-boundary, contract-tests]

# Dependency graph
requires:
  - phase: 07-baker-module
    provides: Baker api.ts with openExternalUrl wrapper
  - phase: 03-leaf-feature-modules
    provides: Trello api.ts I/O boundary pattern
provides:
  - Zero bypass violations in Baker and Trello modules
  - Trello api.ts openExternalUrl wrapper using plugin-opener
  - BreadcrumbsViewerProps, DetailedFieldChange, ProjectChangeDetail exported from Baker barrel
  - Comprehensive recursive no-bypass contract tests for both modules
affects: [10-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [fs.readdirSync recursive no-bypass test pattern replaces grep/execSync]

key-files:
  created: []
  modified:
    - src/features/Baker/internal/NormalView.tsx
    - src/features/Baker/index.ts
    - src/features/Trello/api.ts
    - src/features/Trello/hooks/useTrelloActions.ts
    - src/features/Trello/hooks/useUploadTrello.ts
    - src/features/Trello/components/TrelloIntegrationModal.tsx
    - src/features/Trello/components/TrelloCardItem.tsx
    - src/features/Baker/__contracts__/baker.contract.test.ts
    - src/features/Trello/__contracts__/trello.contract.test.ts
    - tests/unit/hooks/useTrelloActions.test.tsx

key-decisions:
  - "Consolidated URL opening to plugin-opener (not plugin-shell) for all Trello api.ts calls"
  - "Added DetailedFieldChange and ProjectChangeDetail to Baker barrel (consumed externally but missing)"
  - "Replaced grep/execSync no-bypass tests with fs.readdirSync recursive pattern for comprehensive subdirectory scanning"

patterns-established:
  - "Recursive no-bypass contract test: getFilesRecursive scans all subdirectories including internal/"

requirements-completed: [BAKR-01, BAKR-02, BAKR-03]

# Metrics
duration: 6min
completed: 2026-03-10
---

# Phase 10 Plan 01: Baker/Trello API Bypass Fixes Summary

**Eliminated 5 direct @tauri-apps plugin imports in Baker/Trello, added missing barrel exports, and upgraded no-bypass contract tests to recursive fs pattern**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T13:03:12Z
- **Completed:** 2026-03-10T13:09:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Zero direct @tauri-apps imports remaining in Baker/internal/ and all Trello consumer files
- Trello api.ts now exports openExternalUrl wrapping plugin-opener for URL opening
- Baker barrel exports BreadcrumbsViewerProps, DetailedFieldChange, and ProjectChangeDetail types
- Both Baker and Trello contract tests use comprehensive recursive no-bypass pattern (no more grep/execSync)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix bypass violations and add Baker barrel export** - `c9e3eff` (fix)
2. **Task 2: Update Baker and Trello contract tests to comprehensive no-bypass pattern** - `b8ce7ec` (test)
3. **Deviation: Update useTrelloActions unit test** - `672142c` (fix)

## Files Created/Modified
- `src/features/Baker/internal/NormalView.tsx` - Replaced plugin-shell import with api.ts openExternalUrl
- `src/features/Baker/index.ts` - Added BreadcrumbsViewerProps, DetailedFieldChange, ProjectChangeDetail exports
- `src/features/Trello/api.ts` - Added openExternalUrl wrapper using plugin-opener
- `src/features/Trello/hooks/useTrelloActions.ts` - Replaced plugin-shell with api.ts import
- `src/features/Trello/hooks/useUploadTrello.ts` - Replaced plugin-shell with api.ts import
- `src/features/Trello/components/TrelloIntegrationModal.tsx` - Replaced plugin-shell with api.ts import
- `src/features/Trello/components/TrelloCardItem.tsx` - Replaced plugin-opener with api.ts import
- `src/features/Baker/__contracts__/baker.contract.test.ts` - Comprehensive recursive no-bypass pattern
- `src/features/Trello/__contracts__/trello.contract.test.ts` - Added no-bypass section with recursive pattern
- `tests/unit/hooks/useTrelloActions.test.tsx` - Updated mock from plugin-shell to api.ts

## Decisions Made
- Consolidated URL opening to plugin-opener (not plugin-shell) for all Trello api.ts calls
- Added DetailedFieldChange and ProjectChangeDetail to Baker barrel -- consumed externally but were missing from barrel exports
- Replaced grep/execSync no-bypass tests with fs.readdirSync recursive pattern for comprehensive subdirectory scanning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added DetailedFieldChange and ProjectChangeDetail to Baker barrel**
- **Found during:** Task 1 (audit step 5)
- **Issue:** Two types consumed externally (src/components/ProjectChangeDetailView.tsx) were not exported from Baker barrel
- **Fix:** Added both type exports with JSDoc to Baker/index.ts
- **Files modified:** src/features/Baker/index.ts
- **Verification:** ESLint passes, types resolve correctly
- **Committed in:** c9e3eff (Task 1 commit)

**2. [Rule 1 - Bug] Updated useTrelloActions unit test mocks**
- **Found during:** Task 2 verification (full test suite run)
- **Issue:** Unit test in tests/unit/hooks/useTrelloActions.test.tsx was mocking @tauri-apps/plugin-shell directly -- broke after hook was updated to use api.ts
- **Fix:** Updated test to mock @features/Trello/api openExternalUrl instead
- **Files modified:** tests/unit/hooks/useTrelloActions.test.tsx
- **Verification:** All 12 tests pass, full suite 2191/2191 green
- **Committed in:** 672142c

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Baker and Trello modules fully compliant with api.ts boundary pattern
- Plan 10-02 can proceed with remaining modules (Upload, AITools, Settings, BuildProject, App Shell)

## Self-Check: PASSED

All 10 modified files exist on disk. All 3 commits verified in git log (c9e3eff, b8ce7ec, 672142c). Full test suite: 131 files, 2191 tests passing.

---
*Phase: 10-api-bypass-fixes*
*Completed: 2026-03-10*
