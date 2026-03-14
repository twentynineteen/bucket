---
phase: 9
slug: app-shell-enforcement
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
validated: 2026-03-10
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
| 09-01-01 | 01 | 1 | SHEL-03 | grep/static | `grep -c "@components\|@hooks\|@lib\|@utils\|@constants\|@store\|@services\|@pages\|@context" tsconfig.json` = 0 | ✅ | ✅ green |
| 09-01-02 | 01 | 1 | SHEL-03 | grep/static | Verify zero old-alias imports in src/ | ✅ | ✅ green |
| 09-02-01 | 02 | 2 | SHEL-01 | grep/static | `grep -c "React.lazy" src/AppRouter.tsx` = 13 | ✅ | ✅ green |
| 09-02-02 | 02 | 2 | SHEL-02 | config check | Verify 3 boundary rules at "error" in eslint.config.js | ✅ | ✅ green |
| 09-02-03 | 02 | 2 | DOCS-04 | grep | Zero alert()/confirm() in src/ (excluding AlertDialog, confirmDialog, api.ts, tests) | ✅ | ✅ green |
| 09-03-01 | 03 | 3 | DOCS-02 | grep/static | JSDoc on all barrel exports in features/*/index.ts and shared/*/index.ts | ✅ | ✅ green |
| 09-03-02 | 03 | 3 | DOCS-01 | manual | CLAUDE.md has module map, dependency diagram, add-feature workflow | N/A | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Verify existing `tests/unit/AppRouter.test.tsx` still passes after lazy conversion
- [x] Extend Baker contract test pattern (`no alert() calls`) to all feature modules
- [x] No new test framework install needed -- Vitest already configured

*Existing infrastructure covers most phase requirements via grep/static analysis.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLAUDE.md has correct module map and dev workflows | DOCS-01 | Documentation content quality | Review CLAUDE.md for accuracy of module map, dependency diagram, and "add feature" workflow |
| Spinner appears in content area only during route loads | SHEL-01 | Visual/UX behavior | Navigate between routes in dev mode, verify sidebar/title bar stay visible |

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

| Requirement | Verification Method | Evidence | Status |
|-------------|-------------------|----------|--------|
| SHEL-01 | Static analysis + test | 13 `React.lazy()` calls in AppRouter.tsx; AppRouter.test.tsx passes (10 tests) | COVERED |
| SHEL-02 | Config check | eslint.config.js:110-134 — `element-types`, `no-unknown-files`, `no-unknown` all at `'error'` | COVERED |
| SHEL-03 | Static analysis | tsconfig.json has zero legacy aliases; grep confirms 0 old-alias imports in src/ | COVERED |
| DOCS-01 | Manual review | CLAUDE.md contains module map, dependency diagram, 9-step add-feature workflow | COVERED (manual) |
| DOCS-02 | Programmatic scan | All 227 barrel exports across 15 files have JSDoc one-liners (verified in Plan 03) | COVERED |
| DOCS-04 | Grep | Zero `alert()` or `window.confirm()` calls in src/ production code | COVERED |

### Additional Test Coverage

- `tests/unit/AppRouter.test.tsx` — 10 tests covering routing behavior and auto-updater logic
- All 16 contract test files across features and shared modules enforce barrel shapes and no-bypass rules
- `bun run eslint:fix` with boundary rules at error catches any future violations
