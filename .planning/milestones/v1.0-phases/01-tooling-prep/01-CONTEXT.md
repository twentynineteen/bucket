# Phase 1: Tooling & Prep - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Install enforcement tools (ESLint boundaries, knip, dependency-cruiser), resolve stale files and artifacts, and configure new path aliases (`@features/*`, `@shared/*`). The codebase should be clean and instrumented for the module migration that follows. No actual module migration happens in this phase.

</domain>

<decisions>
## Implementation Decisions

### Boundary rule rollout
- Start eslint-plugin-boundaries rules as **warnings** (not errors) -- promote to errors in Phase 9 after all modules migrate
- Define zones for **target dirs only**: `@features/*` and `@shared/*` -- legacy dirs (src/pages/, src/hooks/, etc.) are unconstrained until they migrate
- Features **can import from other features**, but only through their barrel (index.ts) -- matches roadmap dependency graph (Baker -> Trello, BuildProject -> Premiere)
- Install **both** eslint-plugin-boundaries (lint-time enforcement) and dependency-cruiser (visual graph generation) -- different purposes, both required by TOOL-01 and TOOL-03

### Dead code strategy
- **Baseline report only** -- run knip, produce report, do not delete dead code in this phase
- Configure knip with proper **entry files and project patterns** to minimize false positives (handle Tauri invoke() strings, barrel re-exports, test setup files)
- Keep knip as a **separate command** (`bun run knip`) -- not part of the lint pipeline, too slow and informational for every lint run
- **Commit baseline** as `.planning/codebase/KNIP-BASELINE.md` for tracking cleanup progress across phases

### Stale file resolution
- **Diff and decide** each .refactored/.old file pair -- Claude proposes canonical version based on import graph and code quality, user approves
- 4 known stale files: `useCreateProject.refactored.ts`, `useUploadTrello.refactored.ts`, `AddCardDialog.old.tsx`, `AddVideoDialog.old.tsx`
- **Full stale scan** beyond .refactored/.old -- also find orphaned spec files, empty directories, unused test fixtures
- **Delete completed specs** -- if a spec's feature is merged and working, delete the spec file (git history preserves it)

### Alias migration plan
- **Leave old aliases untouched** (`@hooks/*`, `@pages/*`, `@components/*`, etc.) -- they keep working normally until each feature migrates, removed in Phase 9
- `@features/*` maps to **new `src/features/` directory** -- clean separation from legacy src/pages/
- `@shared/*` maps to **new `src/shared/` directory** -- Phase 2 builds sub-modules there
- **Create both directories now** with `.gitkeep` files so aliases resolve and structure is visible -- confirms end-to-end alias resolution in Phase 1

### Claude's Discretion
- Exact eslint-plugin-boundaries zone/element configuration syntax
- Dependency-cruiser configuration and output format
- Knip configuration details (entry files, ignore patterns, plugins)
- Which stale spec files qualify as "completed" for deletion

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ESLint 9 flat config at `eslint.config.js` -- already has react-hooks, react-refresh, complexity rules; boundary plugin integrates as another config block
- `vite-tsconfig-paths` plugin already resolves aliases from tsconfig -- new aliases just need tsconfig + vite entries
- `tsconfig.json` has 12 existing path aliases -- new `@features/*` and `@shared/*` follow the same pattern

### Established Patterns
- Complexity/quality rules already use warn-then-promote pattern (complexity, max-depth, max-params set to warn with targets noted) -- boundary rules follow same approach
- Import sorting handled by prettier plugin -- no conflict with boundary rules

### Integration Points
- `tsconfig.json` paths section: add `@features/*` and `@shared/*` entries
- `eslint.config.js`: add eslint-plugin-boundaries config block
- `package.json` scripts: add `knip` and `dep-graph` commands
- `vite.config.ts`: aliases auto-resolved by vite-tsconfig-paths (no manual vite config needed)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches for tool configuration.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 01-tooling-prep*
*Context gathered: 2026-03-07*
