# Phase 11: Legacy & Stub Cleanup - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove orphaned legacy files from src/, resolve stub routes, close stale planning artifacts. This is tech debt cleanup — no new features. All 12 orphaned files have migrated counterparts in feature modules. Stub routes are confirmed non-functional.

</domain>

<decisions>
## Implementation Decisions

### IngestHistory stub
- Remove entirely: component file, lazy route from AppRouter.tsx, and sidebar nav entry
- No trace of the stub should remain
- Audit ALL routes in AppRouter.tsx for other stubs (empty divs, placeholders, "coming soon")
- If other stubs found: flag them for user review before deleting (do NOT auto-delete)

### FolderTreeNavigator
- Verify consumers via grep before deleting
- If zero consumers: delete the file
- If consumers found: rewire them to BuildProject module (which already has openFolderDialog() in api.ts and FolderTree component)
- BuildProject is the canonical owner of folder tree functionality

### Legacy AI services (src/services/ai/)
- Verify consumers of modelFactory.ts, providerConfig.ts, types.ts via grep
- If consumers found: rewire imports to @features/AITools barrel or api.ts, then delete old files
- If zero consumers: delete directly
- Same treatment for src/types/ orphans (exampleEmbeddings.ts, plugins.ts, scriptFormatter.ts) — verify, rewire, delete

### Orphaned file removal (12 files)
- Verify-then-delete pattern for ALL orphaned files:
  - src/utils/breadcrumbsValidation.ts
  - src/utils/breadcrumbsMigration.ts
  - src/utils/breadcrumbsComparison.ts
  - src/utils/updateManifest.ts
  - src/components/BreadcrumbsViewer.tsx
  - src/components/ProjectChangeDetailView.tsx
  - src/services/ai/modelFactory.ts
  - src/services/ai/providerConfig.ts
  - src/services/ai/types.ts
  - src/types/exampleEmbeddings.ts
  - src/types/plugins.ts
  - src/types/scriptFormatter.ts
- Any consumer found gets rewired to the appropriate feature module barrel import
- Remove empty directories after deletions (src/services/ai/, src/types/ if empty)

### Stale todo closure
- Move pending todo (fix-eslint-boundaries-no-unknown-files-warning) from pending/ to done/ — confirmed resolved in milestone audit

### Verification
- Run `bun run test` after all deletions as safety net
- Run `bun run eslint:fix` to catch any broken imports

### Claude's Discretion
- Order of file deletion (batch vs one-at-a-time)
- Whether to verify each file individually or batch-grep all at once
- Git commit granularity (single commit vs per-category commits)

</decisions>

<specifics>
## Specific Ideas

- Route audit should cover ALL lazy routes in AppRouter.tsx, not just IngestHistory
- Any stubs found during audit get flagged for review, not auto-deleted
- "Verify then delete" is the universal pattern — no file gets deleted without a consumer check first

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Knip baseline report (.planning/codebase/KNIP-BASELINE.md): lists orphaned files already identified
- Milestone audit (.planning/v1.0-MILESTONE-AUDIT.md): confirms all 12 orphaned files and stub routes

### Established Patterns
- Feature modules have canonical counterparts for all orphaned files:
  - breadcrumbs utils → Baker module (hooks/internal)
  - BreadcrumbsViewer → Baker/components/
  - ProjectChangeDetailView → Baker/components/
  - AI services → AITools/api.ts (19 I/O functions)
  - types/ → feature-level types.ts files
- No-bypass contract tests verify no direct Tauri imports — deletions won't affect these

### Integration Points
- AppRouter.tsx: IngestHistory lazy route removal + full stub audit
- app-sidebar.tsx: IngestHistory nav entry removal
- Any file importing orphaned utils/components needs rewiring to feature barrels

</code_context>

<deferred>
## Deferred Ideas

- IngestHistory as a real feature (show past BuildProject file imports) — future milestone
- Full route/nav audit as ongoing practice — not automated yet

</deferred>

---

*Phase: 11-legacy-stub-cleanup*
*Context gathered: 2026-03-10*
