---
phase: 13
slug: import-convention-alignment
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vite.config.ts test block) |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run`
- **After every plan wave:** Run `bun run test -- --run` + grep validation
- **Before `/gsd:verify-work`:** Full suite must be green + zero sub-path grep matches
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | SHRD-04 | grep | `grep -r "from '@shared/lib/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A | ✅ green |
| 13-01-02 | 01 | 1 | SHRD-06 | grep | `grep -r "from '@shared/utils/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A | ✅ green |
| 13-01-03 | 01 | 1 | SHRD-07 | grep | `grep -r "from '@shared/types/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A | ✅ green |
| 13-01-04 | 01 | 1 | SHRD-08 | grep | `grep -r "from '@shared/constants/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A | ✅ green |
| 13-01-05 | 01 | 1 | TREL-01 | grep | `grep "from '@features/Trello/api'" src/features/Trello/hooks/useAppendVideoInfo.ts` (expect 0) | N/A | ✅ green |
| 13-01-06 | 01 | 1 | ALL | unit | `bun run test -- --run` | Existing suite | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed; verification is grep-based (zero remaining violations) plus existing test suite green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dev server starts without errors | ALL | Vite dev server requires interactive terminal | Run `bun run dev`, verify no import resolution errors in console |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 6 verification checks pass. 127 test files (2064 tests) green. Zero sub-path import violations across all requirement categories.
