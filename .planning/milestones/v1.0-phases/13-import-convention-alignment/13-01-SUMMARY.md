---
phase: 13-import-convention-alignment
plan: 01
subsystem: infra
tags: [typescript, imports, barrel-exports, refactoring, eslint]

# Dependency graph
requires:
  - phase: 02-shared-infrastructure
    provides: barrel export convention and shared module structure
provides:
  - Zero sub-path imports for @shared/utils, @shared/types, @shared/constants in features
  - Intra-module barrel bypass fix for Trello useAppendVideoInfo
  - Documented @shared/lib barrel exclusion (Tauri dependency poison)
  - Bulk import rewrite script at scripts/fix-imports.py
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Poisoned barrel pattern: @shared/lib must use sub-path imports due to query-client-config.ts Tauri dependency"
    - "Incomplete logger mock pattern: all vi.mock(@shared/utils/logger) must include createNamespacedLogger"

key-files:
  created:
    - scripts/fix-imports.py
  modified:
    - src/features/**/*.ts (84 feature files)
    - src/shared/**/*.ts (22 shared files)
    - src/App.tsx
    - src/AppRouter.tsx
    - src/index.tsx

key-decisions:
  - "@shared/lib barrel excluded from conversion -- query-client-config.ts imports @tauri-apps/plugin-store which crashes test environments"
  - "4 test mock files updated to include createNamespacedLogger (barrel import now triggers breadcrumbs/debug.ts loading)"

patterns-established:
  - "Poisoned barrel: @shared/lib barrel must NOT be used anywhere because query-client-config.ts pulls in Tauri runtime dependencies"
  - "All @shared/utils/logger mocks must export both logger and createNamespacedLogger to handle transitive barrel loading"

requirements-completed: [SHRD-06, SHRD-07, SHRD-08, TREL-01]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 13 Plan 01: Import Convention Alignment Summary

**Bulk barrel import migration for @shared/utils, @shared/types, @shared/constants across 108 files with @shared/lib excluded due to Tauri poisoned barrel**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T16:01:25Z
- **Completed:** 2026-03-10T16:14:19Z
- **Tasks:** 2
- **Files modified:** 138

## Accomplishments
- Converted 190 sub-path imports across 108 files to barrel imports (@shared/utils, @shared/types, @shared/constants)
- Merged 24 duplicate import statements from same barrel into single lines
- Fixed Trello intra-module barrel bypass (useAppendVideoInfo.ts @features/Trello/api -> ../api)
- Discovered and documented @shared/lib barrel as poisoned (Tauri dependency prevents test-safe barrel usage)
- All 2152 tests passing, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and run bulk import rewrite script** - `101cbd1` (feat)
2. **Task 1 fix: Exclude @shared/lib barrel + fix test mocks** - `eade2b8` (fix)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `scripts/fix-imports.py` - Bulk import rewrite script with barrel map, exceptions, self-import exclusion, and poisoned barrel handling
- `src/features/**/*.ts` - 84 feature files: sub-path imports converted to barrel imports for utils, types, constants
- `src/shared/**/*.ts` - 22 shared files: cross-barrel imports converted (excluding self-imports and @shared/lib)
- `src/App.tsx`, `src/AppRouter.tsx`, `src/index.tsx` - App-level sub-path imports converted
- `src/features/Trello/hooks/useAppendVideoInfo.ts` - Intra-module bypass fixed to relative import
- `tests/unit/components/FolderSelector.test.tsx` - Added createNamespacedLogger to logger mock
- `tests/unit/components/VideoLinkCard.test.tsx` - Added createNamespacedLogger to logger mock
- `src/features/Premiere/__contracts__/premiere.contract.test.ts` - Added createNamespacedLogger to logger mock
- `src/shared/services/__contracts__/services.contract.test.ts` - Added createNamespacedLogger to logger mock

## Decisions Made
- **@shared/lib barrel excluded from conversion:** The @shared/lib barrel re-exports from query-client-config.ts which imports @tauri-apps/plugin-store. This Tauri runtime dependency crashes all test environments when the barrel is loaded. All @shared/lib imports remain as sub-path imports (e.g., @shared/lib/query-keys, @shared/lib/query-utils). This matches the existing pattern established for lib contract tests in Phase 2.
- **SHRD-04 partially completed:** @shared/lib sub-path imports remain by necessity (poisoned barrel). The 3 other shared barrels (utils, types, constants) are fully converted.
- **Test mocks updated:** 4 test files had incomplete @shared/utils/logger mocks that didn't export createNamespacedLogger. Previously this didn't matter because sub-path imports to @shared/utils/logger didn't trigger loading the full utils barrel. With barrel imports, the breadcrumbs/debug.ts module is transitively loaded, requiring the mock to be complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @shared/lib barrel causes test environment crashes**
- **Found during:** Task 2 (verification)
- **Issue:** Converting @shared/lib sub-path imports to barrel imports caused 50 test files to fail because @shared/lib/index.ts re-exports from query-client-config.ts which imports @tauri-apps/plugin-store (unavailable in test environment)
- **Fix:** Reverted all @shared/lib barrel imports back to sub-path imports across all files. Updated fix-imports.py to exclude @shared/lib from barrel map.
- **Files modified:** 15 feature files, 3 shared files, scripts/fix-imports.py
- **Verification:** All 2152 tests pass after revert
- **Committed in:** eade2b8

**2. [Rule 1 - Bug] Incomplete logger mocks crash after barrel import conversion**
- **Found during:** Task 2 (verification)
- **Issue:** 4 test files mocked @shared/utils/logger without exporting createNamespacedLogger. With barrel imports, the utils barrel loads breadcrumbs/debug.ts which needs createNamespacedLogger from the mocked logger module.
- **Fix:** Added createNamespacedLogger mock function to all 4 affected test files
- **Files modified:** FolderSelector.test.tsx, VideoLinkCard.test.tsx, premiere.contract.test.ts, services.contract.test.ts
- **Verification:** All 4 tests pass
- **Committed in:** eade2b8

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** SHRD-04 (@shared/lib barrel enforcement) cannot be completed as designed due to Tauri dependency poison. The other 4 requirements are fully met. No scope creep.

## Issues Encountered
- Failed `git stash pop` of old stashes caused merge conflicts in working directory; resolved by stashing artifacts and continuing from clean commit state.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import convention alignment is as complete as possible given the @shared/lib barrel constraint
- Future consideration: if query-client-config.ts is refactored to lazy-load Tauri dependencies, @shared/lib barrel could become safe for test environments
- Phase 14 (if planned) can proceed without blockers

---
*Phase: 13-import-convention-alignment*
*Completed: 2026-03-10*
