---
phase: 1
slug: tooling-prep
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-07
validated: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | vite.config.ts (test section) |
| **Quick run command** | `bun run eslint src` |
| **Full suite command** | `bun run test:run && bun run eslint src` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run eslint src`
- **After every plan wave:** Run `bun run test:run && bun run eslint src`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | TOOL-05 | smoke | `bunx tsc --noEmit` | N/A | ✅ green |
| 01-01-02 | 01 | 1 | TOOL-04 | smoke | `glob src/**/*.refactored.* src/**/*.old.*` | N/A | ✅ green |
| 01-01-03 | 01 | 1 | DOCS-03 | smoke | `glob src/**/*.old.* src/**/*.refactored.*` | N/A | ✅ green |
| 01-02-01 | 02 | 1 | TOOL-01 | smoke | `bun run eslint src` | N/A | ✅ green |
| 01-02-02 | 02 | 1 | TOOL-02 | smoke | `bun run knip` | N/A | ✅ green |
| 01-02-03 | 02 | 1 | TOOL-03 | smoke | `bun run dep-graph` | N/A | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `brew install graphviz` — required before dependency-cruiser SVG output
- [x] `src/features/.gitkeep` — directory must exist before alias resolution
- [x] `src/shared/.gitkeep` — directory must exist before alias resolution

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stale file canonical version selection | TOOL-04 | Requires human judgment on which version to keep | Diff each .refactored/.old pair, choose canonical, verify imports update |

*Note: TOOL-04 manual step completed during Phase 1 execution — all 4 stale files confirmed unused via import analysis and deleted.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Notes:** Phase 1 is a tooling/configuration phase. All 6 requirements (TOOL-01 through TOOL-05, DOCS-03) are verified via smoke tests — run the configured tool and confirm it produces expected output. All smoke commands pass green. No persistent test files needed; verification is inherent in the tool commands themselves.
