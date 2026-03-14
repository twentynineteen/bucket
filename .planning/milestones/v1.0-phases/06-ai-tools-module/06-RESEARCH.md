# Phase 6: AI Tools Module - Research

**Researched:** 2026-03-09
**Domain:** Feature module refactoring -- structural migration of AI/ScriptFormatter and AI/ExampleEmbeddings into unified deep module
**Confidence:** HIGH

## Summary

Phase 6 is a structural migration that consolidates two existing AI sub-features (ScriptFormatter and ExampleEmbeddings) from `src/pages/AI/` and `src/hooks/` into a single `src/features/AITools/` deep module. This follows the established pattern from Phases 3-5 with one key structural addition: sub-directories per sub-feature due to module size (16 hooks + 25 components). The migration involves creating an api.ts I/O boundary wrapping 7 distinct external call types (3 invoke commands, 2 Tauri plugins, 1 fetch API, 1 service import), moving all AI-tagged hooks and components, updating 1 consumer (AppRouter.tsx), and writing contract tests.

The module is self-contained with no external consumers of AI hooks beyond the AI pages themselves. Settings/AIModelsSection does NOT import any AI hooks -- it uses its own Settings-internal useAIProvider. The only router integration point is AppRouter.tsx importing ScriptFormatter and ExampleEmbeddings page components.

**Primary recommendation:** Execute as a single atomic plan (consistent with Phases 4/5) with 2 tasks: (1) create module structure + move files + update consumers, (2) write contract tests and verify suite.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sub-directories per sub-feature** -- ScriptFormatter/ and ExampleEmbeddings/ inside the module, each with components/ and hooks/ sub-dirs. Justified deviation from Phase 4 flat pattern due to module size (16 hooks + 25 components)
- **Single shared api.ts at module root** -- wraps all invoke/plugin calls for both sub-features. Maintains single-I/O-boundary pattern from Phases 3-5
- **Single shared types.ts at module root** -- both sub-features share types like SimilarExample. Re-exports relevant types from @shared/types
- **No internal barrel files** -- only one barrel at AITools/index.ts. Internal components use direct relative imports. Consistent with Phase 2 convention
- **Drop useTranscript entirely** -- zero consumers, dead code. Recoverable from git history
- **Move useUploadDialogForm.ts as-is** -- from src/pages/AI/ExampleEmbeddings/hooks/ to features/AITools/ExampleEmbeddings/hooks/. Proper hook with form state logic
- **Move aiPrompts.ts into AITools/internal/** -- only AI hooks consume it. AI-specific prompt engineering, not a shared utility. Not exported from barrel
- **Selective exports only** -- barrel exports entry-point hooks (useScriptFormatterState, useExampleManagement, useScriptFileUpload) and page components (ScriptFormatter, ExampleEmbeddings). Internal plumbing hooks NOT exported
- **Step sub-components internal only** -- SelectModelStep, ProcessingStep, ReviewStep, DownloadCompleteStep, WorkflowIndicator are internal to ScriptFormatter
- **ExampleEmbeddings sub-components internal only** -- ExampleCard, ExampleList, UploadDialog, ReplaceDialog, ViewExampleDialog, DeleteConfirm are internal
- **1 atomic plan** -- module structure, api.ts, file moves, consumer updates, contract tests. No broken intermediate state

### Claude's Discretion
- Exact api.ts function signatures and parameter naming
- Contract test selection (which hooks get behavioral tests vs shape-only)
- Whether to replace alert() calls with logger/toast while moving files (same as Phase 4/5 approach)
- Internal file organization within sub-feature directories
- Which hooks belong to ScriptFormatter vs ExampleEmbeddings vs shared (hook assignment to sub-features)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AITL-01 | User can import AITools components, hooks, and types from `@features/AITools` barrel only | Barrel pattern established in all prior modules (Settings, Trello, Upload, Auth, Premiere). Selective exports per CONTEXT.md decision |
| AITL-02 | User can see an API layer wrapping AI-related Tauri commands (RAG, embeddings) | 7 I/O boundaries identified: 3 invoke commands, open/readTextFile/save/writeFile from Tauri plugins, fetch() to Ollama, ModelFactory/providerRegistry from services |
| AITL-03 | User can see contract tests validating AITools module's public interface | Contract test template from Trello/Settings with shape + behavioral tests |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3 | UI framework | Project standard |
| TypeScript | 5.7 | Type safety | Project standard |
| Vitest | latest | Test framework | Project standard, used for all contract tests |
| @testing-library/react | latest | Hook/component testing | Used in all prior contract tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api/core | 2.x | invoke() for Tauri commands | Wrapped by api.ts |
| @tauri-apps/plugin-dialog | 2.x | File open/save dialogs | Used by useScriptFileUpload, useDocxGenerator |
| @tauri-apps/plugin-fs | 2.x | readTextFile, writeFile | Used by useScriptFileUpload, useDocxGenerator |
| @tanstack/react-query | latest | Data fetching/mutations | Used by useExampleManagement, useScriptRetrieval |
| ai (Vercel AI SDK) | latest | streamText for AI processing | Used by useScriptProcessor |
| docx | latest | DOCX generation | Used by useDocxGenerator |
| @xenova/transformers | latest | Client-side embeddings | Used by useEmbedding |

### Alternatives Considered
None -- this is a structural migration, not a technology choice.

## Architecture Patterns

### Recommended Project Structure
```
src/features/AITools/
├── index.ts                    # Barrel: selective exports only
├── api.ts                      # Single I/O boundary for all AI external calls
├── types.ts                    # Shared types (SimilarExample, exampleEmbeddings types, scriptFormatter types)
├── internal/
│   └── aiPrompts.ts            # AI prompt engineering (not exported)
├── ScriptFormatter/
│   ├── components/
│   │   ├── ScriptFormatter.tsx # Page component (exported from barrel)
│   │   ├── DiffEditor.tsx
│   │   ├── ExampleToggleList.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ProviderSelector.tsx
│   │   ├── SaveExampleDialog.tsx
│   │   ├── FileUploader.tsx
│   │   └── steps/
│   │       ├── SelectModelStep.tsx
│   │       ├── ProcessingStep.tsx
│   │       ├── ReviewStep.tsx
│   │       ├── DownloadCompleteStep.tsx
│   │       └── WorkflowIndicator.tsx
│   └── hooks/
│       ├── useScriptFormatterState.ts  # Entry-point hook (exported from barrel)
│       ├── useScriptProcessor.ts       # Internal
│       ├── useScriptRetrieval.ts       # Internal
│       ├── useScriptUpload.ts          # Internal
│       ├── useScriptDownload.ts        # Internal
│       ├── useScriptReview.ts          # Internal
│       ├── useScriptWorkflow.ts        # Internal
│       ├── useAIModels.ts              # Internal
│       ├── useAIProcessing.ts          # Internal
│       ├── useDocxParser.ts            # Internal
│       ├── useDocxGenerator.ts         # Internal
│       ├── useEmbedding.ts             # Internal
│       └── useOllamaEmbedding.ts       # Internal
├── ExampleEmbeddings/
│   ├── components/
│   │   ├── ExampleEmbeddings.tsx  # Page component (exported from barrel)
│   │   ├── ExampleCard.tsx
│   │   ├── ExampleList.tsx
│   │   ├── UploadDialog.tsx
│   │   ├── ReplaceDialog.tsx
│   │   ├── ViewExampleDialog.tsx
│   │   ├── DeleteConfirm.tsx
│   │   └── components/           # Nested sub-components
│   │       ├── ModelStatusIndicator.tsx
│   │       ├── UploadSuccessView.tsx
│   │       ├── FileInputField.tsx
│   │       └── index.ts
│   └── hooks/
│       ├── useExampleManagement.ts  # Entry-point hook (exported from barrel)
│       ├── useScriptFileUpload.ts   # Entry-point hook (exported from barrel)
│       └── useUploadDialogForm.ts   # Internal
└── __contracts__/
    └── aitools.contract.test.ts
```

### Pattern 1: api.ts I/O Boundary
**What:** Single file wrapping ALL external calls for both sub-features
**When to use:** Always -- established convention from Phases 3-5
**I/O calls to wrap (catalogued from hook source code):**

```typescript
// From useExampleManagement.ts -- 4 invoke commands:
invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')
invoke<string>('upload_example', { request })
invoke<void>('replace_example', { id, request })
invoke<void>('delete_example', { id })

// From useScriptRetrieval.ts + useScriptProcessor.ts -- 1 invoke command:
invoke<SimilarExample[]>('search_similar_scripts', { queryEmbedding, topK, minSimilarity })

// From useScriptFileUpload.ts -- 2 Tauri plugin calls:
open({ multiple: false, filters: [...] })      // @tauri-apps/plugin-dialog
readTextFile(path)                              // @tauri-apps/plugin-fs

// From useDocxGenerator.ts -- 2 Tauri plugin calls:
save({ defaultPath, filters: [...] })           // @tauri-apps/plugin-dialog
writeFile(path, data)                           // @tauri-apps/plugin-fs

// From useOllamaEmbedding.ts -- 2 fetch calls:
fetch(`${OLLAMA_BASE_URL}/api/tags`)            // Check model availability
fetch(`${OLLAMA_BASE_URL}/api/embeddings`)      // Generate embeddings

// From useScriptProcessor.ts -- 2 service imports:
ModelFactory.createModel(...)                    // @services/ai/modelFactory
// (providerRegistry used by useAIModels, already wrapped in Settings api.ts)

// From useAIModels.ts -- 1 service import:
providerRegistry.list() / providerRegistry.get() // @services/ai/providerConfig
```

**Confidence:** HIGH -- catalogued from direct source code analysis

### Pattern 2: Selective Barrel Exports
**What:** Only entry-point hooks and page components exported; all plumbing stays internal
**Exported items (per CONTEXT.md):**

```typescript
// index.ts
// Components
export { ScriptFormatter } from './ScriptFormatter/components/ScriptFormatter'
export { ExampleEmbeddings } from './ExampleEmbeddings/components/ExampleEmbeddings'

// Hooks
export { useScriptFormatterState } from './ScriptFormatter/hooks/useScriptFormatterState'
export { useExampleManagement } from './ExampleEmbeddings/hooks/useExampleManagement'
export { useScriptFileUpload } from './ExampleEmbeddings/hooks/useScriptFileUpload'

// Types (re-export shared types consumers need)
export type { SimilarExample } from './types'
// ... other types as needed
```

### Pattern 3: Internal Directory for Non-Exported Utilities
**What:** `internal/` directory for module-scoped utilities not exposed via barrel
**Precedent:** Trello module uses `internal/` for TrelloCards.ts, trelloBoardValidation.ts, TrelloCardList.tsx, TrelloCardMembers.tsx

### Anti-Patterns to Avoid
- **Do NOT create barrel files in sub-feature directories** -- only one barrel at AITools/index.ts (Phase 2 convention)
- **Do NOT export internal plumbing hooks** -- useScriptProcessor, useEmbedding, etc. are implementation details
- **Do NOT leave invoke() calls in hooks** -- all must route through api.ts
- **Do NOT keep aiPrompts.ts in src/utils/** -- it belongs in AITools/internal/ (AI-specific, not shared)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contract test structure | Custom test patterns | Copy Trello/Settings contract test template | Consistent pattern across all modules |
| api.ts function signatures | Arbitrary wrappers | Match invoke command names from Rust backend | Type safety and discoverability |
| Mock strategy | Individual mock setups | Mock api.ts as single boundary (vi.mock('../api')) | Established pattern, single mock point |

**Key insight:** This is purely structural migration. No new functionality. Every piece of code already exists and works -- the task is moving files and updating import paths.

## Common Pitfalls

### Pitfall 1: Circular Dependencies Between Sub-Features
**What goes wrong:** ScriptFormatter hooks import from ExampleEmbeddings or vice versa, creating circular module references
**Why it happens:** SimilarExample type is defined in useScriptRetrieval but used by aiPrompts.ts; useScriptProcessor uses useOllamaEmbedding
**How to avoid:** Move SimilarExample to shared types.ts at module root. Embedding hooks (useEmbedding, useOllamaEmbedding) serve both sub-features, so they belong in ScriptFormatter/hooks/ since that's their primary consumer (useScriptProcessor), with ExampleEmbeddings importing from sibling path
**Warning signs:** TypeScript circular reference errors, import paths going ../ multiple levels

### Pitfall 2: Missing Import Updates
**What goes wrong:** After moving hooks, some file still imports from old `@hooks/useScriptFormatterState` path
**Why it happens:** 15+ hooks need path updates, easy to miss one
**How to avoid:** After all moves, run `grep -r "from '@hooks/use(Script|AI|Example|Embedding|Ollama|Docx)" src/` to verify zero hits. Also `grep -r "from.*pages/AI" src/` for component imports
**Warning signs:** TypeScript compilation errors on missing modules

### Pitfall 3: useTranscript Has Hidden Consumers
**What goes wrong:** Deleting useTranscript breaks something unexpected
**Why it happens:** Dead code assumption may be wrong
**How to avoid:** Verify with `grep -r "useTranscript" src/` before deleting -- confirmed zero consumers in current codebase
**Warning signs:** Runtime errors after deletion

### Pitfall 4: Hook Assignment Ambiguity
**What goes wrong:** Hooks placed in wrong sub-feature directory, causing confusing import paths
**Why it happens:** Some hooks serve both sub-features (useOllamaEmbedding, useEmbedding)
**How to avoid:** Follow dependency chain: useScriptProcessor -> useOllamaEmbedding -> fetch(). Place embedding hooks in ScriptFormatter since that's the primary consumer. useExampleManagement and useScriptFileUpload go to ExampleEmbeddings per CONTEXT.md
**Warning signs:** Deep relative imports crossing sub-feature boundaries

### Pitfall 5: SimilarExample Type Import Chain
**What goes wrong:** aiPrompts.ts imports SimilarExample from `@hooks/useScriptRetrieval` which no longer exists
**Why it happens:** Type is currently defined in useScriptRetrieval.ts and imported by aiPrompts.ts
**How to avoid:** Move SimilarExample to types.ts at module root. Update both useScriptRetrieval and aiPrompts.ts to import from types.ts
**Warning signs:** TypeScript errors about missing type exports

### Pitfall 6: ModelFactory and providerRegistry Service Imports
**What goes wrong:** api.ts wraps invoke() and Tauri plugins but forgets to wrap service imports
**Why it happens:** ModelFactory.createModel() and providerRegistry are I/O-adjacent (they configure HTTP clients) but aren't Tauri commands
**How to avoid:** Include ModelFactory.createModel and providerRegistry calls in api.ts. These are external service boundaries that should be mockable via the single api.ts mock point
**Warning signs:** Contract tests needing to mock @services/ai/* separately instead of just api.ts

## Code Examples

### api.ts Function Signatures (Recommended)

```typescript
// Source: Catalogued from existing hook source code

import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeFile } from '@tauri-apps/plugin-fs'
import { ModelFactory } from '@services/ai/modelFactory'
import { providerRegistry } from '@services/ai/providerConfig'

import type { ExampleWithMetadata, ReplaceRequest, UploadRequest } from './types'
import type { SimilarExample } from './types'
import type { ProviderConfiguration } from '@/types/scriptFormatter'

// --- Embedding Commands ---

export async function getAllExamples(): Promise<ExampleWithMetadata[]> {
  return invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')
}

export async function uploadExample(request: UploadRequest): Promise<string> {
  return invoke<string>('upload_example', { request })
}

export async function replaceExample(id: string, request: ReplaceRequest): Promise<void> {
  return invoke<void>('replace_example', { id, request })
}

export async function deleteExample(id: string): Promise<void> {
  return invoke<void>('delete_example', { id })
}

// --- RAG Search ---

export async function searchSimilarScripts(
  queryEmbedding: number[],
  topK: number,
  minSimilarity: number
): Promise<SimilarExample[]> {
  return invoke<SimilarExample[]>('search_similar_scripts', {
    queryEmbedding,
    topK,
    minSimilarity
  })
}

// --- File Dialog ---

export async function openScriptFileDialog(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  })
  return typeof result === 'string' ? result : null
}

export async function saveDocxDialog(defaultFilename: string): Promise<string | null> {
  return saveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
}

// --- File System ---

export async function readScriptFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeDocxFile(path: string, data: Uint8Array): Promise<void> {
  return writeFile(path, data)
}

// --- Ollama Embedding ---

export async function checkOllamaModels(baseUrl: string): Promise<OllamaTagsResponse> {
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error('Ollama is not running')
  return response.json()
}

export async function generateOllamaEmbedding(
  baseUrl: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(30000)
  })
  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
  const data = await response.json()
  return data.embedding
}

// --- AI Model ---

export function createAIModel(config: {
  providerId: string
  modelId: string
  configuration: ProviderConfiguration
}) {
  return ModelFactory.createModel(config)
}

export function listAIProviders() {
  return providerRegistry.list()
}

export function getAIProvider(id: string) {
  return providerRegistry.get(id)
}
```

### Contract Test Structure (Recommended)

```typescript
// Source: Adapted from Settings/Trello contract test patterns

// Mock api.ts as single I/O boundary
vi.mock('../api', () => ({
  getAllExamples: vi.fn().mockResolvedValue([]),
  uploadExample: vi.fn().mockResolvedValue('new-id'),
  replaceExample: vi.fn().mockResolvedValue(undefined),
  deleteExample: vi.fn().mockResolvedValue(undefined),
  searchSimilarScripts: vi.fn().mockResolvedValue([]),
  openScriptFileDialog: vi.fn().mockResolvedValue(null),
  saveDocxDialog: vi.fn().mockResolvedValue(null),
  readScriptFile: vi.fn().mockResolvedValue('test content'),
  writeDocxFile: vi.fn().mockResolvedValue(undefined),
  checkOllamaModels: vi.fn().mockResolvedValue({ models: [] }),
  generateOllamaEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
  createAIModel: vi.fn(),
  listAIProviders: vi.fn().mockReturnValue([]),
  getAIProvider: vi.fn()
}))

// Shape test: barrel exports exactly expected members
describe('AITools Barrel Exports - Shape', () => {
  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(aitoolsBarrel).sort()
    expect(exportNames).toEqual([
      'ExampleEmbeddings',
      'ScriptFormatter',
      'useExampleManagement',
      'useScriptFileUpload',
      'useScriptFormatterState'
    ].sort())
  })
})
```

### Barrel Export Pattern

```typescript
// Source: Established pattern from Settings, Trello, Upload modules

// index.ts -- Named re-exports only, no wildcards
// Components
export { ExampleEmbeddings } from './ExampleEmbeddings/components/ExampleEmbeddings'
export { default as ScriptFormatter } from './ScriptFormatter/components/ScriptFormatter'

// Hooks
export { useScriptFormatterState } from './ScriptFormatter/hooks/useScriptFormatterState'
export { useExampleManagement } from './ExampleEmbeddings/hooks/useExampleManagement'
export { useScriptFileUpload } from './ExampleEmbeddings/hooks/useScriptFileUpload'

// Types
export type { SimilarExample } from './types'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hooks in src/hooks/ with `// Target` tags | Hooks colocated in feature module | Phase 3 (2026-03) | Clean module boundaries |
| Direct invoke() in hooks | api.ts single I/O boundary | Phase 3 (2026-03) | Single mock point for testing |
| Pages in src/pages/ | Feature modules in src/features/ | Phase 3 (2026-03) | Encapsulation and barrel exports |
| Flat component layout | Sub-directories for large modules | Phase 6 (new for AITools) | Handles 16 hooks + 25 components |

**Deprecated/outdated:**
- `src/hooks/useTranscript.ts`: Dead code, zero consumers. Delete during migration.

## Open Questions

1. **Hook ownership: useEmbedding vs useOllamaEmbedding**
   - What we know: useOllamaEmbedding is used by useScriptProcessor (ScriptFormatter). useEmbedding uses @xenova/transformers and is a fallback/alternative embedding strategy
   - What's unclear: Whether useEmbedding is actually used by any active code path
   - Recommendation: Place both in ScriptFormatter/hooks/ since useScriptProcessor is their consumer. Verify useEmbedding usage -- if zero consumers, consider dropping it alongside useTranscript

2. **ExampleEmbeddings sub-components/index.ts**
   - What we know: src/pages/AI/ExampleEmbeddings/components/index.ts exists as a local barrel
   - What's unclear: Whether this violates the "no internal barrel files" convention
   - Recommendation: Remove this internal index.ts during migration. Convert imports to direct paths. Consistent with Phase 2 convention

3. **Type consolidation scope**
   - What we know: SimilarExample is in useScriptRetrieval.ts, exampleEmbeddings types are in src/types/exampleEmbeddings.ts, scriptFormatter types are in src/types/scriptFormatter.ts
   - What's unclear: Whether to move all types into AITools/types.ts or keep external type files
   - Recommendation: Move AI-specific types (SimilarExample, ExampleWithMetadata, UploadRequest, etc.) into AITools/types.ts. Leave scriptFormatter types in src/types/ for now since they may be used by Settings/AIModelsSection (ProviderConfiguration type)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | vitest.config.ts |
| Quick run command | `bun run test -- --run src/features/AITools/__contracts__/aitools.contract.test.ts` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AITL-01 | Barrel exports exactly expected members | unit (shape) | `bun run test -- --run src/features/AITools/__contracts__/aitools.contract.test.ts` | Wave 0 |
| AITL-02 | api.ts exports all expected functions | unit (shape) | `bun run test -- --run src/features/AITools/__contracts__/aitools.contract.test.ts` | Wave 0 |
| AITL-03 | Contract tests validate public interface | unit (shape + behavioral) | `bun run test -- --run src/features/AITools/__contracts__/aitools.contract.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run src/features/AITools/__contracts__/aitools.contract.test.ts`
- **Per wave merge:** `bun run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/AITools/__contracts__/aitools.contract.test.ts` -- covers AITL-01, AITL-02, AITL-03
- No framework install needed -- Vitest already configured
- No shared fixtures needed -- api.ts mock is self-contained per test file

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of all 16 AI hooks in src/hooks/
- Direct source code analysis of all 25 AI components in src/pages/AI/
- Direct source code analysis of src/utils/aiPrompts.ts
- Direct source code analysis of completed modules: Settings, Trello, Upload, Auth, Premiere
- Contract test patterns from src/features/Settings/__contracts__/, src/features/Trello/__contracts__/
- Phase 5 plan (05-01-PLAN.md) -- latest execution template

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions and code_context section

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, purely structural migration
- Architecture: HIGH - all patterns established in Phases 3-5, verified from source
- Pitfalls: HIGH - catalogued from actual code analysis of import chains and type dependencies
- I/O boundary catalog: HIGH - every invoke/fetch/plugin call verified from hook source code

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- structural migration patterns don't change)
