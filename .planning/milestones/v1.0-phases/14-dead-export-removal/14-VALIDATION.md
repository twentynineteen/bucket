---
phase: 14
slug: dead-export-removal
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
validated: 2026-03-10
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
| 14-01-01 | 01 | 1 | Premiere barrel → 1 export | unit | `bun run test -- src/features/Premiere/__contracts__/premiere.contract.test.ts` | Exists (updated) | ✅ green |
| 14-01-02 | 01 | 1 | AITools barrel → 5 exports | unit | `bun run test -- src/features/AITools/__contracts__/aitools.contract.test.ts` | Exists | ✅ green |
| 14-01-03 | 01 | 1 | Trello barrel → 25 exports | unit | `bun run test -- src/features/Trello/__contracts__/trello.contract.test.ts` | Exists (updated) | ✅ green |
| 14-01-04 | 01 | 1 | Services barrel → 5 exports | unit | `bun run test -- src/shared/services/__contracts__/services.contract.test.ts` | Exists (updated) | ✅ green |
| 14-01-05 | 01 | 1 | Full suite green | integration | `bun run test` | Existing | ✅ green |
| 14-01-06 | 01 | 1 | Build succeeds | smoke | `bun run build` | Verified during execution | ✅ green |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 6 task requirements verified via existing contract tests (68 tests, 4 test files). Zero dead code references remain in `src/`.
