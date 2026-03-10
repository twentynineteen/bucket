---
phase: 14
slug: dead-export-removal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run test -- --reporter=verbose <file>` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --reporter=verbose <affected contract test files>`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | (tech debt) | unit | `bun run test -- src/features/Premiere/__contracts__/premiere.contract.test.ts` | Exists (needs update) | ⬜ pending |
| 14-01-02 | 01 | 1 | (tech debt) | unit | `bun run test -- src/features/AITools/__contracts__/aitools.contract.test.ts` | Exists (no change) | ⬜ pending |
| 14-01-03 | 01 | 1 | (tech debt) | unit | `bun run test -- src/features/Trello/__contracts__/trello.contract.test.ts` | Exists (needs update) | ⬜ pending |
| 14-01-04 | 01 | 1 | (tech debt) | unit | `bun run test -- src/shared/services/__contracts__/services.contract.test.ts` | Exists (needs update) | ⬜ pending |
| 14-01-05 | 01 | 1 | (tech debt) | integration | `bun run test` | Existing | ⬜ pending |
| 14-01-06 | 01 | 1 | (tech debt) | smoke | `bun run build` | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Contract tests already exist for every affected module.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dev server starts without errors | (tech debt) | Smoke test requiring running process | Run `bun run dev` and verify no import errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
