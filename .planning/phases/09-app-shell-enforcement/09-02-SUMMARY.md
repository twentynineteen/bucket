---
phase: 09-app-shell-enforcement
plan: 02
subsystem: ui, tooling
tags: [react-lazy, code-splitting, suspense, eslint-boundaries, error-boundary]

# Dependency graph
requires:
  - phase: 09-app-shell-enforcement/01
    provides: Legacy alias removal, feature module barrels, @features/* and @shared/* paths
provides:
  - React.lazy() code-split routes with Suspense fallback
  - ChunkErrorBoundary for failed dynamic imports with retry
  - ESLint boundary rules at error severity (element-types, no-unknown-files, no-unknown)
  - eslint-import-resolver-typescript for path alias resolution
affects: [future feature routes, module boundary compliance]

# Tech tracking
tech-stack:
  added: [eslint-import-resolver-typescript]
  patterns: [React.lazy with named export .then() wrapper, chunk error boundary, importKind-based boundary rules]

key-files:
  created:
    - src/shared/ui/layout/ChunkErrorBoundary.tsx
    - src/shared/ui/layout/RouteLoadingSpinner.tsx
  modified:
    - src/AppRouter.tsx
    - src/App.tsx
    - eslint.config.js
    - src/shared/ui/layout/app-sidebar.tsx
    - src/app/dashboard/page.tsx
    - src/utils/breadcrumbsMigration.ts

key-decisions:
  - "Used .then(m => ({ default: m.X })) wrapper for React.lazy() since all barrel exports are named"
  - "Added eslint-import-resolver-typescript to resolve @features/* and @shared/* path aliases for boundary enforcement"
  - "Changed legacy element patterns from src/X/* to src/X/** for correct file-level matching in eslint-plugin-boundaries v5"
  - "Added importKind: 'value' to shared->feature disallow rule so type-only imports are allowed (shared utils need Baker types)"
  - "Moved useAuth from shared app-sidebar to app-level page.tsx via onLogout prop to comply with shared->feature boundary"
  - "Added CSS files to boundaries/ignore to prevent false positives on style imports"

patterns-established:
  - "React.lazy wrapper: const X = React.lazy(() => import('@features/Module').then(m => ({ default: m.X })))"
  - "Boundary importKind: use importKind: 'value' to disallow value imports while permitting type imports across boundaries"

requirements-completed: [SHEL-01, SHEL-02]

# Metrics
duration: 11min
completed: 2026-03-10
---

# Phase 9 Plan 02: Lazy Routes and ESLint Boundary Enforcement Summary

**React.lazy() code splitting for all 13 routes with Suspense/error boundary, plus all 3 ESLint boundary rules promoted to error with zero violations**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-10T11:50:58Z
- **Completed:** 2026-03-10T12:02:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All 13 feature route components use React.lazy() dynamic imports producing separate chunks
- Suspense with RouteLoadingSpinner wraps AppRouter while TitleBar stays stable outside
- ChunkErrorBoundary catches failed dynamic imports and shows retry UI
- All 3 ESLint boundary rules (element-types, no-unknown-files, no-unknown) at error severity
- Zero boundary lint violations across entire codebase
- Build produces multiple JS chunks confirming code splitting works
- All 2192 tests pass across 131 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert route imports to React.lazy() with Suspense and error boundary** - `f845c19` (feat)
2. **Task 2: Promote ESLint boundary rules from warn to error** - `780db10` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/shared/ui/layout/RouteLoadingSpinner.tsx` - Minimal centered spinner for Suspense fallback
- `src/shared/ui/layout/ChunkErrorBoundary.tsx` - Error boundary catching chunk load failures with retry
- `src/AppRouter.tsx` - All 13 route components converted to React.lazy()
- `src/App.tsx` - Suspense + ChunkErrorBoundary wrapping AppRouter
- `eslint.config.js` - Boundary rules at error, import resolver, fixed patterns, importKind
- `src/shared/ui/layout/app-sidebar.tsx` - Removed direct @features/Auth import, accepts onLogout prop
- `src/app/dashboard/page.tsx` - Added useAuth, passes logout to AppSidebar
- `src/utils/breadcrumbsMigration.ts` - Fixed broken import path to @shared/utils/validation

## Decisions Made
- Used .then(m => ({ default: m.X })) wrapper pattern since all barrel exports are named (not default)
- Installed eslint-import-resolver-typescript to enable correct path alias resolution for boundary enforcement
- Changed legacy element glob patterns from `src/X/*` to `src/X/**` -- the `*` pattern in eslint-plugin-boundaries v5 matches directory names, not files
- Added `importKind: 'value'` to the shared->feature disallow rule, allowing type-only imports (shared breadcrumbs utils need Baker type definitions)
- Moved useAuth hook call from shared app-sidebar.tsx to app-level page.tsx, passing logout as a prop -- this maintains the boundary invariant that shared code never value-imports from features
- Added `**/*.css` to boundaries/ignore to prevent false positives on CSS file imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed eslint-import-resolver-typescript**
- **Found during:** Task 2 (promoting boundary rules)
- **Issue:** With rules at warn, 362 boundary warnings existed because path aliases (@features/*, @shared/*) weren't resolved -- the boundaries plugin uses eslint-module-utils/resolve which defaults to node resolver
- **Fix:** Installed eslint-import-resolver-typescript and configured import/resolver setting
- **Files modified:** eslint.config.js, package.json, bun.lock
- **Verification:** Warnings dropped from 362 to 16
- **Committed in:** 780db10 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed legacy element patterns**
- **Found during:** Task 2 (promoting boundary rules)
- **Issue:** Legacy element patterns used `src/X/*` which only matches subdirectory names in eslint-plugin-boundaries v5, not files directly in those directories
- **Fix:** Changed all legacy patterns to `src/X/**` for correct file matching
- **Files modified:** eslint.config.js
- **Verification:** no-unknown-files warnings eliminated for legacy files
- **Committed in:** 780db10 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed shared->feature value import in app-sidebar**
- **Found during:** Task 2 (promoting boundary rules)
- **Issue:** After resolver was added, a previously-hidden element-types violation appeared: app-sidebar.tsx (shared) importing useAuth from @features/Auth
- **Fix:** Moved useAuth call to page.tsx (app element), passed logout as prop to AppSidebar
- **Files modified:** src/shared/ui/layout/app-sidebar.tsx, src/app/dashboard/page.tsx
- **Verification:** Zero element-types errors
- **Committed in:** 780db10 (Task 2 commit)

**4. [Rule 1 - Bug] Fixed broken import in breadcrumbsMigration.ts**
- **Found during:** Task 2 (promoting boundary rules)
- **Issue:** Legacy file imported from `./validation` which doesn't exist (function is in @shared/utils/validation)
- **Fix:** Changed import path to `@shared/utils/validation`
- **Files modified:** src/utils/breadcrumbsMigration.ts
- **Verification:** no-unknown warning eliminated
- **Committed in:** 780db10 (Task 2 commit)

**5. [Rule 2 - Missing Critical] Added importKind exception for type imports**
- **Found during:** Task 2 (promoting boundary rules)
- **Issue:** Shared breadcrumbs utilities use `import type` from @features/Baker for type definitions -- this is a type-only dependency, not a runtime coupling
- **Fix:** Added `importKind: 'value'` to shared->feature disallow rule so only value imports are blocked
- **Files modified:** eslint.config.js
- **Verification:** Type imports allowed, value imports still caught as errors
- **Committed in:** 780db10 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 bugs, 1 missing critical, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correct boundary enforcement. Resolver installation and pattern fixes were prerequisites to promoting rules. No scope creep.

## Issues Encountered
- eslint-plugin-boundaries v5 glob pattern semantics differ from standard glob -- `src/X/*` matches subdirectory names, not files. Required `src/X/**` for file-level matching.
- The 362 boundary warnings at warn level were masking 5 real violations. The resolver installation revealed them.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Code splitting active with per-route chunks for faster startup
- All 3 boundary rules at error severity -- any cross-module violation now fails lint
- Module boundary enforcement is complete -- ready for ongoing development with guard rails

---
*Phase: 09-app-shell-enforcement*
*Completed: 2026-03-10*
