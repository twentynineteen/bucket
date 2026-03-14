---
phase: 11
slug: legacy-stub-cleanup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vite.config.ts inline test config) |
| **Config file** | vite.config.ts |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test` + `bun run eslint:fix`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SC-1 (orphaned files removed) | lint+test | `bun run test && bun run eslint:fix` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | SC-2 (IngestHistory resolved) | grep+lint | `bun run eslint:fix` | ✅ | ✅ green |
| 11-01-03 | 01 | 1 | SC-3 (FolderTreeNavigator resolved) | grep | `test ! -f src/pages/FolderTreeNavigator.tsx` | ✅ | ✅ green |
| 11-01-04 | 01 | 1 | SC-4 (stale todo closed) | shell | `test -f .planning/todos/done/2026-03-10-fix-eslint-boundaries-no-unknown-files-warning-on-lazy-routes.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No new test files needed -- this is a deletion-only phase. Validation relies on:
- Existing Vitest suite (detects broken imports)
- Existing ESLint config (detects boundary violations)
- Shell checks for file absence after deletion

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stale todo moved to done/ | SC-4 | File move, not code behavior | Verify `.planning/todos/done/` contains the todo file |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

---

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 requirements verified via automated shell checks + existing test suite (127 files, 2064 tests passing). No new test files needed — deletion-only phase validated by absence checks and passing infrastructure.
