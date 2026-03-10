---
phase: 12
slug: residual-cleanup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run test -- --run tests/unit/hooks/useWindowState.test.ts tests/unit/AppRouter.test.tsx` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run tests/unit/hooks/useWindowState.test.ts tests/unit/AppRouter.test.tsx`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SC-1 | unit | `bun run test -- --run tests/unit/hooks/useWindowState.test.ts` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | SC-3 | smoke | `test ! -d src/hooks` | N/A | ✅ green |
| 12-01-03 | 01 | 1 | SC-5 | smoke | `test ! -f src/shared/ui/theme/ThemeImport.tsx` | N/A | ✅ green |
| 12-01-04 | 01 | 2 | SC-2 | manual | Visual check — sidebar entry present at /upload/otter | N/A | ✅ green |
| 12-01-05 | 01 | 2 | SC-4 | unit | `bun run test -- --run tests/unit/AppRouter.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No new test files, fixtures, or framework installs needed. Only import path updates in existing test files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UploadOtter sidebar entry visible | SC-2 | Sidebar rendering requires visual inspection | 1. Open app 2. Verify "Transcription" appears in "Upload content" group after Trello 3. Click and verify navigation to /upload/otter |

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
