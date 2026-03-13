# Phase 8: BuildProject Module - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate BuildProject (file ingest, camera assignment, project creation, XState machine) into a deep feature module at `src/features/BuildProject/` with barrel exports, api.ts I/O boundary, and contract tests. Also move useAutoFileSelection and useBackgroundFolder into the Upload module (their actual consumer). No behavioral changes -- purely structural migration.

</domain>

<decisions>
## Implementation Decisions

### Hook ownership
- **10 hooks move to BuildProject**: useBuildProjectMachine, useCreateProjectWithMachine, useProjectState, useFileSelector, useCameraAutoRemap, useFileOperations, useProjectValidation, useProjectFolders, usePostProjectCompletion, useVideoInfoBlock
- **useAutoFileSelection moves to Upload module** -- consumed by Posterframe, not BuildProject
- **useBackgroundFolder moves to Upload module** -- consumed by Posterframe, not BuildProject
- Both Upload hook moves resolve the TODO(Phase 8) comments added in Phase 4

### XState machine colocation
- **buildProjectMachine.ts at module root** -- sits alongside api.ts and types.ts, not in hooks/ or a sub-directory
- **Internal only** -- machine is not exported from barrel. Only useBuildProjectMachine consumes it
- **Delete src/machines/ directory** -- empty after migration, no reason to keep it
- **@machines/ path alias** -- remove from tsconfig/vite config (only 3 consumers, all moving into BuildProject module)

### Premiere dependency routing
- **BuildProject's api.ts wraps copy_premiere_project directly** -- no import from @features/Premiere needed
- **show_confirmation_dialog also in BuildProject's api.ts** -- it's a BuildProject I/O operation
- **No @features/Premiere barrel dependency** -- verified: zero imports from Premiere in BuildProject files. The dependency is purely at the Tauri command level

### Barrel export scope
- **Minimal exports**: BuildProjectPage only (for router)
- **Everything else internal** -- all 10 hooks, machine, step components, types are module-internal
- **Cross-module imports**: BuildProject imports TrelloCardsManager from @features/Trello barrel in SuccessSection.tsx (standard pattern, same as Baker/Trello)

### Directory structure
- **Flat layout** -- components/ and hooks/ at module root (consistent with Baker/Upload from Phases 4 and 7)
- **BuildProjectPage.tsx at module root** -- entry-point page component, sub-step components in components/

### api.ts I/O boundary
- **Full consolidation** -- all invoke() (move_files, get_folder_size, copy_premiere_project, show_confirmation_dialog), dialog plugin (open, confirm), fs plugin (mkdir, exists, remove, writeTextFile, readDir), and Tauri event listeners (copy_progress, copy_complete, copy_file_error, copy_complete_with_errors) routed through api.ts
- **Event listeners**: api.ts exports raw listener wrappers that return unlisten functions (same pattern as Baker)

### Plan granularity
- **1 atomic plan** -- file moves, api.ts, barrel, consumer updates (router + Upload module hooks), contract tests, machines/ cleanup. No broken intermediate states

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Internal file organization within components/ and hooks/
- Whether to split api.ts if it exceeds ~200 lines

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/Baker/` -- latest module pattern with api.ts wrapping 25 I/O functions, flat layout
- `src/features/Upload/` -- flat layout pattern, will receive 2 additional hooks in this phase
- `src/features/Trello/__contracts__/trello.contract.test.ts` -- contract test template
- Phase 2 `// Target: @features/BuildProject` tags on hooks -- migration guide

### Established Patterns
- api.ts wraps ALL external calls (invoke, fetch, file plugins, dialog, shell, event listeners) -- single I/O boundary per module
- Event listener wrappers return unlisten functions for cleanup pattern (Baker Phase 7)
- Named re-exports in barrels, no wildcards (Phase 2)
- `__contracts__/` directory colocated with module (Phase 2)
- No barrel files in internal directories (Phase 2)

### Integration Points
- App router/sidebar: imports BuildProject page from @pages/BuildProject -- update to @features/BuildProject barrel
- SuccessSection.tsx imports TrelloCardsManager from @features/Trello barrel (stays as-is)
- Upload module: receives useAutoFileSelection and useBackgroundFolder, resolve TODO(Phase 8) comments in Posterframe.tsx
- ESLint boundary rules: already configured for @features/* zone (Phase 1)
- @machines/ path alias: remove from tsconfig and vite config after migration

### File Inventory
- **Page**: src/pages/BuildProject/BuildProject.tsx (entry point)
- **Step components**: ProjectConfigurationStep.tsx, AddFootageStep.tsx, CreateProjectStep.tsx (3 files)
- **UI components**: ProjectFileList.tsx, ProjectInputs.tsx, FolderSelector.tsx, ProgressBar.tsx, SuccessSection.tsx (5 files)
- **Hooks**: 10 hooks in src/hooks/ (see hook ownership above)
- **Machine**: src/machines/buildProjectMachine.ts
- **Types**: embedded in machine and hooks (extract to types.ts)
- **I/O calls**: invoke (4), listen (4 events), dialog (2), fs (5 operations)
- **Upload module hooks to move**: useAutoFileSelection.ts, useBackgroundFolder.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- following the established deep module pattern from Phases 3-7, with flat layout consistent with Baker and Upload modules.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 08-buildproject-module*
*Context gathered: 2026-03-09*
