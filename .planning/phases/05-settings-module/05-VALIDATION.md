---
phase: 5
slug: settings-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, configured in vite.config.ts) |
| **Config file** | vite.config.ts `test` block |
| **Quick run command** | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run src/features/Settings/`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | STNG-01 | unit (shape) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | STNG-02 | unit (behavioral) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | STNG-03 | unit (shape) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | STNG-04 | unit (shape+behavioral) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/Settings/__contracts__/settings.contract.test.ts` — stubs for STNG-01, STNG-02, STNG-03, STNG-04
- [ ] No framework install needed — Vitest already configured
- [ ] No shared fixtures needed — contract tests are self-contained with vi.mock()

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hash-based scroll navigation works | STNG-02 | scrollIntoView behavior requires real browser | 1. Navigate to Settings 2. Click sidebar links (#ai-models, #appearance, etc.) 3. Verify page scrolls to correct section |
| Accordion open/close visual behavior | STNG-02 | Visual animation and layout shift | 1. Open Settings 2. Click each accordion header 3. Verify smooth expand/collapse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
