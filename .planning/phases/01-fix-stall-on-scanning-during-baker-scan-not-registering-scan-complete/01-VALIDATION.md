---
phase: 1
slug: fix-stall-on-scanning-during-baker-scan-not-registering-scan-complete
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vite.config.ts` (test section, line 60-66) |
| **Quick run command** | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts` |
| **Full suite command** | `bun run test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts`
- **After every plan wave:** Run `bun run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | RACE-01 | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "race condition"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | ERROR-01 | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "error event"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | NOBYPASS-01 | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "no-bypass"` | ✅ partial | ⬜ pending |
| 01-01-04 | 01 | 1 | TIMER-01 | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "timestamp"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `src/features/Baker/__contracts__/baker.contract.test.ts` — race condition regression, error path, timestamp tracking
- [ ] No new test files needed — extend existing contract test file

*Existing infrastructure covers framework and config. Only new test cases needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Elapsed timer visually updates every second during scan | TIMER-01 | Visual rendering timing | 1. Start scan 2. Observe running counter increments every ~1s 3. Verify stops on completion |
| Error displays inline (not toast) | ERROR-01 | Visual placement verification | 1. Trigger scan error 2. Verify error appears in scan area, not as toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
