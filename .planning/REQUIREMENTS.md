# Requirements: Bucket Deep Module Refactor

**Defined:** 2026-03-07
**Core Value:** Every feature module has a simple public interface that fully describes its capabilities — nothing reaches past the boundary, and contract tests lock down the behavior.

## v1 Requirements

Requirements for the deep module refactor. Each maps to roadmap phases.

### Tooling & Prep

- [ ] **TOOL-01**: User can run ESLint and see boundary violation warnings for cross-module imports
- [ ] **TOOL-02**: User can run knip and see a report of dead code, unused exports, and orphaned files
- [ ] **TOOL-03**: User can run dependency-cruiser and see a dependency graph of the current codebase
- [ ] **TOOL-04**: User can see `.refactored` file ambiguity resolved (canonical versions chosen, duplicates deleted)
- [ ] **TOOL-05**: User can see `@features/*` and `@shared/*` path aliases configured in tsconfig and vite

### Shared Infrastructure

- [ ] **SHRD-01**: User can import shared hooks from `@shared/hooks` barrel export only
- [ ] **SHRD-02**: User can import shared UI primitives from `@shared/ui/*` (no barrel for UI — direct imports)
- [ ] **SHRD-03**: User can import global stores from `@shared/store` barrel export
- [ ] **SHRD-04**: User can import query infrastructure from `@shared/lib` barrel export
- [ ] **SHRD-05**: User can import services from `@shared/services` barrel export
- [ ] **SHRD-06**: User can import utilities from `@shared/utils` barrel export
- [ ] **SHRD-07**: User can import shared types from `@shared/types` barrel export
- [ ] **SHRD-08**: User can import constants from `@shared/constants` barrel export
- [ ] **SHRD-09**: User can see contract tests validating each shared sub-module's public interface

### Auth Module

- [ ] **AUTH-01**: User can import auth components, hooks, and types from `@features/Auth` barrel only
- [ ] **AUTH-02**: User can see an API layer wrapping auth-related Tauri commands
- [ ] **AUTH-03**: User can see contract tests validating Auth module's public interface

### Trello Module

- [ ] **TREL-01**: User can import Trello components, hooks, and types from `@features/Trello` barrel only
- [ ] **TREL-02**: User can see an API layer wrapping Trello-related Tauri commands
- [ ] **TREL-03**: User can see contract tests validating Trello module's public interface

### Premiere Module

- [ ] **PREM-01**: User can import Premiere components, hooks, and types from `@features/Premiere` barrel only
- [ ] **PREM-02**: User can see an API layer wrapping Premiere-related Tauri commands
- [ ] **PREM-03**: User can see contract tests validating Premiere module's public interface

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
- [ ] **DOCS-03**: User can see stale specs, `.old` files, and orphaned markdown removed
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
| Store decomposition | Behavioral change — defer until after structural migration stabilizes |
| Mobile/web support | Desktop-only app, out of scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | — | Pending |
| TOOL-02 | — | Pending |
| TOOL-03 | — | Pending |
| TOOL-04 | — | Pending |
| TOOL-05 | — | Pending |
| SHRD-01 | — | Pending |
| SHRD-02 | — | Pending |
| SHRD-03 | — | Pending |
| SHRD-04 | — | Pending |
| SHRD-05 | — | Pending |
| SHRD-06 | — | Pending |
| SHRD-07 | — | Pending |
| SHRD-08 | — | Pending |
| SHRD-09 | — | Pending |
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| TREL-01 | — | Pending |
| TREL-02 | — | Pending |
| TREL-03 | — | Pending |
| PREM-01 | — | Pending |
| PREM-02 | — | Pending |
| PREM-03 | — | Pending |
| UPLD-01 | — | Pending |
| UPLD-02 | — | Pending |
| UPLD-03 | — | Pending |
| STNG-01 | — | Pending |
| STNG-02 | — | Pending |
| STNG-03 | — | Pending |
| STNG-04 | — | Pending |
| AITL-01 | — | Pending |
| AITL-02 | — | Pending |
| AITL-03 | — | Pending |
| BAKR-01 | — | Pending |
| BAKR-02 | — | Pending |
| BAKR-03 | — | Pending |
| BLDP-01 | — | Pending |
| BLDP-02 | — | Pending |
| BLDP-03 | — | Pending |
| BLDP-04 | — | Pending |
| SHEL-01 | — | Pending |
| SHEL-02 | — | Pending |
| SHEL-03 | — | Pending |
| DOCS-01 | — | Pending |
| DOCS-02 | — | Pending |
| DOCS-03 | — | Pending |
| DOCS-04 | — | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 0
- Unmapped: 47

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after initial definition*
