---
phase: 11
slug: legacy-stub-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 11-01-01 | 01 | 1 | SC-1 (orphaned files removed) | lint+test | `bun run test && bun run eslint:fix` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | SC-2 (IngestHistory resolved) | grep+lint | `bun run eslint:fix` | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | SC-3 (FolderTreeNavigator resolved) | grep | `test ! -f src/pages/FolderTreeNavigator.tsx` | ✅ | ⬜ pending |
| 11-01-04 | 01 | 1 | SC-4 (stale todo closed) | manual | Check file moved to done/ | ✅ | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
