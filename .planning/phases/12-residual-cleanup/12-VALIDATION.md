---
phase: 12
slug: residual-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 12-01-01 | 01 | 1 | SC-1 | unit | `bun run test -- --run tests/unit/hooks/useWindowState.test.ts` | ✅ (needs import update) | ⬜ pending |
| 12-01-02 | 01 | 1 | SC-3 | smoke | `ls src/hooks/ 2>/dev/null` (should not exist) | N/A | ⬜ pending |
| 12-01-03 | 01 | 1 | SC-5 | smoke | `ls src/shared/ui/theme/ThemeImport.tsx 2>/dev/null` (should not exist) | N/A | ⬜ pending |
| 12-01-04 | 01 | 2 | SC-2 | manual | Visual check — sidebar entry present at /upload/otter | N/A | ⬜ pending |
| 12-01-05 | 01 | 2 | SC-4 | unit | `bun run test -- --run tests/unit/AppRouter.test.tsx` | ✅ (needs mock updates) | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
