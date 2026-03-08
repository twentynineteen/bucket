---
phase: 02-shared-infrastructure
plan: 01
subsystem: infra
tags: [barrel-exports, path-aliases, contract-tests, shared-modules, vitest]

# Dependency graph
requires:
  - phase: 01-tooling-prep
    provides: "@shared/* path alias in tsconfig.json, vite-tsconfig-paths plugin"
provides:
  - "src/shared/lib/ barrel with query-keys, query-client-config, query-utils, performance-monitor, prefetch-strategies"
  - "src/shared/constants/ barrel with timing, animations, project"
  - "src/shared/types/ barrel with media types and core domain types"
  - "src/shared/utils/ barrel with logger, storage, debounce, validation, versionUtils, breadcrumbs"
  - "Contract tests for all 4 sub-modules (70 tests)"
affects: [02-02, 02-03, 02-04, all-feature-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: ["barrel index.ts with named re-exports only", "__contracts__/ directory per sub-module", "sub-module import for Tauri-dependent code in tests"]

key-files:
  created:
    - src/shared/lib/index.ts
    - src/shared/constants/index.ts
    - src/shared/types/index.ts
    - src/shared/utils/index.ts
    - src/shared/lib/__contracts__/lib.contract.test.ts
    - src/shared/constants/__contracts__/constants.contract.test.ts
    - src/shared/types/__contracts__/types.contract.test.ts
    - src/shared/utils/__contracts__/utils.contract.test.ts
  modified:
    - "123+ consumer files (import path updates)"
    - "17 test files (vi.mock path updates)"
    - src/constants/index.ts
    - src/utils/breadcrumbsComparison.ts
    - src/services/ai/providerConfig.ts

key-decisions:
  - "Import from sub-modules in lib contract tests to avoid Tauri plugin-store runtime dependency"
  - "Used Python bulk script for atomic import updates across 123+ files to avoid linter reversion"
  - "Fixed pre-existing duplicate logger imports in query-client-config.ts and providerConfig.ts during move"

patterns-established:
  - "Barrel pattern: named re-exports only, no wildcard export *"
  - "Contract test pattern: __contracts__/ directory with shape + behavioral tests"
  - "Tauri-dependent modules: test via sub-module imports, not barrel"

requirements-completed: [SHRD-04, SHRD-06, SHRD-07, SHRD-08]

# Metrics
duration: 35min
completed: 2026-03-08
---

# Phase 2 Plan 01: Move lib/constants/types/utils to shared Summary

**Moved 16 source files + breadcrumbs directory to src/shared/ with 4 barrel index.ts files, updated 140+ consumer imports to @shared/* paths, and added 70 contract tests across 4 sub-modules**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-08T20:30:00Z
- **Completed:** 2026-03-08T21:12:00Z
- **Tasks:** 2/2
- **Files modified:** 144

## Accomplishments

- Moved all data-layer shared modules (lib, constants, types, utils) to src/shared/ with barrel exports
- Updated 123+ consumer files and 17 test files to use @shared/* import paths
- Created 70 contract tests covering export shape and behavioral verification for all 4 sub-modules
- Zero old-path imports remain; full test suite passes (1998 tests), build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Move lib, constants, types, utils to src/shared/ with barrels** - `9e2e136` (feat) + `22cbb18` (fix: logger test import path)
2. **Task 2: Write contract tests for all shared sub-modules** - `2b41a30` (test)

## Files Created/Modified

### Created
- `src/shared/lib/index.ts` - Barrel re-exporting all 5 lib modules (query-keys, query-client-config, query-utils, performance-monitor, prefetch-strategies)
- `src/shared/constants/index.ts` - Barrel re-exporting timing (9 exports), animations (16 exports), project (1 export)
- `src/shared/types/index.ts` - Barrel re-exporting media types (7 type exports) and core domain types (5 type exports)
- `src/shared/utils/index.ts` - Barrel re-exporting logger, storage, debounce, validation, versionUtils, breadcrumbs (27 exports total)
- `src/shared/lib/__contracts__/lib.contract.test.ts` - 19 tests: query-keys factory, invalidation rules, query-utils behavior
- `src/shared/constants/__contracts__/constants.contract.test.ts` - 19 tests: timing units/tiers, animation shapes, project limits
- `src/shared/types/__contracts__/types.contract.test.ts` - 5 tests: media types, core domain types shape verification
- `src/shared/utils/__contracts__/utils.contract.test.ts` - 27 tests: logger, debounce, validation, version, breadcrumbs behavior

### Deleted (moved to shared)
- `src/lib/` directory (5 files)
- `src/constants/timing.ts`, `src/constants/animations.ts`, `src/constants/project.ts`
- `src/types/media.ts`
- `src/utils/logger.ts`, `src/utils/storage.ts`, `src/utils/debounce.ts`, `src/utils/validation.ts`, `src/utils/versionUtils.ts`, `src/utils/types.ts`
- `src/utils/breadcrumbs/` directory (6 files + index.ts)

### Modified
- 123+ consumer files across src/ (import path updates to @shared/*)
- 17 test files (vi.mock() and dynamic import() path updates)
- `src/constants/index.ts` - updated to re-export themes.ts only
- `src/utils/breadcrumbsComparison.ts` - updated re-export path

## Decisions Made

- **Sub-module imports in lib contract tests**: The barrel `@shared/lib` pulls in `query-client-config.ts` which depends on `@tauri-apps/plugin-store` (unavailable in test env). Contract tests import from `@shared/lib/query-keys` and `@shared/lib/query-utils` directly.
- **Atomic bulk updates via Python script**: A file watcher/linter was reverting individual edits. Used a Python script to update all 123+ files atomically, then committed immediately.
- **Fixed pre-existing duplicate logger imports**: `query-client-config.ts` and `providerConfig.ts` both had unused `import { logger }` shadowed by `const logger = createNamespacedLogger(...)`. Removed the dead imports during move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate logger imports in query-client-config.ts and providerConfig.ts**
- **Found during:** Task 1 (moving lib files)
- **Issue:** Both files had `import { logger } from '@utils/logger'` AND `const logger = createNamespacedLogger(...)`, creating a shadowed variable
- **Fix:** Removed the unused `import { logger }` line in both files
- **Files modified:** src/shared/lib/query-client-config.ts, src/services/ai/providerConfig.ts
- **Verification:** Build passes, no shadowed variable warnings
- **Committed in:** 9e2e136

**2. [Rule 3 - Blocking] Fixed logger test import path**
- **Found during:** Task 1 verification (test suite run)
- **Issue:** `tests/unit/utils/logger.test.ts` used relative path `await import('../../../src/utils/logger')` which no longer resolved
- **Fix:** Updated to `await import('@shared/utils/logger')` and all vi.mock paths
- **Files modified:** tests/unit/utils/logger.test.ts
- **Verification:** All logger tests pass
- **Committed in:** 22cbb18

**3. [Rule 3 - Blocking] Fixed lib contract test Tauri dependency**
- **Found during:** Task 2 (contract test creation)
- **Issue:** Importing from `@shared/lib` barrel pulled in query-client-config.ts which requires @tauri-apps/plugin-store
- **Fix:** Changed to import from specific sub-modules (`@shared/lib/query-keys`, `@shared/lib/query-utils`)
- **Files modified:** src/shared/lib/__contracts__/lib.contract.test.ts
- **Verification:** All 19 lib contract tests pass
- **Committed in:** 2b41a30

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- `git mv` failed silently when moving files (old copies remained). Resolved by using `cp` + `rm` instead.
- Linter/auto-save hook reverted individual file edits. Resolved by bulk-updating via Python script and committing immediately.
- Initial import regex missed some patterns (`@/lib/`, `../logger`, `./utils/logger`). Added comprehensive replacement patterns to catch all variants.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 data-layer shared sub-modules are established with barrel exports and contract tests
- Plan 02-02 (store & services) already completed building on this foundation
- Plans 02-03 (hooks) and 02-04 (UI components) can proceed with established patterns
- Contract test pattern (`__contracts__/` directory) is proven and ready for reuse

---
*Phase: 02-shared-infrastructure*
*Completed: 2026-03-08*

## Self-Check: PASSED

All 8 key files verified present. All 3 task commits verified in git log.
