# Roadmap: Bucket

## Milestones

- ✅ **v1.0 Deep Module Refactor** — Phases 1-14 (shipped 2026-03-13)

## Phases

<details>
<summary>✅ v1.0 Deep Module Refactor (Phases 1-14) — SHIPPED 2026-03-13</summary>

- [x] Phase 1: Tooling & Prep (2/2 plans) — completed 2026-03-08
- [x] Phase 2: Shared Infrastructure (4/4 plans) — completed 2026-03-09
- [x] Phase 3: Leaf Feature Modules (2/2 plans) — completed 2026-03-09
- [x] Phase 4: Upload Module (1/1 plan) — completed 2026-03-09
- [x] Phase 5: Settings Module (1/1 plan) — completed 2026-03-09
- [x] Phase 6: AI Tools Module (2/2 plans) — completed 2026-03-09
- [x] Phase 7: Baker Module (1/1 plan) — completed 2026-03-09
- [x] Phase 8: BuildProject Module (1/1 plan) — completed 2026-03-09
- [x] Phase 9: App Shell & Enforcement (3/3 plans) — completed 2026-03-10
- [x] Phase 10: API Bypass Fixes (2/2 plans) — completed 2026-03-10
- [x] Phase 11: Legacy & Stub Cleanup (1/1 plan) — completed 2026-03-10
- [x] Phase 12: Residual Cleanup (1/1 plan) — completed 2026-03-10
- [x] Phase 13: Import Convention Alignment (2/2 plans) — completed 2026-03-10
- [x] Phase 14: Dead Export Removal (1/1 plan) — completed 2026-03-10

Full details: .planning/milestones/v1.0-ROADMAP.md

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-14 | v1.0 | 24/24 | Complete | 2026-03-10 |

### Phase 1: fix stall on scanning during baker scan - not registering scan complete

**Goal:** Fix the Baker scan race condition where `baker_scan_complete` events are lost due to listener re-attachment on scanId state change, add elapsed timer UX, and add contract tests proving the fix
**Requirements**: [RACE-01, ERROR-01, NOBYPASS-01, TIMER-01]
**Depends on:** None
**Plans:** 2/2 plans complete

Plans:
- [ ] 01-01-PLAN.md — Fix useBakerScan mount-once pattern, update types, add contract tests
- [ ] 01-02-PLAN.md — Add elapsed timer to ScanResults and inline error display to BakerPage

### Phase 2: baker-ui-refresh

**Goal:** Redesign the Baker page so the project detail panel becomes the primary surface (full-height master-detail, real tabs, linked-resources hub, stale-breadcrumbs callout with lazy diff preview) and rebuild the batch confirmation dialog around a shared per-file diff-row language; demote legacy Trello cards with a Migrate action
**Requirements**: [LAYOUT-01, TABS-01, RESOURCES-01, DIFF-01, CALLOUT-01, DIALOG-01, CHIPS-01, LEGACY-01]
**Depends on:** None (visual spec approved: design-drafts/baker-redesign.html; full design context: .planning/phases/02-baker-ui-refresh/02-CONTEXT.md)
**Plans:** 1/1 plans complete

Plans:
- [x] 02-01 — Implemented full refresh (layout, tabs, diff components, dialog, legacy demotion) — see 02-01-SUMMARY.md — completed 2026-06-11
