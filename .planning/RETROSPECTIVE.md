# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Deep Module Refactor

**Shipped:** 2026-03-13
**Phases:** 14 | **Plans:** 24

### What Was Built
- 8 deep feature modules (Auth, Trello, Premiere, Upload, Settings, AITools, Baker, BuildProject) with barrel exports, api.ts I/O boundaries, and contract tests
- 8 shared sub-modules (lib, constants, types, utils, store, services, hooks, ui) with barrels and contract tests
- ESLint boundary enforcement at error level, React.lazy() routes, JSDoc on 227+ exports
- 5 gap-closure phases (10-14) addressing api.ts bypasses, legacy stubs, import conventions, dead exports

### What Worked
- Dependency-ordered phase execution (tooling → shared → leaf → mid-tier → complex → shell) prevented rework
- api.ts as single I/O boundary per module — clean mock points, easy contract testing
- Python bulk import rewrite scripts for large-scale import path migration (~190 files)
- Contract tests with shape + behavioral + no-bypass validation caught real issues
- Gap-closure phases (10-14) efficiently resolved audit findings without disrupting architecture

### What Was Inefficient
- Initial ROADMAP checkboxes for some phases were inconsistent (marked unchecked despite being complete)
- SUMMARY.md files lacked one_liner frontmatter field — required manual accomplishment extraction
- First milestone audit triggered 5 additional phases (10-14) — earlier integration checking could have prevented some
- Baker requirement bookkeeping (BAKR-01/02/03) was assigned to Phase 7 in ROADMAP but needed Phase 10 to fix SUMMARY frontmatter

### Patterns Established
- Feature module anatomy: api.ts + types.ts + index.ts barrel + __contracts__/ + components/ + hooks/ + internal/
- No-bypass contract tests with recursive fs.readdirSync scanning all subdirectories
- Tauri-dependent code excluded from barrels (direct imports documented in CLAUDE.md)
- AlertDialog state pattern: hooks expose {pendingIndex, request, confirm, cancel}
- Dynamic import() with @vite-ignore for lazy-loading Tauri plugins in shared code

### Key Lessons
1. Run milestone audit earlier — gap-closure phases could have been planned upfront if integration was checked after Phase 9
2. Barrel exclusions for Tauri-dependent hooks are pragmatic and necessary — document the convention clearly
3. Bulk import migration is best done with scripts, not manual find-and-replace
4. Contract tests should verify both what IS exported and what IS NOT (internal leak detection)

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning/verification
- Total execution time: ~4 hours across 24 plans
- Average plan: 10 min execution
- Notable: Phase 02 (shared infrastructure) was the longest at 57 min due to 210+ file import rewrites

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 14 |
| Plans | 24 |
| Duration (days) | 3 |
| Requirements | 47 |
| Satisfaction | 100% |
| Gap-closure phases | 5 |
