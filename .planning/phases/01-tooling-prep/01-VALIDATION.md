---
phase: 1
slug: tooling-prep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
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
| 01-01-01 | 01 | 1 | TOOL-05 | smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | TOOL-04 | smoke | `find src -name '*.refactored.*' -o -name '*.old.*'` | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | DOCS-03 | smoke | `find . -name '*.old.*' -o -name '*.refactored.*' -o -empty -type d` | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | TOOL-01 | smoke | `bun run eslint src 2>&1 \| grep boundaries` | N/A | ⬜ pending |
| 01-02-02 | 02 | 1 | TOOL-02 | smoke | `bun run knip` | N/A | ⬜ pending |
| 01-02-03 | 02 | 1 | TOOL-03 | smoke | `bun run dep-graph` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `brew install graphviz` — required before dependency-cruiser SVG output
- [ ] `src/features/.gitkeep` — directory must exist before alias resolution
- [ ] `src/shared/.gitkeep` — directory must exist before alias resolution

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stale file canonical version selection | TOOL-04 | Requires human judgment on which version to keep | Diff each .refactored/.old pair, choose canonical, verify imports update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
