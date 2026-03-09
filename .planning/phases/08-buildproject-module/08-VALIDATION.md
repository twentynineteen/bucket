---
phase: 8
slug: buildproject-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (current) |
| **Config file** | Inline in vite.config.ts |
| **Quick run command** | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` |
| **Full suite command** | `bun run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts`
- **After every plan wave:** Run `bun run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | BLDP-01, BLDP-02, BLDP-03, BLDP-04 | unit (shape + no-bypass) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | BLDP-01 | unit (shape) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | BLDP-02 | unit (shape) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | BLDP-03 | unit (existence) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-05 | 01 | 1 | BLDP-04 | unit (contract) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` — contract tests for BLDP-01, BLDP-02, BLDP-03, BLDP-04
- [ ] `src/features/BuildProject/types.ts` — extracted types prerequisite for clean imports

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App renders BuildProject page | BLDP-01 | Visual verification | Navigate to BuildProject, confirm page loads without errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
