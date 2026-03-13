---
phase: 01-tooling-prep
plan: 02
subsystem: tooling
tags: [knip, dependency-cruiser, graphviz, dead-code, dependency-graph]

# Dependency graph
requires:
  - phase: none
    provides: existing codebase with package.json
provides:
  - knip dead code detection tool configured and baselined
  - dependency-cruiser visualization tool configured
  - baseline dead code report for tracking cleanup progress
affects: [02-shared-infrastructure, 03-leaf-features, 09-app-shell]

# Tech tracking
tech-stack:
  added: [knip@5.86.0, dependency-cruiser@17.3.8, graphviz@14.1.3]
  patterns: [dead-code-baseline-tracking, dependency-graph-visualization]

key-files:
  created:
    - knip.json
    - .dependency-cruiser.cjs
    - .planning/codebase/KNIP-BASELINE.md
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "Disabled knip vite/vitest/eslint plugins due to vite-plugin-monaco-editor load error -- using manual entry points instead"
  - "Added 12 ignoreDependencies for toolchain deps that knip cannot trace without plugin auto-detection"
  - "Color-coded dependency-cruiser dot reporter by directory (pages=red, components=green, hooks=blue, utils=yellow, services=purple, store=cyan)"

patterns-established:
  - "Knip baseline comparison: run knip before and after refactor phases to track cleanup progress"
  - "dep-graph as separate command, not in lint pipeline"

requirements-completed: [TOOL-02, TOOL-03]

# Metrics
duration: 6min
completed: 2026-03-08
---

# Phase 1 Plan 2: Knip Baseline & Dependency Graph Summary

**Knip dead code detection with 279-issue baseline (43 unused files, 145 unused exports) and color-coded dependency-cruiser graph visualization**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T14:31:19Z
- **Completed:** 2026-03-08T14:37:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed and configured knip with project-specific entry points and Tauri/toolchain ignores
- Created comprehensive baseline report documenting 279 issues across 8 categories for tracking cleanup progress
- Installed GraphViz and dependency-cruiser with color-coded SVG graph generation (694KB graph)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install and configure knip with baseline report** - `7ceae7f` (feat)
2. **Task 2: Install GraphViz and configure dependency-cruiser** - `af5122a` (feat)

## Files Created/Modified
- `knip.json` - Knip configuration with entry points, project scope, Tauri ignores, and toolchain dependency exceptions
- `.dependency-cruiser.cjs` - Dependency-cruiser config with circular dependency detection, orphan detection, and color-coded dot reporter
- `.planning/codebase/KNIP-BASELINE.md` - Baseline dead code report with summary counts, full output, and false positive analysis
- `package.json` - Added knip, dep-graph, and dep-graph:html scripts plus dev dependencies
- `.gitignore` - Added dependency-graph.svg and dependency-graph.html as generated artifacts

## Decisions Made
- Disabled knip's vite/vitest/eslint plugins because vite-plugin-monaco-editor uses a non-standard default export that knip's config parser cannot load. Used manual entry points for test files and eslint config instead.
- Added 12 entries to ignoreDependencies for Vite plugins, PostCSS toolchain, Prettier plugins, and Babel plugins that are used by config files but not directly imported in TypeScript source.
- Entry point corrected from src/main.tsx (plan default) to src/index.tsx (actual Vite entry per index.html).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed knip vite.config.ts load error**
- **Found during:** Task 1 (knip configuration)
- **Issue:** Knip failed with "monacoEditorPlugin is not a function" when loading vite.config.ts via the vite plugin
- **Fix:** Disabled vite/vitest/eslint plugins and manually specified entry points for tests and eslint config
- **Files modified:** knip.json
- **Verification:** `bun run knip` produces report without errors
- **Committed in:** 7ceae7f (Task 1 commit)

**2. [Rule 1 - Bug] Corrected entry point from src/main.tsx to src/index.tsx**
- **Found during:** Task 1 (knip configuration)
- **Issue:** Plan specified src/main.tsx as entry point but the actual Vite entry point is src/index.tsx per index.html
- **Fix:** Changed entry to src/index.tsx in knip.json
- **Files modified:** knip.json
- **Verification:** knip no longer reports src/index.tsx as unused file
- **Committed in:** 7ceae7f (Task 1 commit)

**3. [Rule 3 - Blocking] Created .dependency-cruiser.cjs manually instead of npx depcruise --init**
- **Found during:** Task 2 (dependency-cruiser setup)
- **Issue:** npx depcruise --init is interactive and cannot be run in non-interactive shell
- **Fix:** Created .dependency-cruiser.cjs manually with sensible defaults, circular dependency detection, and color-coded dot reporter
- **Files modified:** .dependency-cruiser.cjs
- **Verification:** `bun run dep-graph` generates valid 694KB SVG
- **Committed in:** af5122a (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for tool functionality. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both knip and dependency-cruiser are ready for use in all subsequent phases
- Baseline report provides reference point for tracking dead code cleanup
- Phase 1 is now complete (both plans done) -- ready for Phase 2: Shared Infrastructure

---
*Phase: 01-tooling-prep*
*Completed: 2026-03-08*
