# Phase 4: Upload Module - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate Sprout Video upload, Posterframe generation, and Otter transcription into a unified `src/features/Upload/` deep module with barrel exports, API layer, and contract tests. No new capabilities — purely structural migration following the Phase 3 deep module pattern, with one small behavioral fix (alert → toast).

</domain>

<decisions>
## Implementation Decisions

### Orphan code disposition
- **Drop useSproutVideoPlayer entirely** — zero consumers, broken type import from missing `@/types/transcript`. Dead code, recoverable from git history if needed later
- **loadFont.ts routes through api.ts** — loadFont calls api.getFontDir(), api.fileExists(), api.readFileAsBytes() instead of importing Tauri plugins directly. Maintains single I/O boundary
- **parseSproutVideoUrl.ts goes to internal/** — not exported from barrel, same pattern as Trello's internal utilities
- **UploadSprout.test.tsx moves into module** — co-located at features/Upload/components/UploadSprout.test.tsx with updated mock paths

### Sub-feature boundaries
- **Flat directory with naming prefixes** — hooks/useSproutVideoApi.ts, hooks/usePosterframeCanvas.ts, components/UploadSprout.tsx. No sub-directories per sub-feature (Sprout/, Posterframe/, Otter/). Consistent with Trello module's flat structure
- **Export all hooks from barrel** — all 9 hooks are public exports. Consumers decide what they need. Consistent with Trello pattern
- **Export all components including UploadOtter stub** — even the 7-line Otter stub is exported since the router needs it
- **Module types.ts re-exports from @shared/types** — consumers import types from `@features/Upload` barrel. Shared types stay in @shared/types. Upload-specific types also live here

### Cross-module migration order
- **Atomic single plan** — move all Upload files + update Trello imports + update Baker test mocks + update router imports in the same plan. No broken intermediate state
- **Update Baker VideoLinksManager.test.tsx** — change vi.mock paths from @hooks/useFileUpload to @features/Upload in this plan
- **Update app router/sidebar imports** — change from @pages/UploadSprout to @features/Upload in this plan
- **Document deferred BuildProject imports** — add comment in Posterframe.tsx noting useBackgroundFolder and useAutoFileSelection move to @features/BuildProject in Phase 8

### Plan granularity
- **1 plan total** — everything atomic: module structure, api.ts, file moves, consumer updates, contract tests
- **Shape + behavioral contract tests** — match Trello pattern with barrel shape validation + renderHook behavioral tests for key hooks
- **Fix alert() → toast in useFileUpload** — replace legacy alert() calls with sonner toast while moving the file. Small behavioral improvement, acceptable since we're already touching the code

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Internal file organization details within the flat structure
- Whether to split api.ts into sections with comments or keep it flat

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/Trello/` — exact module pattern to follow (api.ts, types.ts, index.ts, hooks/, internal/, __contracts__/)
- `src/features/Trello/__contracts__/trello.contract.test.ts` — contract test template with shape + behavioral tests
- `src/features/Auth/` and `src/features/Premiere/` — additional module pattern references
- Phase 2 `// Target: @features/Upload` tags on 10 hooks — migration guide

### Established Patterns
- api.ts wraps ALL external calls (invoke, fetch, file plugins, event listeners) — single I/O boundary per module
- Barrel-only imports enforced via eslint-plugin-boundaries (warnings)
- Named re-exports in barrels, no wildcards
- `__contracts__/` directory co-located with module
- `internal/` directory for non-exported utilities
- No barrel files in shared/ui/ — but feature modules do have barrels

### Integration Points
- `src/features/Trello/hooks/useVideoLinksManager.ts` — imports 4 Upload hooks, must update to @features/Upload barrel
- `src/features/Trello/__contracts__/trello.contract.test.ts` — mocks for Upload hooks need path updates
- `src/components/Baker/VideoLinksManager.test.tsx` — mocks for useFileUpload, useUploadEvents need path updates
- App router/sidebar — imports UploadSprout, Posterframe, UploadOtter from @pages/, must update to @features/Upload
- Posterframe.tsx — imports useBackgroundFolder, useAutoFileSelection from @hooks/ (deferred to Phase 8)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — following the established deep module pattern from Phase 3 verbatim, with the flat-with-prefixes directory structure confirmed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-upload-module*
*Context gathered: 2026-03-09*
