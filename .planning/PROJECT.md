# Bucket — Desktop Video Editing Workflow

## What This Is

A desktop video editing workflow application (Tauri + React/TypeScript) with a fully modularized frontend architecture. 8 deep feature modules (Auth, Trello, Premiere, Upload, Settings, AITools, Baker, BuildProject) each have barrel exports, api.ts I/O boundaries, and contract tests. Shared infrastructure provides stable barrels for lib, constants, types, utils, store, services, hooks, and UI primitives.

## Core Value

Every feature module has a simple public interface that fully describes its capabilities — nothing reaches past the boundary, and contract tests lock down the behavior.

## Requirements

### Validated

- ✓ ESLint boundary enforcement at error level — v1.0
- ✓ All 8 feature modules with barrel exports + api.ts + contract tests — v1.0
- ✓ All shared sub-modules with barrel exports + contract tests — v1.0
- ✓ React.lazy() routes for all features — v1.0
- ✓ JSDoc on all 227+ barrel exports — v1.0
- ✓ Zero alert()/confirm() calls (Sonner toasts + Radix dialogs) — v1.0
- ✓ Zero legacy path aliases — v1.0
- ✓ Zero sub-path barrel bypasses — v1.0

### Active

(No active requirements — run `/gsd:new-milestone` to define next milestone)

### Out of Scope

- New feature development — structural refactor only (completed)
- Rust backend restructuring — already has reasonable module boundaries
- Performance optimization — separate concern
- Auth security hardening — important but separate milestone (auth guard currently bypassed with hardcoded `isAuthenticated = true`)
- Store decomposition — Zustand god store → feature-scoped stores (deferred to v2)
- Offline support — future feature

## Context

Shipped v1.0 Deep Module Refactor: 40,091 LOC TypeScript across 8 feature modules and 8 shared sub-modules.
Tech stack: Tauri 2.0, React 18.3, TypeScript 5.7, Vite 6.1, Zustand, TanStack Query, XState.
193 commits over 3 days (2026-03-08 to 2026-03-10).

Known tech debt:
- Auth guard bypass (AppRouter hardcodes isAuthenticated = true)
- Hardcoded Trello board ID in 4 files
- Baker uses both plugin-shell and plugin-opener for different use cases

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Deep modules with barrel + API + contracts | Strongest boundary enforcement per AI-friendly codebase article | ✓ Good — clean interfaces, easy navigation |
| Feature-by-feature migration | Reduces risk vs. big bang | ✓ Good — each phase independently verifiable |
| Fresh contract tests (deleted existing) | Existing tests sparse and disconnected | ✓ Good — 198+ contract tests with shape + behavioral + no-bypass |
| `src/features/` as module root | Separates deep modules from legacy flat structure | ✓ Good — clean separation, all legacy removed |
| Keep Rust backend as-is | Already has reasonable module boundaries | ✓ Good — focus stayed on frontend |
| api.ts as single I/O boundary per module | Single mock point for testing, clear separation of concerns | ✓ Good — zero direct Tauri imports in components/hooks |
| No barrel for shared/ui/ | Direct imports prevent test environment crashes from Tauri runtime deps | ✓ Good — pragmatic exception |
| ESLint boundaries warn → error in Phase 9 | Build trust in boundaries before enforcing | ✓ Good — zero violations when promoted |
| Tauri-dependent hooks excluded from barrels | Prevents test crashes from runtime deps | ✓ Good — direct imports documented in CLAUDE.md |
| Dynamic import() for Tauri plugin-store | Lazy-loads to prevent test environment crashes | ✓ Good — barrel imports work everywhere |

## Constraints

- **Tech stack**: No framework changes — React, Tauri, Zustand, TanStack Query, XState stay
- **No feature regression**: Every existing capability works after restructuring
- **Import boundary enforcement**: All cross-module imports go through barrel exports
- **Platform**: Cross-platform desktop app, primary development on macOS

---
*Last updated: 2026-03-13 after v1.0 milestone*
