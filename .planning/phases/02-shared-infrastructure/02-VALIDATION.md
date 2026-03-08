---
phase: 2
slug: shared-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project-configured) |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `bunx vitest run --reporter=verbose src/shared` |
| **Full suite command** | `bun run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run --reporter=verbose src/shared`
- **After every plan wave:** Run `bun run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | SHRD-01 | unit | `bunx vitest run src/shared/hooks/__contracts__/hooks.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | SHRD-02 | unit | `bunx vitest run src/shared/ui/__contracts__/ui.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | SHRD-03 | unit | `bunx vitest run src/shared/store/__contracts__/store.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | SHRD-04 | unit | `bunx vitest run src/shared/lib/__contracts__/lib.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 0 | SHRD-05 | unit | `bunx vitest run src/shared/services/__contracts__/services.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 0 | SHRD-06 | unit | `bunx vitest run src/shared/utils/__contracts__/utils.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 0 | SHRD-07 | unit | `bunx vitest run src/shared/types/__contracts__/types.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 0 | SHRD-08 | unit | `bunx vitest run src/shared/constants/__contracts__/constants.contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-09 | 01 | 0 | SHRD-09 | unit | `bunx vitest run src/shared/*/__contracts__/ --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/hooks/__contracts__/hooks.contract.test.ts` — stubs for SHRD-01
- [ ] `src/shared/ui/__contracts__/ui.contract.test.ts` — stubs for SHRD-02
- [ ] `src/shared/store/__contracts__/store.contract.test.ts` — stubs for SHRD-03
- [ ] `src/shared/lib/__contracts__/lib.contract.test.ts` — stubs for SHRD-04
- [ ] `src/shared/services/__contracts__/services.contract.test.ts` — stubs for SHRD-05
- [ ] `src/shared/utils/__contracts__/utils.contract.test.ts` — stubs for SHRD-06
- [ ] `src/shared/types/__contracts__/types.contract.test.ts` — stubs for SHRD-07
- [ ] `src/shared/constants/__contracts__/constants.contract.test.ts` — stubs for SHRD-08

*Existing infrastructure covers framework. Wave 0 creates contract test stubs and shared sub-module directories.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vite HMR not degraded | Success Criteria 5 | Performance is observational | Start `bun run dev:tauri`, edit a shared module file, verify HMR update < 2s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
