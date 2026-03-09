# Requirements: Bucket Deep Module Refactor

**Defined:** 2026-03-07
**Core Value:** Every feature module has a simple public interface that fully describes its capabilities -- nothing reaches past the boundary, and contract tests lock down the behavior.

## v1 Requirements

Requirements for the deep module refactor. Each maps to roadmap phases.

### Tooling & Prep

- [x] **TOOL-01**: User can run ESLint and see boundary violation warnings for cross-module imports
- [x] **TOOL-02**: User can run knip and see a report of dead code, unused exports, and orphaned files
- [x] **TOOL-03**: User can run dependency-cruiser and see a dependency graph of the current codebase
- [x] **TOOL-04**: User can see `.refactored` file ambiguity resolved (canonical versions chosen, duplicates deleted)
- [x] **TOOL-05**: User can see `@features/*` and `@shared/*` path aliases configured in tsconfig and vite

### Shared Infrastructure

- [x] **SHRD-01**: User can import shared hooks from `@shared/hooks` barrel export only
- [x] **SHRD-02**: User can import shared UI primitives from `@shared/ui/*` (no barrel for UI -- direct imports)
- [x] **SHRD-03**: User can import global stores from `@shared/store` barrel export
- [x] **SHRD-04**: User can import query infrastructure from `@shared/lib` barrel export
- [x] **SHRD-05**: User can import services from `@shared/services` barrel export
- [x] **SHRD-06**: User can import utilities from `@shared/utils` barrel export
- [x] **SHRD-07**: User can import shared types from `@shared/types` barrel export
- [x] **SHRD-08**: User can import constants from `@shared/constants` barrel export
- [x] **SHRD-09**: User can see contract tests validating each shared sub-module's public interface

### Auth Module

- [x] **AUTH-01**: User can import auth components, hooks, and types from `@features/Auth` barrel only
- [x] **AUTH-02**: User can see an API layer wrapping auth-related Tauri commands
- [x] **AUTH-03**: User can see contract tests validating Auth module's public interface

### Trello Module

- [ ] **TREL-01**: User can import Trello components, hooks, and types from `@features/Trello` barrel only
- [ ] **TREL-02**: User can see an API layer wrapping Trello-related Tauri commands
- [ ] **TREL-03**: User can see contract tests validating Trello module's public interface

### Premiere Module

- [x] **PREM-01**: User can import Premiere components, hooks, and types from `@features/Premiere` barrel only
- [x] **PREM-02**: User can see an API layer wrapping Premiere-related Tauri commands
- [x] **PREM-03**: User can see contract tests validating Premiere module's public interface

### Upload Module

- [ ] **UPLD-01**: User can import Upload components, hooks, and types from `@features/Upload` barrel only
- [ ] **UPLD-02**: User can see an API layer wrapping Sprout/Posterframe/Otter Tauri commands
- [ ] **UPLD-03**: User can see contract tests validating Upload module's public interface

### Settings Module

- [ ] **STNG-01**: User can import Settings components, hooks, and types from `@features/Settings` barrel only
- [ ] **STNG-02**: User can see Settings decomposed into per-domain sub-components (no 523-line monolith)
- [ ] **STNG-03**: User can see an API layer wrapping Settings-related Tauri commands
- [ ] **STNG-04**: User can see contract tests validating Settings module's public interface

### AI Tools Module

- [ ] **AITL-01**: User can import AITools components, hooks, and types from `@features/AITools` barrel only
- [ ] **AITL-02**: User can see an API layer wrapping AI-related Tauri commands (RAG, embeddings)
- [ ] **AITL-03**: User can see contract tests validating AITools module's public interface

### Baker Module

- [ ] **BAKR-01**: User can import Baker components, hooks, and types from `@features/Baker` barrel only
- [ ] **BAKR-02**: User can see an API layer wrapping Baker-related Tauri commands
- [ ] **BAKR-03**: User can see contract tests validating Baker module's public interface

### BuildProject Module

- [ ] **BLDP-01**: User can import BuildProject components, hooks, and types from `@features/BuildProject` barrel only
- [ ] **BLDP-02**: User can see an API layer wrapping BuildProject-related Tauri commands
- [ ] **BLDP-03**: User can see XState machine colocated within the BuildProject module
- [ ] **BLDP-04**: User can see contract tests validating BuildProject module's public interface

### App Shell & Enforcement

- [ ] **SHEL-01**: User can see all feature routes loaded via React.lazy()
- [ ] **SHEL-02**: User can see ESLint boundary rules promoted from warn to error
- [ ] **SHEL-03**: User can see old path aliases (`@hooks/*`, `@pages/*`, etc.) removed after migration

### Documentation & Cleanup

- [ ] **DOCS-01**: User can see CLAUDE.md updated to reflect new module structure
- [ ] **DOCS-02**: User can see JSDoc on every public export in barrel files
- [x] **DOCS-03**: User can see stale specs, `.old` files, and orphaned markdown removed
- [ ] **DOCS-04**: User can see all `alert()`/`confirm()` calls replaced with Sonner toasts and Radix dialogs

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Store Decomposition

- **STOR-01**: User can see `useAppStore` god store decomposed into feature-scoped stores
- **STOR-02**: User can see each feature's Zustand store colocated within its module

### Rust Backend Modules

- **RUST-01**: User can see Rust backend commands reorganized to mirror frontend feature modules
- **RUST-02**: User can see contract tests for Rust Tauri commands

### Offline Support

- **OFFL-01**: User can see queue mechanism for failed API calls (Trello, Sprout)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New feature development | This milestone is purely structural |
| Rust backend restructuring | Already has reasonable module boundaries |
| Performance optimization | Separate concern, not part of structural refactor |
| Auth security hardening | Important but separate milestone |
| Store decomposition | Behavioral change -- defer until after structural migration stabilizes |
| Mobile/web support | Desktop-only app, out of scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | Phase 1 | Complete |
| TOOL-02 | Phase 1 | Complete |
| TOOL-03 | Phase 1 | Complete |
| TOOL-04 | Phase 1 | Complete |
| TOOL-05 | Phase 1 | Complete |
| SHRD-01 | Phase 2 | Complete |
| SHRD-02 | Phase 2 | Complete |
| SHRD-03 | Phase 2 | Complete |
| SHRD-04 | Phase 2 | Complete |
| SHRD-05 | Phase 2 | Complete |
| SHRD-06 | Phase 2 | Complete |
| SHRD-07 | Phase 2 | Complete |
| SHRD-08 | Phase 2 | Complete |
| SHRD-09 | Phase 2 | Complete |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| TREL-01 | Phase 3 | Pending |
| TREL-02 | Phase 3 | Pending |
| TREL-03 | Phase 3 | Pending |
| PREM-01 | Phase 3 | Complete |
| PREM-02 | Phase 3 | Complete |
| PREM-03 | Phase 3 | Complete |
| UPLD-01 | Phase 4 | Pending |
| UPLD-02 | Phase 4 | Pending |
| UPLD-03 | Phase 4 | Pending |
| STNG-01 | Phase 5 | Pending |
| STNG-02 | Phase 5 | Pending |
| STNG-03 | Phase 5 | Pending |
| STNG-04 | Phase 5 | Pending |
| AITL-01 | Phase 6 | Pending |
| AITL-02 | Phase 6 | Pending |
| AITL-03 | Phase 6 | Pending |
| BAKR-01 | Phase 7 | Pending |
| BAKR-02 | Phase 7 | Pending |
| BAKR-03 | Phase 7 | Pending |
| BLDP-01 | Phase 8 | Pending |
| BLDP-02 | Phase 8 | Pending |
| BLDP-03 | Phase 8 | Pending |
| BLDP-04 | Phase 8 | Pending |
| SHEL-01 | Phase 9 | Pending |
| SHEL-02 | Phase 9 | Pending |
| SHEL-03 | Phase 9 | Pending |
| DOCS-01 | Phase 9 | Pending |
| DOCS-02 | Phase 9 | Pending |
| DOCS-03 | Phase 1 | Complete |
| DOCS-04 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
