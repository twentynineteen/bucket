---
phase: 10
slug: api-bypass-fixes
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project configured) |
| **Config file** | vite.config.ts (inline vitest config) |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run`
- **After every plan wave:** Run `bun run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | BAKR-02 | no-bypass | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |
| 10-01-02 | 01 | 1 | BAKR-01 | shape | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |
| 10-01-03 | 01 | 1 | BAKR-03 | no-bypass | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | ✅ | ✅ green |
| 10-02-01 | 02 | 1 | — | no-bypass | `bun run test -- --run src/features/Auth/__contracts__/ src/features/Premiere/__contracts__/ src/features/Upload/__contracts__/ src/features/Settings/__contracts__/ src/features/AITools/__contracts__/` | ✅ | ✅ green |
| 10-02-02 | 02 | 1 | — | no-bypass | `bun run test -- --run src/features/Trello/__contracts__/trello.contract.test.ts` | ✅ | ✅ green |
| 10-03-01 | 02 | 2 | — | no-bypass | `bun run test -- --run` | ✅ | ✅ green |
| 10-04-01 | 02 | 2 | BAKR-01, BAKR-02, BAKR-03 | bookkeeping | manual file check | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Contract test files already exist for all 8 modules.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SUMMARY 07-01 lists BAKR-01/02/03 | BAKR-01/02/03 | YAML frontmatter check | Verify `requirements_completed` in SUMMARY 07-01 includes BAKR-01, BAKR-02, BAKR-03 |
| REQUIREMENTS.md checkboxes checked | BAKR-01/02/03 | Markdown file check | Verify BAKR-01/02/03 have checked checkboxes and status Complete |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

---

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 7 tasks verified with automated tests or manual file checks. Full test suite: 127 files, 2064 tests green. All 8 feature modules have comprehensive recursive no-bypass contract tests.
