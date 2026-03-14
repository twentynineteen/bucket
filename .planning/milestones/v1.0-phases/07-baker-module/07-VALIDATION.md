---
phase: 7
slug: baker-module
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| 07-01-01 | 01 | 1 | BAKR-01 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | BAKR-02 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |
| 07-01-03 | 01 | 1 | BAKR-03 | unit (contract) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `src/features/Baker/__contracts__/baker.contract.test.ts` — 47 contract tests for barrel shape, api shape, hook behavior, no-bypass, no-alert
- [x] `src/features/Baker/api.ts` — I/O boundary with 25 wrapper functions
- [x] `src/features/Baker/index.ts` — barrel with 7 runtime exports + 14 type exports

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baker page renders and scans drive | BAKR-01 | Full Tauri runtime needed | Launch app, navigate to Baker, verify scan works |
| Trello cross-module import works at runtime | BAKR-02 | Module resolution at build time | Run `bun run build` and verify no import errors |

---

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — all 47 tests green, 0 gaps
