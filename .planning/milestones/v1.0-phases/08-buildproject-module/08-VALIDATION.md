---
phase: 8
slug: buildproject-module
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
validated: 2026-03-10
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
| 08-01-01 | 01 | 0 | BLDP-01, BLDP-02, BLDP-03, BLDP-04 | unit (shape + no-bypass) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | BLDP-01 | unit (shape) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ✅ | ✅ green |
| 08-01-03 | 01 | 1 | BLDP-02 | unit (shape) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ✅ | ✅ green |
| 08-01-04 | 01 | 1 | BLDP-03 | unit (existence) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ✅ | ✅ green |
| 08-01-05 | 01 | 1 | BLDP-04 | unit (contract) | `bun run test -- --run src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` — contract tests for BLDP-01, BLDP-02, BLDP-03, BLDP-04
- [x] `src/features/BuildProject/types.ts` — extracted types prerequisite for clean imports

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App renders BuildProject page | BLDP-01 | Visual verification | Navigate to BuildProject, confirm page loads without errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

### Coverage Detail

| Requirement | Test File | Tests | Status |
|-------------|-----------|-------|--------|
| BLDP-01 | `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | Barrel shape (8 tests), No-bypass (4 tests) | COVERED |
| BLDP-02 | `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | api.ts shape (17 tests), No-bypass (4 tests) | COVERED |
| BLDP-03 | `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | XState colocation (3 tests) | COVERED |
| BLDP-04 | `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | Self-referential: 32 contract tests exist and pass | COVERED |

### Additional Test Coverage (not required by Nyquist, but present)

- `tests/unit/hooks/useFileOperations.test.tsx` — behavioral tests for file operations
- `tests/unit/hooks/useProjectFolders.test.tsx` — behavioral tests for folder management
- `tests/unit/hooks/useProjectValidation.test.tsx` — behavioral tests for validation logic
- `tests/unit/hooks/useTrelloVideoInfo.test.tsx` — integration with Trello module
- `tests/unit/hooks/useProjectBreadcrumbs.test.tsx` — integration with Baker module
- `tests/unit/components/CreateProjectStep.test.tsx` — component rendering tests
- `tests/unit/pages/BuildProject/ProjectFileList.test.tsx` — component rendering tests
