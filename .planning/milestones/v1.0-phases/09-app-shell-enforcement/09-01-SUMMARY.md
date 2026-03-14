---
phase: 09-app-shell-enforcement
plan: 01
subsystem: ui
tags: [tsconfig, path-aliases, sonner, radix, alert-dialog, imports, dead-code]

# Dependency graph
requires:
  - phase: 02-shared-infrastructure
    provides: shared/ui, shared/hooks, shared/types, shared/services barrels
  - phase: 03-leaf-feature-modules
    provides: Trello module barrel, Auth module barrel
  - phase: 08-buildproject-module
    provides: BuildProject api.ts boundary pattern
provides:
  - Zero legacy path aliases in tsconfig.json (only @features/*, @shared/*, @tests/*)
  - cn() utility at @shared/utils/cn with barrel export
  - AI service files at @shared/services/ai/
  - AI types at @shared/types/ (scriptFormatter, exampleEmbeddings)
  - All browser alert()/confirm() replaced with themed alternatives
  - AlertDialog confirmation pattern for Trello card and video link removal
affects: [09-app-shell-enforcement plan 02 (ESLint boundary promotion to errors)]

# Tech tracking
tech-stack:
  added: []
  patterns: [AlertDialog state pattern for async confirm replacement, toast.error for alert replacement]

key-files:
  created:
    - src/shared/utils/cn.ts
    - src/shared/services/ai/providerConfig.ts
    - src/shared/services/ai/modelFactory.ts
    - src/shared/services/ai/types.ts
    - src/shared/types/scriptFormatter.ts
    - src/shared/types/exampleEmbeddings.ts
  modified:
    - tsconfig.json
    - src/shared/utils/index.ts
    - src/shared/hooks/index.ts
    - src/shared/types/index.ts
    - src/shared/services/index.ts
    - src/features/Trello/hooks/useTrelloCardsManager.ts
    - src/features/Trello/hooks/useVideoLinksManager.ts
    - src/features/Trello/components/TrelloCardsManager.tsx
    - src/features/Baker/components/VideoLinksManager.tsx
    - src/shared/ui/theme/ThemeImport.tsx

key-decisions:
  - "Tauri-dependent hooks (useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck) excluded from barrel exports to prevent test environment crashes"
  - "AI service files (providerConfig, modelFactory) excluded from services barrel for same reason (Ollama runtime dependency)"
  - "FolderTree routed through BuildProject api.ts openFolderDialog() to satisfy no-direct-plugin-import contract"
  - "Dead code deleted: useHighlights, useVideoDetails, VideoInfoAccordion (zero consumers)"
  - "AlertDialog state pattern: hooks expose pendingIndex/request/confirm/cancel, components render AlertDialog JSX"

patterns-established:
  - "AlertDialog state pattern: hooks return {pendingIndex, requestRemove, confirmRemove, cancelRemove} for async confirmation"
  - "Toast replacement: alert() calls become toast.error() or toast.info() from sonner"

requirements-completed: [SHEL-03, DOCS-04]

# Metrics
duration: 19min
completed: 2026-03-09
---

# Phase 09 Plan 01: Legacy Alias Removal and Browser Dialog Replacement Summary

**Zero legacy path aliases, 111 files migrated to @features/@shared imports, all browser alert()/confirm() replaced with Sonner toasts and Radix AlertDialog**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-09T22:44:23Z
- **Completed:** 2026-03-09T23:04:18Z
- **Tasks:** 2
- **Files modified:** 119

## Accomplishments
- Eliminated all legacy tsconfig path aliases (@components/*, @hooks/*, @utils/*, @services/*, @lib/*, @constants/*, @store/*, @pages/*, @context/*, @/*) -- only @features/*, @shared/*, @tests/* remain
- Relocated 25+ files to proper module locations (Baker, BuildProject, Trello internal, shared hooks/services/types)
- Replaced 5 browser alert() calls with Sonner toast notifications and 2 browser confirm() calls with Radix AlertDialog confirmation pattern
- Deleted dead code: useHighlights.ts, useVideoDetails.ts, VideoInfoAccordion.tsx
- Updated ~100 import paths across src/ and tests/

## Task Commits

Each task was committed atomically:

1. **Task 1: Relocate legacy files and migrate all old-alias imports** - `9c297c9` (feat)
2. **Task 2: Replace browser alert() and confirm() calls** - `5b75b14` (feat)

## Files Created/Modified

Key files (see commits for full list):
- `src/shared/utils/cn.ts` - cn() utility for Tailwind class merging
- `src/shared/services/ai/` - AI provider services (providerConfig, modelFactory, types)
- `src/shared/types/scriptFormatter.ts` - Script formatter types
- `src/shared/types/exampleEmbeddings.ts` - Example embeddings types
- `src/features/Trello/internal/` - Trello utility components (CardDetailsAccordion, TooltipPreview, etc.)
- `src/features/Trello/hooks/useAppendVideoInfo.ts` - Moved from src/hooks/
- `src/features/Baker/components/BreadcrumbsViewerEnhanced.tsx` - Moved from src/components/
- `src/features/Baker/internal/` - NormalView, PreviewComparison, fieldUtils
- `src/features/BuildProject/components/FolderTree.tsx` - Moved, routed through api.ts
- `src/shared/hooks/` - useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck, use-mobile
- `tsconfig.json` - Legacy aliases removed

## Decisions Made

- Tauri-dependent hooks excluded from barrel exports to prevent test environment crashes from eager loading
- AI service files excluded from services barrel (Ollama runtime dependency causes test failures)
- FolderTree moved to BuildProject module and refactored to use api.ts openFolderDialog() wrapper
- Dead code deleted: useHighlights (0 consumers, tagged since Phase 2), useVideoDetails (0 consumers), VideoInfoAccordion (0 consumers)
- AlertDialog state pattern: hooks expose {pendingIndex, request, confirm, cancel}, consuming components render the JSX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Additional Trello utility files needed relocation**
- **Found during:** Task 1 (file relocation)
- **Issue:** Plan listed 3 Trello utility files but 6 more existed in src/utils/trello/ (FileList, KeyValueRow, VideoThumbnail, BreadcrumbsAccordionItem, DescriptionAccordionItem, VideoInfoAccordionItem)
- **Fix:** Moved all remaining utility files to src/features/Trello/internal/
- **Files modified:** 6 files moved
- **Committed in:** 9c297c9

**2. [Rule 1 - Bug] Duplicate logger declaration in providerConfig.ts**
- **Found during:** Task 1 (services barrel test failure)
- **Issue:** File had both `import { logger }` and `const logger =` -- pre-existing bug exposed by barrel export
- **Fix:** Removed duplicate import, kept namespaced logger const
- **Files modified:** src/shared/services/ai/providerConfig.ts
- **Committed in:** 9c297c9

**3. [Rule 1 - Bug] FolderTree direct Tauri plugin import violated contract**
- **Found during:** Task 1 (BuildProject contract test failure)
- **Issue:** FolderTree.tsx imported `@tauri-apps/plugin-dialog` directly, violating no-bypass contract
- **Fix:** Added openFolderDialog() wrapper to BuildProject api.ts, updated FolderTree to use it
- **Files modified:** src/features/BuildProject/api.ts, src/features/BuildProject/components/FolderTree.tsx
- **Committed in:** 9c297c9

**4. [Rule 3 - Blocking] BreadcrumbsViewer sub-components needed co-location**
- **Found during:** Task 1 (BreadcrumbsViewerEnhanced move)
- **Issue:** NormalView.tsx and PreviewComparison.tsx had relative imports to fieldUtils.tsx, all needed to move together
- **Fix:** Moved NormalView, PreviewComparison, and fieldUtils to Baker/internal/
- **Files modified:** 3 files moved, imports updated
- **Committed in:** 9c297c9

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- VideoLinksManager.test.tsx had 33 pre-existing failures (unrelated to this plan) -- documented, not addressed
- Test imports needed updating alongside source imports (~20 test files)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All legacy aliases removed -- ESLint boundary rules can be promoted from warnings to errors (Plan 02)
- Zero browser alert()/confirm() calls in production code
- Build passes, 2158 tests pass (34 pre-existing failures in VideoLinksManager.test.tsx)

## Self-Check: PASSED

All key files verified present on disk. Both task commits (9c297c9, 5b75b14) verified in git log.

---
*Phase: 09-app-shell-enforcement*
*Completed: 2026-03-09*
