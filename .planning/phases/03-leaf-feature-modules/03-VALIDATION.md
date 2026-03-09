---
phase: 3
slug: leaf-feature-modules
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | Inline in vite.config.ts |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run src/features/{Module}/__contracts__/`
- **After every plan wave:** Run `bun run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AUTH-01 | unit | `bun run test -- --run src/features/Auth/__contracts__/auth.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | AUTH-02 | unit | `bun run test -- --run src/features/Auth/__contracts__/auth.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | AUTH-03 | unit | `bun run test -- --run src/features/Auth/__contracts__/auth.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PREM-01 | unit | `bun run test -- --run src/features/Premiere/__contracts__/premiere.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | PREM-02 | unit | `bun run test -- --run src/features/Premiere/__contracts__/premiere.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | PREM-03 | unit | `bun run test -- --run src/features/Premiere/__contracts__/premiere.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | TREL-01 | unit | `bun run test -- --run src/features/Trello/__contracts__/trello.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | TREL-02 | unit | `bun run test -- --run src/features/Trello/__contracts__/trello.contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | TREL-03 | unit | `bun run test -- --run src/features/Trello/__contracts__/trello.contract.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/Auth/__contracts__/auth.contract.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `src/features/Premiere/__contracts__/premiere.contract.test.ts` — stubs for PREM-01, PREM-02, PREM-03
- [ ] `src/features/Trello/__contracts__/trello.contract.test.ts` — stubs for TREL-01, TREL-02, TREL-03

*Existing infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
