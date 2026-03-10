# Roadmap: Bucket Deep Module Refactor

## Overview

Restructure Bucket's frontend from a flat, boundary-less codebase into deep feature modules with barrel exports, API layers, and contract tests. The migration follows dependency order: tooling and prep first, then shared infrastructure, then leaf features (Auth, Trello, Premiere), then mid-tier features (Upload, Settings, AI Tools), then the two most complex features (Baker, BuildProject), and finally wiring up the app shell with enforced boundaries. Each phase delivers independently verifiable modules that work through their public interface.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Tooling & Prep** - Install enforcement tools, resolve stale files, configure path aliases
- [x] **Phase 2: Shared Infrastructure** - Extract cross-cutting code into shared sub-modules with barrels and contract tests
- [x] **Phase 3: Leaf Feature Modules** - Migrate Auth, Trello, and Premiere into deep feature modules (completed 2026-03-09)
- [x] **Phase 4: Upload Module** - Migrate Sprout, Posterframe, and Otter into a deep Upload feature module (completed 2026-03-09)
- [ ] **Phase 5: Settings Module** - Decompose Settings monolith and migrate into a deep feature module
- [x] **Phase 6: AI Tools Module** - Migrate ScriptFormatter and ExampleEmbeddings into a deep feature module (gap closure in progress) (completed 2026-03-09)
- [x] **Phase 7: Baker Module** - Migrate Baker (drive scanning, breadcrumbs) into a deep feature module (completed 2026-03-09)
- [ ] **Phase 8: BuildProject Module** - Migrate BuildProject (file ingest, camera assignment, XState) into a deep feature module
- [ ] **Phase 9: App Shell & Enforcement** - Lazy routes, boundary enforcement promotion, JSDoc, alert replacement, final cleanup

## Phase Details

### Phase 1: Tooling & Prep
**Goal**: Developer has enforcement tools configured and the codebase is clean of ambiguous/stale artifacts, ready for migration
**Depends on**: Nothing (first phase)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, DOCS-03
**Success Criteria** (what must be TRUE):
  1. Running `bun run lint` shows eslint-plugin-boundaries warnings for any cross-module import violation
  2. Running knip produces a baseline report of dead code, unused exports, and orphaned files with zero false-positive noise from intentional patterns
  3. Running dependency-cruiser generates a visual dependency graph of the current codebase
  4. No `.refactored` or `.old` files remain -- canonical versions are chosen and duplicates are deleted
  5. Importing from `@features/*` and `@shared/*` paths resolves correctly in both TypeScript and Vite
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md -- Path aliases, ESLint boundaries, stale file cleanup
- [x] 01-02-PLAN.md -- Knip baseline report, dependency-cruiser graph

### Phase 2: Shared Infrastructure
**Goal**: All cross-cutting code lives in `src/shared/` sub-modules with barrel exports and contract tests, providing a stable foundation for feature modules
**Depends on**: Phase 1
**Requirements**: SHRD-01, SHRD-02, SHRD-03, SHRD-04, SHRD-05, SHRD-06, SHRD-07, SHRD-08, SHRD-09
**Success Criteria** (what must be TRUE):
  1. Importing shared hooks via `@shared/hooks` barrel works and no other import path reaches hook internals
  2. Importing UI primitives via `@shared/ui/Button` (direct, no barrel) works and the ui directory has no barrel file
  3. Importing stores, lib, services, utils, types, and constants each works through their respective `@shared/*` barrel exports
  4. Contract tests exist for each shared sub-module and all pass, validating that public interfaces export the expected members with correct behavior
  5. The Vite dev server starts without HMR degradation after shared module extraction
**Plans:** 4/4 plans executed

Plans:
- [x] 02-01-PLAN.md -- Move lib, constants, types, utils to shared with barrels and contract tests
- [x] 02-02-PLAN.md -- Move store and services to shared with barrels and contract tests
- [x] 02-03-PLAN.md -- Move UI primitives, theme system, layout to shared/ui with direct imports
- [x] 02-04-PLAN.md -- Move shared hooks, tag feature hooks, final verification

### Phase 3: Leaf Feature Modules
**Goal**: Auth, Trello, and Premiere each exist as self-contained deep modules with barrel exports, API layers, and contract tests
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, TREL-01, TREL-02, TREL-03, PREM-01, PREM-02, PREM-03
**Success Criteria** (what must be TRUE):
  1. Importing Auth components, hooks, and types works only through `@features/Auth` barrel -- no other path reaches Auth internals
  2. Importing Trello components, hooks, and types works only through `@features/Trello` barrel -- Trello is its own module, not split across Baker/Upload
  3. Importing Premiere components, hooks, and types works only through `@features/Premiere` barrel
  4. Each module has an `api.ts` layer wrapping its Tauri commands -- no component directly calls `invoke()`
  5. Contract tests for all three modules pass, validating public interface behavior (not just export existence)
**Plans:** 2/2 plans complete

Plans:
- [x] 03-01-PLAN.md -- Auth + Premiere modules with api.ts layers, barrels, and contract tests
- [ ] 03-02-PLAN.md -- Trello module with api.ts layer, merged types, barrel, and contract tests

### Phase 4: Upload Module
**Goal**: Sprout Video upload, Posterframe generation, and Otter transcription live in a unified Upload feature module with clear sub-feature boundaries
**Depends on**: Phase 3
**Requirements**: UPLD-01, UPLD-02, UPLD-03
**Success Criteria** (what must be TRUE):
  1. Importing Upload components, hooks, and types works only through `@features/Upload` barrel
  2. An `api.ts` layer wraps all Sprout, Posterframe, and Otter Tauri commands -- no component directly calls `invoke()`
  3. Contract tests validate the Upload module's public interface and all pass
**Plans:** 1/1 plans complete

Plans:
- [ ] 04-01-PLAN.md -- Upload module with api.ts layer, barrel, contract tests, and cross-module consumer updates

### Phase 5: Settings Module
**Goal**: Settings is decomposed from a 523-line monolith into per-domain sub-components within a deep feature module
**Depends on**: Phase 3
**Requirements**: STNG-01, STNG-02, STNG-03, STNG-04
**Success Criteria** (what must be TRUE):
  1. Importing Settings components, hooks, and types works only through `@features/Settings` barrel
  2. The Settings page renders from per-domain sub-components (API Keys, Appearance, Connected Apps, etc.) -- no single file exceeds 200 lines
  3. An `api.ts` layer wraps all Settings-related Tauri commands
  4. Contract tests validate the Settings module's public interface and all pass
**Plans:** 1 plan

Plans:
- [ ] 05-01-PLAN.md -- Decompose Settings monolith into deep feature module with 5 sub-components, api.ts, barrel, and contract tests

### Phase 6: AI Tools Module
**Goal**: ScriptFormatter and ExampleEmbeddings live in a unified AITools feature module with clear sub-feature boundaries
**Depends on**: Phase 2
**Requirements**: AITL-01, AITL-02, AITL-03
**Success Criteria** (what must be TRUE):
  1. Importing AITools components, hooks, and types works only through `@features/AITools` barrel
  2. An `api.ts` layer wraps all AI-related Tauri commands (RAG queries, embedding management)
  3. Contract tests validate the AITools module's public interface and all pass
**Plans:** 2/2 plans complete

Plans:
- [x] 06-01-PLAN.md -- AITools module with sub-feature directories, api.ts I/O boundary, selective barrel exports, and contract tests
- [ ] 06-02-PLAN.md -- Gap closure: route remaining direct Tauri plugin imports through api.ts

### Phase 7: Baker Module
**Goal**: Baker (drive scanning, breadcrumbs management, batch operations) lives in a deep feature module with its 9 hooks colocated
**Depends on**: Phase 3 (depends on Trello module)
**Requirements**: BAKR-01, BAKR-02, BAKR-03
**Success Criteria** (what must be TRUE):
  1. Importing Baker components, hooks, and types works only through `@features/Baker` barrel
  2. An `api.ts` layer wraps all Baker-related Tauri commands -- Baker imports Trello through `@features/Trello` barrel, not internal paths
  3. Contract tests validate the Baker module's public interface and all pass
**Plans:** 1/1 plans complete

Plans:
- [ ] 07-01-PLAN.md -- Baker module with api.ts I/O boundary (~24 wrappers), flat layout, minimal barrel exports, and contract tests

### Phase 8: BuildProject Module
**Goal**: BuildProject (file ingest, camera assignment, project creation) lives in a deep feature module with its 10 hooks and XState machine colocated
**Depends on**: Phase 3 (depends on Premiere module)
**Requirements**: BLDP-01, BLDP-02, BLDP-03, BLDP-04
**Success Criteria** (what must be TRUE):
  1. Importing BuildProject components, hooks, and types works only through `@features/BuildProject` barrel
  2. An `api.ts` layer wraps all BuildProject-related Tauri commands -- BuildProject imports Premiere through `@features/Premiere` barrel
  3. The XState machine, its hook, and step components are colocated within the BuildProject module directory
  4. Contract tests validate the BuildProject module's public interface and all pass
**Plans:** 1 plan

Plans:
- [ ] 08-01-PLAN.md -- BuildProject module with api.ts I/O boundary (~14 wrappers), flat layout, minimal barrel, XState colocation, and contract tests

### Phase 9: App Shell & Enforcement
**Goal**: The app shell uses lazy-loaded routes, boundary rules are enforced as errors, old paths are removed, public APIs are documented, and all native alerts are replaced
**Depends on**: Phases 4, 5, 6, 7, 8 (all feature modules complete)
**Requirements**: SHEL-01, SHEL-02, SHEL-03, DOCS-01, DOCS-02, DOCS-04
**Success Criteria** (what must be TRUE):
  1. All feature routes load via React.lazy() -- navigating to any feature shows a loading boundary before the module chunk loads
  2. ESLint boundary rules are set to error mode -- any cross-module import that bypasses a barrel fails the lint check
  3. Old path aliases (`@hooks/*`, `@pages/*`, etc.) are removed from tsconfig and vite config -- importing from old paths produces a TypeScript error
  4. Every public export in every barrel file has JSDoc describing its purpose and usage
  5. Zero `alert()` or `confirm()` calls remain in the codebase -- all replaced with Sonner toasts and Radix dialogs
**Plans:** 2/3 plans executed

Plans:
- [ ] 09-01-PLAN.md -- Old-alias cleanup, file relocations, cn() migration, alert/confirm replacement
- [ ] 09-02-PLAN.md -- React.lazy() route conversion, Suspense boundaries, ESLint boundary promotion to error
- [ ] 09-03-PLAN.md -- JSDoc on all barrel exports, CLAUDE.md rewrite with module map

### Phase 10: API Bypass Fixes & Baker Bookkeeping
**Goal**: All api.ts bypass violations are fixed, Baker barrel exports are complete, contract tests cover internal/ directories, and Baker requirement bookkeeping is corrected
**Depends on**: Phase 9
**Requirements**: BAKR-01, BAKR-02, BAKR-03
**Gap Closure:** Closes gaps from v1.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Baker/internal/NormalView.tsx routes shell open through Baker/api.ts -- no direct @tauri-apps/plugin-shell import
  2. BreadcrumbsViewerProps is exported from Baker barrel and consumed via barrel import
  3. Baker contract test no-bypass scans internal/ directory and catches direct Tauri imports
  4. All 4 Trello files (useTrelloActions, useUploadTrello, TrelloIntegrationModal, TrelloCardItem) route through Trello/api.ts -- no direct @tauri-apps imports
  5. Trello contract test no-bypass covers plugin-shell and plugin-opener imports
  6. SUMMARY 07-01 requirements_completed lists BAKR-01, BAKR-02, BAKR-03
  7. REQUIREMENTS.md BAKR-01/02/03 checkboxes checked and status Complete
**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md -- Fix Baker/Trello bypass violations, add Baker barrel export, update both modules' contract tests
- [ ] 10-02-PLAN.md -- Add no-bypass tests to Auth/Premiere/Upload/Settings/AITools, update Baker requirement bookkeeping

### Phase 11: Legacy & Stub Cleanup
**Goal**: Orphaned legacy files are removed, stub routes are resolved, and stale planning artifacts are closed
**Depends on**: Phase 9
**Requirements**: (tech debt -- no new requirements)
**Gap Closure:** Closes tech debt from v1.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. 12 orphaned legacy files in src/ are removed (utils/breadcrumbs*, utils/updateManifest, components/BreadcrumbsViewer, components/ProjectChangeDetailView, services/ai/*, types/*)
  2. IngestHistory.tsx is either implemented or its route is removed
  3. FolderTreeNavigator.tsx is either wired to a route or removed
  4. Stale todo (fix-eslint-boundaries-no-unknown-files-warning) is closed
**Plans:** 0 plans

Plans:
- (none yet)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4/5/6 (parallelizable) -> 7/8 (parallelizable) -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tooling & Prep | 2/2 | Complete | 2026-03-08 |
| 2. Shared Infrastructure | 4/4 | Complete | 2026-03-09 |
| 3. Leaf Feature Modules | 2/2 | Complete   | 2026-03-09 |
| 4. Upload Module | 1/1 | Complete   | 2026-03-09 |
| 5. Settings Module | 0/1 | Planned | - |
| 6. AI Tools Module | 2/2 | Complete   | 2026-03-09 |
| 7. Baker Module | 1/1 | Complete   | 2026-03-09 |
| 8. BuildProject Module | 0/1 | Planned | - |
| 9. App Shell & Enforcement | 2/3 | In Progress|  |
| 10. API Bypass Fixes & Baker Bookkeeping | 0/2 | Planned | - |
| 11. Legacy & Stub Cleanup | 0/0 | Planned | - |
