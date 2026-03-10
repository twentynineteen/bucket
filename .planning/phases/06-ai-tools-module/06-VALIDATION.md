---
phase: 6
slug: ai-tools-module
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `bun run test -- --run src/features/AITools` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run src/features/AITools`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AITL-01 | unit | `bun run test -- --run src/features/AITools` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | AITL-02 | unit | `bun run test -- --run src/features/AITools` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | AITL-03 | contract | `bun run test -- --run src/features/AITools` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/features/AITools/__contracts__/aitools.contract.test.ts` — 19 contract tests for barrel shape, api shape, hook behavior, no-bypass
- [x] Test infrastructure already exists (vitest configured project-wide)

*All Wave 0 tests created and passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ScriptFormatter page renders correctly after migration | AITL-01 | Visual verification of layout/styling | Navigate to AI > Script Formatter, verify all steps render |
| ExampleEmbeddings page renders correctly after migration | AITL-01 | Visual verification of layout/styling | Navigate to AI > Example Embeddings, verify list/upload/delete work |

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

**Approval:** approved — all 19 tests green, 0 gaps
