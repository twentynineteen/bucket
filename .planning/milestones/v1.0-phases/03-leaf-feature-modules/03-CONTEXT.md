# Phase 3: Leaf Feature Modules - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate Auth (6 files), Trello (21 files), and Premiere (2 files) into self-contained deep modules at `src/features/` with barrel exports, API layers, and contract tests. Each module is importable only through its barrel (`@features/Auth`, `@features/Trello`, `@features/Premiere`). No behavioral changes — purely structural migration per refactor constraints.

</domain>

<decisions>
## Implementation Decisions

### Trello public API surface
- Barrel exports **both components and hooks** — Baker imports pre-built UI (TrelloIntegrationButton, TrelloIntegrationModal) + logic hooks from `@features/Trello`
- `useBakerTrelloIntegration` lives **inside Trello module** — it's a Trello capability, not Baker orchestration
- Trello-specific utils (TrelloCards.tsx, trelloBoardValidation.ts) move **inside the Trello module** as internal files, not exported
- UploadTrello page types and hooks **merge into module-level structure** (types.ts, hooks/) — no nested page-level type/hook silos

### API layer scope
- api.ts wraps **all external calls**: Tauri invoke(), fetch() to REST APIs, AND Tauri file plugins (writeTextFile, readTextFile, etc.)
- Single file owns all I/O per module — mock one file to isolate the entire module for testing
- This pattern applies **consistently to all three modules** (Auth, Trello, Premiere)

### Auth provider integration
- **Keep React Context pattern** — converting to Zustand would be a behavioral change, violating structural-only refactor constraint
- Barrel exports `AuthProvider` for App.tsx to import: `import { AuthProvider } from '@features/Auth'`
- All auth API calls (login, register, token check) go through auth/api.ts
- Login.tsx and Register.tsx pages live **inside @features/Auth/components/** — barrel exports them for AppRouter

### Plan granularity
- **2 plans total**: Plan 03-01 (Auth + Premiere, 8 files combined), Plan 03-02 (Trello, 21 files)
- Contract tests are written as part of each plan, not as a separate step

### Claude's Discretion
- Whether Auth api.ts owns localStorage access or just wraps invoke() calls
- Whether to split Trello's api.ts into sub-files if it exceeds ~200 lines
- Exact barrel export list for each module (which hooks/components are public vs internal)
- Internal file organization within each module directory

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/` infrastructure (hooks, ui, store, lib, services, utils, types, constants) — all barrels working from Phase 2
- Contract test pattern established in `src/shared/__contracts__/` — behavioral tests with renderHook, export shape validation
- Phase 2 tagged ~75 feature hooks with `// Target: @features/X` comments — use these as migration guide

### Established Patterns
- Barrel-only imports enforced via eslint-plugin-boundaries (warnings, Phase 1)
- No barrels in shared/ui/ — direct imports only (Phase 2 convention)
- Named re-exports in barrels, no wildcards (Phase 2)
- `__contracts__/` directory colocated with each module (Phase 2)

### Integration Points
- `App.tsx`: Needs to import AuthProvider from `@features/Auth` barrel
- `AppRouter.tsx`: Needs to import Login, Register pages from `@features/Auth` barrel
- Baker (Phase 7): Will import components + hooks from `@features/Trello` barrel
- BuildProject (Phase 8): Will import from `@features/Premiere` barrel
- ESLint boundary rules: Already configured for `@features/*` zone (Phase 1)

### Feature Inventory
- **Auth** (6 files): AuthContext.ts, AuthProvider.tsx, useAuth.ts, useAuthCheck.ts, Login.tsx, Register.tsx
- **Trello** (21 files): 14 hooks, 3 page files (UploadTrelloHooks.ts, UploadTrelloTypes.ts, CardDetailsDialog.tsx), 2 utils, 2 components
- **Premiere** (2 files): PremierePluginManager.tsx, usePremiereIntegration.ts
- **Trello invoke() calls**: Only 1 (fetch_trello_boards) — rest uses direct fetch() to Trello REST API + Tauri file plugins
- **Auth invoke() calls**: 2 (add_token, check_auth) + localStorage + external API fetch
- **Premiere invoke() calls**: 4 (get_available_plugins, install_plugin, open_cep_folder, show_confirmation_dialog)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for module extraction following the established deep module pattern from Phase 2.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-leaf-feature-modules*
*Context gathered: 2026-03-09*
