# Phase 6: AI Tools Module - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate ScriptFormatter and ExampleEmbeddings into a unified `src/features/AITools/` deep module with barrel exports, API layer, and contract tests. Drop dead code (useTranscript). Move AI-specific utilities (aiPrompts.ts) into the module. No new capabilities -- purely structural migration.

</domain>

<decisions>
## Implementation Decisions

### Directory structure
- **Sub-directories per sub-feature** -- ScriptFormatter/ and ExampleEmbeddings/ inside the module, each with components/ and hooks/ sub-dirs. Justified deviation from Phase 4 flat pattern due to module size (16 hooks + 25 components)
- **Single shared api.ts at module root** -- wraps all invoke/plugin calls for both sub-features. Maintains single-I/O-boundary pattern from Phases 3-5
- **Single shared types.ts at module root** -- both sub-features share types like SimilarExample. Re-exports relevant types from @shared/types
- **No internal barrel files** -- only one barrel at AITools/index.ts. Internal components use direct relative imports. Consistent with Phase 2 convention

### Orphan code disposition
- **Drop useTranscript entirely** -- zero consumers, dead code. Recoverable from git history
- **Move useUploadDialogForm.ts as-is** -- from src/pages/AI/ExampleEmbeddings/hooks/ to features/AITools/ExampleEmbeddings/hooks/. Proper hook with form state logic
- **Move aiPrompts.ts into AITools/internal/** -- only AI hooks consume it. AI-specific prompt engineering, not a shared utility. Not exported from barrel

### Hook export scope
- **Selective exports only** -- barrel exports entry-point hooks (useScriptFormatterState, useExampleManagement, useScriptFileUpload) and page components (ScriptFormatter, ExampleEmbeddings). Internal plumbing hooks (useScriptProcessor, useScriptRetrieval, useEmbedding, useOllamaEmbedding, useDocxParser, useDocxGenerator, useScriptUpload, useScriptDownload, useScriptReview, useScriptWorkflow, useAIModels, useAIProcessing) are NOT exported
- **Step sub-components internal only** -- SelectModelStep, ProcessingStep, ReviewStep, DownloadCompleteStep, WorkflowIndicator are internal to ScriptFormatter
- **ExampleEmbeddings sub-components internal only** -- ExampleCard, ExampleList, UploadDialog, ReplaceDialog, ViewExampleDialog, DeleteConfirm are internal

### Plan granularity
- **1 atomic plan** -- module structure, api.ts, file moves, consumer updates, contract tests. No broken intermediate state. Consistent with Phases 4/5

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Whether to replace alert() calls with logger/toast while moving files (same as Phase 4/5 approach)
- Internal file organization within sub-feature directories
- Which hooks belong to ScriptFormatter vs ExampleEmbeddings vs shared (hook assignment to sub-features)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/Settings/` -- latest module pattern with sub-component decomposition and api.ts
- `src/features/Upload/` -- flat-with-prefixes pattern (being modified to sub-dirs for this phase)
- `src/features/Trello/__contracts__/trello.contract.test.ts` -- contract test template
- Phase 2 `// Target: @features/AITools` tags on 15 hooks -- migration guide

### Established Patterns
- api.ts wraps ALL external calls (invoke, fetch, file plugins, event listeners) -- single I/O boundary per module
- Named re-exports in barrels, no wildcards (Phase 2)
- `__contracts__/` directory co-located with module (Phase 2)
- `internal/` directory for non-exported utilities (Phase 3)
- No barrel files in internal directories (Phase 2)

### Integration Points
- App router/sidebar: imports ScriptFormatter from @pages/AI/ScriptFormatter, ExampleEmbeddings from @pages/AI/ExampleEmbeddings -- update to @features/AITools barrel
- `src/features/Settings/components/AIModelsSection.tsx` -- may reference AI model hooks, verify during implementation
- No other external consumers of AI hooks (module is self-contained)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- following the established deep module pattern from Phases 3-5, with sub-directory organization as the key structural addition for this larger module.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 06-ai-tools-module*
*Context gathered: 2026-03-09*
