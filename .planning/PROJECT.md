# Bucket — Deep Module Refactor

## What This Is

A systematic restructuring of the Bucket desktop video editing workflow application (Tauri + React/TypeScript) into deep modules with clear public interfaces, fresh contract tests, and updated documentation. Each feature (BuildProject, Baker, AI Tools, Upload/Integrations) and shared code layer gets reorganized feature-by-feature into self-contained modules that are easy for both humans and AI agents to navigate and modify.

## Core Value

Every feature module has a simple public interface that fully describes its capabilities — nothing reaches past the boundary, and contract tests lock down the behavior.

## Current Milestone: v1.0 Deep Module Refactor

**Goal:** Restructure the entire frontend codebase into deep modules with barrel exports, API layers, and contract tests — feature by feature.

**Target features:**
- BuildProject module
- Baker module
- AI Tools module (ScriptFormatter, ExampleEmbeddings)
- Upload/Integrations module (Sprout, Trello, Posterframe, Settings)
- Shared code modules (components, hooks, utils, store, lib, services)
- Documentation overhaul (CLAUDE.md, inline JSDoc, architecture docs, stale cleanup)
- Fresh test suite (delete existing tests, write contract tests per module)

## Requirements

### Validated

- ✓ BuildProject workflow — file selection, camera assignment, project creation, Premiere integration — existing
- ✓ Baker workflow — drive scanning, breadcrumbs management, batch operations — existing
- ✓ AI Tools — script formatting with RAG, example embeddings management — existing
- ✓ Sprout Video upload with posterframe generation — existing
- ✓ Trello card integration — existing
- ✓ Multi-theme system (8 themes, live preview, persistence) — existing
- ✓ macOS native window styling (transparent title bar, vibrancy, traffic lights) — existing
- ✓ Auth system (login, register, JWT) — existing
- ✓ Settings page (API keys, appearance, connected apps) — existing

### Active

- [ ] Reorganize BuildProject into deep module (barrel exports + API layer + contract tests)
- [ ] Reorganize Baker into deep module
- [ ] Reorganize AI Tools into deep module
- [ ] Reorganize Upload/Integrations into deep module
- [ ] Reorganize shared code (components, hooks, utils, store, lib, services) into deep modules
- [ ] Delete all existing tests, write fresh contract tests per module
- [ ] Update CLAUDE.md to reflect new module structure
- [ ] Add JSDoc on all public API surfaces
- [ ] Update/create architecture documentation in docs/
- [ ] Clean up stale specs, orphaned markdown files, .old files, .refactored files
- [ ] Fix concerns identified in codebase audit (dead code, native alerts, stub features)

### Out of Scope

- New feature development — this milestone is purely structural
- Rust backend restructuring — backend already has reasonable module boundaries (baker/, commands/, state/)
- Performance optimization — separate concern, not part of this refactor
- Auth system security hardening — important but separate milestone
- Offline support — future feature, not structural

## Context

The codebase has grown organically through 9+ phases of feature development. Features are spread across `src/pages/`, `src/components/`, and `src/hooks/` without clear module boundaries. There are 80+ hooks in a flat directory, components split between `pages/` and `components/` for the same feature, and no enforcement of import boundaries.

Key problems the refactor addresses:
- **No module boundaries** — any file can import from any other file's internals
- **80+ hooks in flat directory** — impossible to tell which hooks belong to which feature
- **Components split across directories** — Baker components in both `src/pages/Baker/` and `src/components/Baker/`
- **Stale artifacts** — `.old.tsx` files, `.refactored.ts` files, orphaned specs
- **27+ native alert() calls** — should use Sonner toasts
- **Tests are sparse and disconnected** — only 7 test files for dozens of components
- **Documentation drift** — CLAUDE.md references stale phase information

Reference architecture: [How to Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love) — deep modules with simple interfaces, progressive disclosure of complexity, contract tests as behavioral locks.

**Target module structure per feature:**
```
src/features/BuildProject/
├── index.ts              # Barrel exports — the ONLY import path
├── api.ts                # API layer (Tauri commands + state)
├── components/           # Internal components
├── hooks/                # Internal hooks
├── types.ts              # Internal types
└── __contracts__/        # Contract tests validating public interface
```

## Constraints

- **Tech stack**: No framework changes — React, Tauri, Zustand, TanStack Query, XState stay
- **No feature regression**: Every existing capability must work after restructuring
- **Import boundary enforcement**: All cross-module imports must go through barrel exports
- **Incremental migration**: One feature module at a time, not a big bang rewrite
- **Fresh tests only**: Delete existing test suite, write contract tests from scratch per module

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Deep modules with barrel + API + contracts | Article recommendation, strongest boundary enforcement | — Pending |
| Feature-by-feature migration | Reduces risk vs. big bang, each feature independently shippable | — Pending |
| Fresh test suite (delete all existing) | Existing tests sparse and disconnected from module boundaries, cleaner to start fresh | — Pending |
| `src/features/` as new module root | Separates deep modules from legacy flat structure during migration | — Pending |
| Keep Rust backend as-is | Already has reasonable module structure (baker/, commands/, state/) | — Pending |

---
*Last updated: 2026-03-07 after initialization*
