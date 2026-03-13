# Phase 10: API Bypass Fixes & Baker Bookkeeping - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all api.ts bypass violations in Baker and Trello modules, extend no-bypass contract tests across all feature modules, export missing Baker barrel types, and correct Baker requirement bookkeeping. No new features — purely structural integrity fixes identified by the v1.0 milestone audit.

</domain>

<decisions>
## Implementation Decisions

### Shell/Opener Wrapper Placement
- Each module owns its own I/O boundary — duplicate wrappers per module, no cross-feature sharing
- Trello gets its own `openExternalUrl()` in Trello/api.ts
- Baker NormalView.tsx uses Baker's existing `openExternalUrl()` from Baker/api.ts

### Plugin Consolidation
- Trello consolidates all URL-opening to `@tauri-apps/plugin-opener` (openUrl), dropping `@tauri-apps/plugin-shell` (open)
- All 4 Trello call sites (useTrelloActions, useUploadTrello, TrelloIntegrationModal, TrelloCardItem) use the single Trello api.ts wrapper
- Baker NormalView.tsx uses Baker's existing `openExternalUrl()` which already wraps plugin-opener

### Baker Barrel Export Scope
- Export `BreadcrumbsViewerProps` from Baker barrel
- Audit all Baker/types.ts for any other types consumed outside Baker that aren't exported — fix any found

### No-Bypass Test Coverage
- Replace per-directory grep tests with comprehensive "scan all non-api.ts files" pattern
- Pattern: grep entire feature directory, exclude api.ts — catches any future subdirectory additions
- Update Baker's existing per-directory tests to the new comprehensive pattern
- Add no-bypass tests to Trello (currently has zero)
- Apply the same comprehensive pattern to ALL 8 feature modules (Auth, Premiere, Upload, Settings, AITools, BuildProject, Baker, Trello)

### Bookkeeping Timing
- Mark BAKR-01/02/03 as Complete only AFTER code fixes are done in Phase 10 execution
- Update SUMMARY 07-01 requirements_completed frontmatter at the same time
- Do not mark complete prematurely — verification passed but real code issues exist

### Claude's Discretion
- Exact grep command syntax for the comprehensive no-bypass test
- Whether to use a shared test helper or inline the grep in each contract test
- Order of operations for the fixes

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard module convention fixes following established patterns from Phases 3-9.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Baker api.ts `openExternalUrl()` (line 182-184): Wraps `@tauri-apps/plugin-opener` → `openUrl()` — pattern to replicate in Trello
- Baker api.ts `openInShell()` (line 178-180): Wraps `@tauri-apps/plugin-shell` → `open()` — NOT needed for Trello (consolidating to opener)
- Baker contract test no-bypass section (lines 324-361): Pattern to modernize and replicate

### Established Patterns
- Feature api.ts as single I/O boundary: Every feature wraps all Tauri plugin calls
- No-bypass contract tests: grep-based validation that no file imports @tauri-apps directly
- Barrel exports with JSDoc: All public types exported from index.ts with documentation

### Integration Points
- Baker/internal/NormalView.tsx line 6: `import { open } from '@tauri-apps/plugin-shell'` → replace with `import { openExternalUrl } from '../api'`
- Trello/hooks/useTrelloActions.ts line 7: `import { open } from '@tauri-apps/plugin-shell'` → replace
- Trello/hooks/useUploadTrello.ts line 14: `import { open } from '@tauri-apps/plugin-shell'` → replace
- Trello/components/TrelloIntegrationModal.tsx line 11: `import { open } from '@tauri-apps/plugin-shell'` → replace
- Trello/components/TrelloCardItem.tsx line 6: `import { openUrl } from '@tauri-apps/plugin-opener'` → replace
- Baker/index.ts: Add BreadcrumbsViewerProps export
- 8 feature modules' __contracts__/ files: Add or update no-bypass tests

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-api-bypass-fixes*
*Context gathered: 2026-03-10*
