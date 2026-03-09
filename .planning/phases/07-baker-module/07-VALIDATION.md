---
phase: 7
slug: baker-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | vite.config.ts (Vitest configured inline) |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | BAKR-01 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 | pending |
| 07-01-02 | 01 | 1 | BAKR-02 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 | pending |
| 07-01-03 | 01 | 1 | BAKR-03 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/features/Baker/__contracts__/baker.contract.test.ts` -- covers BAKR-01, BAKR-02, BAKR-03
- [ ] `src/features/Baker/api.ts` -- I/O boundary (must exist before contract tests run)
- [ ] `src/features/Baker/index.ts` -- barrel exports (must exist before contract tests run)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baker page renders and scans drive | BAKR-01 | Full Tauri runtime needed | Launch app, navigate to Baker, verify scan works |
| Trello cross-module import works at runtime | BAKR-02 | Module resolution at build time | Run `bun run build` and verify no import errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
