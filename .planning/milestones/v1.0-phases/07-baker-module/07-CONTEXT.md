# Phase 7: Baker Module - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate Baker (drive scanning, breadcrumbs management, batch operations) into a deep feature module at `src/features/Baker/` with barrel exports, api.ts I/O boundary, and contract tests. Baker imports Trello through `@features/Trello` barrel, not internal paths. No behavioral changes -- purely structural migration.

</domain>

<decisions>
## Implementation Decisions

### Hook ownership
- **All 9 hooks move to Baker**: useBakerScan, useBakerPreferences, useBreadcrumbsManager, useBreadcrumbsPreview, useBreadcrumbsReader, useLiveBreadcrumbsReader, useBreadcrumbsVideoLinks, useAppendBreadcrumbs, useProjectBreadcrumbs
- **useAppendBreadcrumbs and useProjectBreadcrumbs** are breadcrumb I/O hooks consumed only by Trello module hooks -- they live in Baker, exported from barrel for Trello to import
- **useBreadcrumbsReader** moves to Baker (breadcrumbs are Baker domain)
- Trello module imports breadcrumb hooks from `@features/Baker` barrel

### Directory structure
- **Flat layout** -- components/ and hooks/ at module root (consistent with Upload/Phase 4)
- **No sub-directories** -- Baker is one cohesive workflow, sub-feature split would feel forced
- **VideoLinks/ sub-directory flattened** -- AddVideoDialog.tsx moves to components/ (single file, no sub-dir needed)
- **BakerPage.tsx at module root** -- entry-point page component at module root, internal sub-components in components/

### Barrel export scope
- **Minimal exports**: BakerPage (for router), useAppendBreadcrumbs, useProjectBreadcrumbs, useBreadcrumbsReader (for Trello), and types
- **Everything else internal** -- useBakerScan, useBakerPreferences, useBreadcrumbsManager, useBreadcrumbsPreview, useLiveBreadcrumbsReader, useBreadcrumbsVideoLinks, all components except BakerPage
- **Fix test boundary violations** during migration -- VideoLinksManager.test.tsx imports from @features/Trello/hooks/ and @features/Upload/hooks/ must use barrel paths
- **BatchUpdateConfirmationDialog + BatchUpdate/ sub-components + batchUpdateSummary.ts** all move into Baker module (only consumed by Baker)

### api.ts I/O boundary
- **Full consolidation** -- all invoke(), readTextFile, writeTextFile, open (dialog), open (shell), openUrl, listen() routed through api.ts. Single mock point for testing
- **Event listeners**: api.ts exports raw listener wrappers (listenScanProgress, listenScanComplete, listenScanError) that return unlisten functions. Hook calls them directly
- **Baker types** move from src/types/baker.ts into Baker module's types.ts

### alert() replacement
- Replace Baker.tsx's 3 alert() calls with logger.error() or sonner toast during migration (same Phase 4/5 approach)

### Plan granularity
- **1 atomic plan** -- file moves, api.ts, barrel, consumer updates, contract tests, alert replacement. No broken intermediate states

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Internal file organization within components/ and hooks/
- Whether to split api.ts if it exceeds ~200 lines (unlikely given Baker's I/O surface)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/Settings/` -- latest module pattern with sub-component decomposition and api.ts
- `src/features/Upload/` -- flat layout pattern (same structure Baker will use)
- `src/features/Trello/__contracts__/trello.contract.test.ts` -- contract test template
- Phase 2 `// Target: @features/Baker` tags on hooks -- migration guide

### Established Patterns
- api.ts wraps ALL external calls (invoke, fetch, file plugins, dialog, shell, event listeners) -- single I/O boundary per module
- Named re-exports in barrels, no wildcards (Phase 2)
- `__contracts__/` directory colocated with module (Phase 2)
- No barrel files in internal directories (Phase 2)
- Raw listener wrappers in api.ts for event-based hooks (new pattern for Baker)

### Integration Points
- App router/sidebar: imports BakerPage from @pages/Baker -- update to @features/Baker barrel
- Trello module: imports useBakerTrelloIntegration from own barrel (stays), will also import breadcrumb hooks from @features/Baker barrel
- Baker uses @features/Trello barrel for useBakerTrelloIntegration, useTrelloBoard, TrelloCardsManager
- Baker uses @features/Upload barrel for upload hooks (via VideoLinksManager)
- ESLint boundary rules: already configured for @features/* zone (Phase 1)

### File Inventory
- **Page**: src/pages/Baker/Baker.tsx (1 file)
- **Components**: src/components/Baker/ (11 files + 1 test + VideoLinks/AddVideoDialog.tsx)
- **Batch components**: src/components/BatchUpdateConfirmationDialog.tsx + src/components/BatchUpdate/ (5 files) + src/utils/batchUpdateSummary.ts
- **Hooks**: 9 hooks in src/hooks/ (useBakerScan, useBakerPreferences, useBreadcrumbsManager, useBreadcrumbsPreview, useBreadcrumbsReader, useLiveBreadcrumbsReader, useBreadcrumbsVideoLinks, useAppendBreadcrumbs, useProjectBreadcrumbs)
- **Types**: src/types/baker.ts
- **I/O calls**: invoke (2), listen (3 events), readTextFile (1), writeTextFile (1), open/dialog (2), open/shell (1), openUrl (1)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- following the established deep module pattern from Phases 3-6, with flat layout consistent with Upload module.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 07-baker-module*
*Context gathered: 2026-03-09*
