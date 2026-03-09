# Phase 5: Settings Module - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose the 527-line Settings.tsx monolith into per-domain sub-components within a `src/features/Settings/` deep feature module with barrel exports, API layer, and contract tests. Drop the ConnectedApps stub. No new capabilities — purely structural migration with monolith decomposition per STNG-02.

</domain>

<decisions>
## Implementation Decisions

### Monolith decomposition
- **5 sub-components, one per domain**: AIModelsSection, AppearanceSection, BackgroundsSection, SproutVideoSection, TrelloSection
- Each sub-component stays under ~100 lines, independently testable
- **Keep accordion layout** — each sub-component wraps its content in an AccordionItem, no visual change
- **Keep hash-based scroll navigation** — sidebar links with #ai-models, #appearance, etc. preserved with scrollIntoView
- **Each sub-component owns its save logic** — useMutation, validation, save button all self-contained. Parent Settings page is layout-only

### API layer scope
- **api.ts wraps everything**: Tauri plugin calls (openPath for folder picker, open for URLs) AND storage utils (loadApiKeys, saveApiKeys)
- Single I/O boundary — mock one file to isolate the entire module. Consistent with Phase 3/4 pattern
- **useAIProvider moves INTO Settings module** — single consumer (Settings only), its fetch() calls route through Settings api.ts
- **storage.ts (loadApiKeys, saveApiKeys) moves into Settings api.ts** — Settings is the only writer. Other modules read API keys from the Zustand store, not from storage directly

### ConnectedApps stub
- **Drop ConnectedApps.tsx entirely** — 8-line stub with no functionality. Delete file and remove its route. Recoverable from git history

### Cross-module imports
- **Keep TrelloBoardSelector import from @features/Trello barrel** — module-to-module imports through public interfaces, exactly what barrels are for
- **Keep ThemeSelector in @shared/ui/theme/** — multiple consumers (Settings + sidebar theme toggle). Phase 2 decision preserved
- **ApiKeyInput stays in @shared/ui/** — reusable UI primitive, not Settings-specific

### Contract tests
- **Fresh contract tests only** — delete existing Settings.test.tsx (363 lines), write new __contracts__/ tests following established pattern
- **Shape + Settings-owned behavior** — verify barrel exports the right members, test Settings-owned hooks/logic
- **Mock cross-module dependencies** — TrelloBoardSelector, ThemeSelector mocked in tests. Each module tests its own surface

### Plan granularity
- **1 plan total** — atomic: module structure, decompose monolith, build api.ts, move hooks, update consumers, contract tests. No broken intermediate state

### Claude's Discretion
- Exact sub-component file naming (flat with prefixes per Phase 4 convention)
- Internal organization of api.ts (sections, function grouping)
- Which hooks get behavioral tests vs shape-only in contracts
- How to handle the shared save infrastructure (React Query mutations) across sub-components
- Whether useAIProvider stays as a hook or gets absorbed into api.ts functions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/Trello/` — exact module pattern to follow (api.ts, types.ts, index.ts, hooks/, internal/, __contracts__/)
- `src/features/Upload/` — flat-with-prefixes directory structure pattern
- Phase 2 `// Target: @features/Settings` tags on hooks — migration guide
- `@shared/ui/ApiKeyInput` — reusable API key input component, stays shared
- `@shared/ui/accordion` — Radix accordion used for Settings sections

### Established Patterns
- api.ts wraps ALL external calls (invoke, fetch, file plugins, Tauri plugins) — single I/O boundary per module
- Flat directory with naming prefixes, not sub-directories per sub-feature (Phase 4)
- Named re-exports in barrels, no wildcards (Phase 2)
- `__contracts__/` directory co-located with module (Phase 2)
- React Query for data fetching with useMutation for saves

### Integration Points
- App router: Import Settings page from `@features/Settings` barrel (replace @pages/Settings)
- App router: Remove ConnectedApps route entirely
- Sidebar: Settings section links unchanged (hash anchors to same-page sections)
- `@features/Trello`: Settings imports TrelloBoardSelector through Trello barrel
- `@shared/ui/theme/ThemeSelector`: Settings imports for Appearance section
- `@shared/store/useAppStore`: Settings reads/writes API keys, Ollama URL, default folder
- `@shared/utils/storage`: loadApiKeys/saveApiKeys move INTO Settings api.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — following the established deep module pattern from Phases 3-4 verbatim, with per-domain sub-component decomposition as the key addition for this phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-settings-module*
*Context gathered: 2026-03-09*
