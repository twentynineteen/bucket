---
phase: 9
slug: app-shell-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vite.config.ts) |
| **Config file** | vite.config.ts (test section, lines 60-66) |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run`
- **After every plan wave:** Run `bun run test` + `bun run eslint:fix` + `bun run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | SHEL-03 | grep/static | `grep -c "@components\|@hooks\|@lib\|@utils\|@constants\|@store\|@services\|@pages\|@context" tsconfig.json` = 0 | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | SHEL-03 | grep/static | Verify zero old-alias imports in src/ | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | SHEL-01 | grep/static | `grep -c "React.lazy" src/AppRouter.tsx` = 13 | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | SHEL-02 | config check | Verify 3 boundary rules at "error" in eslint.config.js | ❌ W0 | ⬜ pending |
| 09-02-03 | 02 | 2 | DOCS-04 | grep | Zero alert()/confirm() in src/ (excluding AlertDialog, confirmDialog, api.ts, tests) | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | DOCS-02 | grep/static | JSDoc on all barrel exports in features/*/index.ts and shared/*/index.ts | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 3 | DOCS-01 | manual | CLAUDE.md has module map, dependency diagram, add-feature workflow | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify existing `tests/unit/AppRouter.test.tsx` still passes after lazy conversion
- [ ] Extend Baker contract test pattern (`no alert() calls`) to all feature modules
- [ ] No new test framework install needed -- Vitest already configured

*Existing infrastructure covers most phase requirements via grep/static analysis.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLAUDE.md has correct module map and dev workflows | DOCS-01 | Documentation content quality | Review CLAUDE.md for accuracy of module map, dependency diagram, and "add feature" workflow |
| Spinner appears in content area only during route loads | SHEL-01 | Visual/UX behavior | Navigate between routes in dev mode, verify sidebar/title bar stay visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
