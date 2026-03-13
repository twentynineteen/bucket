# Phase 11: Legacy & Stub Cleanup - Research

**Researched:** 2026-03-10
**Domain:** File deletion, route cleanup, planning artifact closure
**Confidence:** HIGH

## Summary

Phase 11 is a pure cleanup phase with no new feature work. All 12 orphaned legacy files exist and have been confirmed via filesystem inspection. None of the 12 files have active import consumers in the codebase -- they are true dead code left behind after the module refactor (Phases 1-9). The stub route (IngestHistory) and orphaned page (FolderTreeNavigator) are also confirmed present and deletable.

The work is mechanical: verify zero consumers (already done in this research), delete files, remove the lazy route + import from AppRouter.tsx, clean up empty directories, and move a stale todo from pending to done. The only complexity is ensuring the route removal in AppRouter.tsx is clean and that `bun run test` + `bun run eslint:fix` pass after all deletions.

**Primary recommendation:** Batch-delete all orphaned files in a single pass since consumer verification is complete, then handle route cleanup separately.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- IngestHistory: Remove entirely (component file, lazy route from AppRouter.tsx, sidebar nav entry). No trace should remain. Audit ALL routes in AppRouter.tsx for other stubs. Flag non-IngestHistory stubs for user review (do NOT auto-delete).
- FolderTreeNavigator: Verify consumers via grep before deleting. Zero consumers = delete. Consumers found = rewire to BuildProject module.
- Legacy AI services (src/services/ai/): Verify consumers, rewire if found, then delete. Same for src/types/ orphans.
- Orphaned file removal: Verify-then-delete pattern for all 12 files. Rewire any consumers to feature barrels. Remove empty directories after deletions.
- Stale todo: Move fix-eslint-boundaries-no-unknown-files-warning from pending/ to done/.
- Verification: Run `bun run test` and `bun run eslint:fix` after all deletions.

### Claude's Discretion
- Order of file deletion (batch vs one-at-a-time)
- Whether to verify each file individually or batch-grep all at once
- Git commit granularity (single commit vs per-category commits)

### Deferred Ideas (OUT OF SCOPE)
- IngestHistory as a real feature (show past BuildProject file imports) -- future milestone
- Full route/nav audit as ongoing practice -- not automated yet
</user_constraints>

## Current State of Target Files

### Verified File Inventory (all 12 exist)

| File | Location | Consumers | Action |
|------|----------|-----------|--------|
| breadcrumbsValidation.ts | src/utils/ | 0 imports | Delete |
| breadcrumbsMigration.ts | src/utils/ | 0 imports | Delete |
| breadcrumbsComparison.ts | src/utils/ | 0 imports | Delete |
| updateManifest.ts | src/utils/ | 0 imports | Delete |
| BreadcrumbsViewer.tsx | src/components/ | 0 imports (Baker has BreadcrumbsViewerEnhanced) | Delete |
| ProjectChangeDetailView.tsx | src/components/ | 0 imports (Baker has ProjectChangeDetail) | Delete |
| modelFactory.ts | src/services/ai/ | 0 imports (canonical copy at src/shared/services/ai/) | Delete |
| providerConfig.ts | src/services/ai/ | 0 imports (canonical copy at src/shared/services/ai/) | Delete |
| types.ts | src/services/ai/ | 0 imports (canonical copy at src/shared/services/ai/) | Delete |
| exampleEmbeddings.ts | src/types/ | 0 imports | Delete |
| plugins.ts | src/types/ | 0 imports | Delete |
| scriptFormatter.ts | src/types/ | 0 imports | Delete |

**Confidence: HIGH** -- grep verified all 12 files have zero import consumers in src/.

### Stub Routes

| File | Location | Status | Action |
|------|----------|--------|--------|
| IngestHistory.tsx | src/pages/ | Stub (renders `<div>IngestHistory</div>`) | Delete file + remove lazy import + remove route from AppRouter.tsx |
| FolderTreeNavigator.tsx | src/pages/ | Orphaned (no route in AppRouter, 0 consumers) | Delete file |

**IngestHistory details:**
- Lazy import at AppRouter.tsx line 36: `const IngestHistory = React.lazy(() => import('./pages/IngestHistory'))`
- Route at AppRouter.tsx line 153: `<Route path="history" element={<IngestHistory />} />`
- NOT in sidebar navigation (confirmed via grep of app-sidebar.tsx)

**FolderTreeNavigator details:**
- Zero consumers anywhere in codebase (only self-references in the file itself)
- Has a direct `invoke()` call from `@tauri-apps/api/core` (violates api.ts convention) -- further reason to delete
- Not registered in AppRouter.tsx

### Directories to Remove After Deletions

| Directory | Contents After Deletion | Action |
|-----------|------------------------|--------|
| src/utils/ | Only .DS_Store | Remove entire directory |
| src/components/ | Only .DS_Store | Remove entire directory |
| src/services/ai/ | Empty | Remove directory |
| src/types/ | Empty | Remove entire directory |
| src/pages/ | Empty (both files deleted) | Remove entire directory |

**Note:** `src/services/` may have other contents beyond `ai/` -- only remove `ai/` subdirectory unless parent is also empty.

### AppRouter Route Audit

Full review of AppRouter.tsx routes (per CONTEXT.md requirement to audit ALL routes):

| Route | Component | Source | Status |
|-------|-----------|--------|--------|
| /ingest/build | BuildProjectPage | @features/BuildProject | Active |
| /ingest/baker | Baker | @features/Baker | Active |
| /ingest/history | IngestHistory | ./pages/IngestHistory | **STUB -- delete** |
| /ai-tools/script-formatter | ScriptFormatter | @features/AITools | Active |
| /ai-tools/example-embeddings | ExampleEmbeddings | @features/AITools | Active |
| /upload/sprout | UploadSprout | @features/Upload | Active |
| /upload/posterframe | Posterframe | @features/Upload | Active |
| /upload/trello | UploadTrello | @features/Trello | Active |
| /upload/otter | UploadOtter | @features/Upload | Active |
| /premiere/premiere-plugins | PremierePluginManager | @features/Premiere | Active |
| /settings/general | Settings | @features/Settings | Active |
| /login | Login | @features/Auth | Active (behind auth gate) |
| /register | Register | @features/Auth | Active (behind auth gate) |

**Finding:** Only IngestHistory is a stub. All other routes load real components from feature barrels. No other stubs or placeholders detected.

### Stale Todo

- **File:** `.planning/todos/pending/2026-03-10-fix-eslint-boundaries-no-unknown-files-warning-on-lazy-routes.md`
- **Action:** Move to `.planning/todos/done/` (confirmed resolved per milestone audit)
- **Note:** The `done/` directory does not yet exist -- needs creation

## Architecture Patterns

### Deletion Order (Recommended)

1. **Wave 1 -- Orphaned files:** Delete all 12 legacy files (no rewiring needed since 0 consumers)
2. **Wave 2 -- Stub pages:** Delete IngestHistory.tsx and FolderTreeNavigator.tsx, update AppRouter.tsx
3. **Wave 3 -- Empty directories:** Remove src/utils/, src/components/, src/types/, src/pages/, src/services/ai/
4. **Wave 4 -- Todo closure:** Move stale todo from pending/ to done/
5. **Wave 5 -- Verification:** Run `bun run test` and `bun run eslint:fix`

### AppRouter.tsx Modification Pattern

Remove these specific lines from AppRouter.tsx:
- Line 36: `const IngestHistory = React.lazy(() => import('./pages/IngestHistory'))`
- Line 153: `<Route path="history" element={<IngestHistory />} />`

No other changes needed -- all remaining routes reference feature barrel imports.

### Anti-Patterns to Avoid
- **Deleting without verifying consumers first:** Although this research confirms 0 consumers, the planner should include a verification grep step as a safety gate before bulk deletion.
- **Leaving empty directories:** After file deletion, directories with only .DS_Store should be removed (use `rm -rf` or git clean).
- **Forgetting .DS_Store in git:** Ensure .DS_Store files are in .gitignore (they likely already are).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Consumer verification | Manual per-file grep | Single batch grep for all 12 filenames | Faster, less error-prone |
| Directory cleanup | Manual rmdir per dir | `rm -rf` on parent dirs after file deletion | Handles .DS_Store and nested empties |

## Common Pitfalls

### Pitfall 1: AI Services Confusion
**What goes wrong:** Confusing `src/services/ai/` (legacy, to delete) with `src/shared/services/ai/` (canonical, keep).
**Why it happens:** Same filenames in two locations.
**How to avoid:** Only delete from `src/services/ai/`. The `src/shared/services/ai/` files are actively imported by AITools and Settings modules.
**Warning signs:** If `bun run test` fails with missing module errors after deletion, wrong files were removed.

### Pitfall 2: Shared Utils vs Legacy Utils
**What goes wrong:** Confusing `src/utils/` (legacy, to delete) with `src/shared/utils/` (canonical, keep).
**Why it happens:** Similar directory names.
**How to avoid:** Only delete from `src/utils/`. The breadcrumbs utilities in `src/shared/utils/breadcrumbs/` are the canonical versions.

### Pitfall 3: Incomplete Route Cleanup
**What goes wrong:** Deleting the component file but leaving the lazy import or Route declaration in AppRouter.tsx.
**Why it happens:** Multiple locations to update.
**How to avoid:** Delete all three: (1) file, (2) lazy const declaration, (3) Route element.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts test section) |
| Config file | vite.config.ts (inline test config) |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map

This phase has no formal requirement IDs (tech debt cleanup). Validation is via:

| Behavior | Test Type | Automated Command | Exists? |
|----------|-----------|-------------------|---------|
| No broken imports after deletion | lint | `bun run eslint:fix` | Yes (existing) |
| No test failures after deletion | unit | `bun run test` | Yes (existing) |
| Deleted files no longer exist | smoke | `test ! -f src/utils/breadcrumbsValidation.ts` | Wave 0 (trivial shell check) |
| IngestHistory route removed | grep | `grep -r IngestHistory src/` returns empty | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test` + `bun run eslint:fix`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green + manual confirmation deleted files are gone

### Wave 0 Gaps
None -- existing test infrastructure (Vitest + ESLint) covers all validation needs. No new test files required for a deletion-only phase.

## Sources

### Primary (HIGH confidence)
- Filesystem inspection via Glob/Read tools -- confirmed all 12 files exist
- Grep consumer analysis -- confirmed 0 imports for all target files
- AppRouter.tsx read -- confirmed IngestHistory route location and all other routes are active
- app-sidebar.tsx grep -- confirmed IngestHistory has no sidebar nav entry
- Diff comparison -- confirmed src/services/ai/ files are identical to src/shared/services/ai/ canonical copies

### Secondary (MEDIUM confidence)
- .planning/v1.0-MILESTONE-AUDIT.md -- tech debt inventory aligns with findings

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- filesystem verified, all 12 files confirmed present
- Consumer analysis: HIGH -- grep verified zero imports for all targets
- Route audit: HIGH -- AppRouter.tsx fully read and analyzed
- Directory cleanup: HIGH -- contents of each directory confirmed

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- deletion targets are static dead code)
