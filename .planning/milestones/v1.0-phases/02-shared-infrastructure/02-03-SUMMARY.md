---
phase: 02-shared-infrastructure
plan: 03
subsystem: ui
tags: [radix-ui, sidebar, theme-system, layout, direct-imports, contract-tests]

# Dependency graph
requires:
  - phase: 02-shared-infrastructure
    provides: "@shared/* path aliases, shared store/services/utils/constants/types barrels"
provides:
  - "src/shared/ui/ with 24 UI primitives (direct imports, no barrels)"
  - "src/shared/ui/sidebar/ sub-module (4 components: Sidebar, SidebarLayout, SidebarMenu, SidebarProvider)"
  - "src/shared/ui/theme/ sub-module (9 files coalesced from 6 source locations)"
  - "src/shared/ui/layout/ sub-module (6 components: app-sidebar, nav-main, nav-user, team-switcher, TitleBar, ErrorBoundary)"
  - "src/shared/ui/ misplaced components (ApiKeyInput, EmbedCodeInput, ExternalLink, FormattedDate)"
  - "Contract tests for UI direct imports (30 tests)"
affects: [03-posterframe, 04-sprout-upload, 05-settings, 06-ai-tools, 07-baker, 08-build-project, 09-app-shell]

# Tech tracking
tech-stack:
  added: []
  patterns: ["direct-import only (no barrels in ui tree)", "nested sub-module directories (sidebar/, theme/, layout/)", "theme coalescing pattern"]

key-files:
  created:
    - src/shared/ui/__contracts__/ui.contract.test.ts
  modified:
    - src/shared/ui/ (48 files total: 24 primitives + 4 sidebar + 9 theme + 6 layout + 4 utils + sidebar barrel removed)
    - "100+ consumer files (import path updates)"
    - src/constants/index.ts
    - src/pages/BuildProject/BuildProject.tsx

key-decisions:
  - "Eliminated sidebar barrel file -- all consumers use direct imports (sidebar/Sidebar, sidebar/SidebarMenu, etc.)"
  - "Theme system coalesced from 6 scattered locations (constants, utils, hooks, types, components/Settings, components/) into shared/ui/theme/"
  - "No barrel/index.ts files anywhere in shared/ui/ tree -- locked convention enforced by contract test"

patterns-established:
  - "Direct import pattern: @shared/ui/button, @shared/ui/sidebar/Sidebar, @shared/ui/theme/themes"
  - "Nested sub-module pattern: sidebar/, theme/, layout/ for related component groups"
  - "Theme coalescing: all theme code (constants, utils, hooks, types, components) in one directory"

requirements-completed: [SHRD-02]

# Metrics
duration: 10min
completed: 2026-03-08
---

# Phase 2 Plan 03: UI Components to shared/ui Summary

**48 UI files moved to src/shared/ui/ with nested sub-modules (sidebar/, theme/, layout/), theme system coalesced from 6 locations, zero barrel files, 30 contract tests**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-08T21:14:47Z
- **Completed:** 2026-03-08T21:25:00Z
- **Tasks:** 2/2
- **Files modified:** 100+

## Accomplishments

- All UI primitives (24 files), sidebar (4 files), theme (9 files), layout (6 files), and misplaced utils components (4 files) consolidated into src/shared/ui/
- Theme system fully coalesced from 6 scattered source locations (constants/, utils/, hooks/, types/, components/Settings/, components/) into shared/ui/theme/
- Sidebar barrel eliminated -- consumers now use direct sub-module imports (sidebar/Sidebar, sidebar/SidebarMenu, etc.)
- 30 contract tests verify direct import paths work for all sub-modules and theme behavioral contracts
- Zero old-path imports remain; full test suite passes (2042 tests), build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Move all UI components to src/shared/ui/ with nested sub-directories** - `12a91f8` (feat)
2. **Task 2: Write contract test for UI direct imports** - `77da689` (test)

## Files Created/Modified

### Created
- `src/shared/ui/__contracts__/ui.contract.test.ts` - 30 tests covering direct imports for primitives, sidebar, theme, layout, utils, and behavioral contracts

### Moved (from old locations to shared/ui/)
- 24 UI primitives from `src/components/ui/` to `src/shared/ui/`
- 4 sidebar components from `src/components/ui/sidebar/` to `src/shared/ui/sidebar/`
- 9 theme files from 6 scattered locations to `src/shared/ui/theme/`
- 6 layout components from `src/components/` to `src/shared/ui/layout/`
- 4 misplaced React components from `src/utils/` to `src/shared/ui/`

### Modified
- 100+ consumer files across src/ and tests/ (import path updates)
- `src/constants/index.ts` - updated to re-export from new shared/ui/theme/themes location
- `src/pages/BuildProject/BuildProject.tsx` - fixed broken useBreadcrumb/useUsername imports

## Decisions Made

- **Eliminated sidebar barrel**: The flat `sidebar.tsx` barrel file was removed. All 10 consumers updated to use direct imports from sidebar/Sidebar, sidebar/SidebarMenu, sidebar/SidebarLayout, sidebar/SidebarProvider.
- **Theme coalescing**: All 9 theme-related files from 6 different source directories brought together into shared/ui/theme/. Internal cross-references updated to relative paths.
- **No barrel convention**: Zero index.ts/barrel files in shared/ui/ tree. Convention documented and verified in contract test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed relative imports to deleted ui/ directory**
- **Found during:** Task 1 (build verification)
- **Issue:** 4 components in src/components/ used relative imports like `./ui/button`, `../ui/button` which broke after ui/ files moved
- **Fix:** Updated to `@shared/ui/button` absolute imports
- **Files modified:** BatchUpdateConfirmationDialog.tsx, BreadcrumbsViewer.tsx, BreadcrumbsViewerEnhanced.tsx, BreadcrumbsViewer/NormalView.tsx
- **Verification:** Build passes
- **Committed in:** 12a91f8

**2. [Rule 3 - Blocking] Fixed BuildProject.tsx broken hook imports**
- **Found during:** Task 1 (build verification)
- **Issue:** BuildProject.tsx imported useBreadcrumb and useUsername from `@/hooks` barrel, but those hooks were moved to `@shared/hooks` by a prior plan
- **Fix:** Split import to use `@shared/hooks` for moved hooks
- **Files modified:** src/pages/BuildProject/BuildProject.tsx
- **Verification:** Build passes
- **Committed in:** 12a91f8

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to resolve build failures. No scope creep.

## Issues Encountered

- A previous agent/automation chain (commit `58e3bdf`) had already performed most of the file moves and import updates before this plan executed. The bulk of the work was already committed. This plan verified correctness, fixed remaining issues (relative imports, sidebar barrel elimination, BuildProject imports), and added contract tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UI components are in src/shared/ui/ with nested sub-modules and contract tests
- Plan 02-04 (remaining shared infrastructure) can proceed
- All feature phases (03-09) can import UI components from @shared/ui/* paths
- Theme system is fully coalesced and testable

---
*Phase: 02-shared-infrastructure*
*Completed: 2026-03-08*

## Self-Check: PASSED

All 8 key files verified present. Both task commits (12a91f8, 77da689) verified in git log.
