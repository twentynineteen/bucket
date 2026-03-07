# Testing Patterns

**Analysis Date:** 2026-03-07

## Test Framework

**Runner:**
- Vitest 3.2 (unit/integration/contract tests)
- Playwright 1.57 (E2E tests)
- Config: `vite.config.ts` (test section) for Vitest, `tests/e2e/playwright.config.ts` for Playwright

**Assertion Library:**
- Vitest `expect` with `@testing-library/jest-dom` matchers (`.toBeInTheDocument()`, `.toBeChecked()`, etc.)
- Playwright `expect` for E2E assertions

**Run Commands:**
```bash
bun run test               # Run Vitest in watch mode
bun run test:run           # Run Vitest once (CI mode)
bun run test:ui            # Vitest browser UI
bun run test:coverage      # Run with coverage report
bun run test:e2e           # Run Playwright E2E tests
bun run test:e2e:headed    # Run E2E with visible browser
bun run test:e2e:ui        # Playwright interactive UI mode
bun run test:e2e:debug     # Playwright debug mode
bun run test:e2e:report    # View HTML report
```

## Vitest Configuration

**From `vite.config.ts`:**
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./tests/setup/vitest-setup.ts', './tests/setup/msw-server.ts'],
  mockReset: true,
  exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**']
}
```

**Key settings:**
- `globals: true` - `describe`, `it`, `expect` available without import (but tests still import from vitest for clarity)
- `environment: 'jsdom'` - Browser-like environment for React components
- `mockReset: true` - All mocks reset between tests automatically
- E2E tests excluded from Vitest runs

## Test File Organization

**Location:** Tests are in a separate `tests/` directory (not co-located), with a few legacy co-located tests in `src/`:

```
tests/
├── setup/                    # Global test setup
│   ├── vitest-setup.ts       # Global mocks (Tauri, browser APIs, framer-motion)
│   ├── msw-server.ts         # MSW server with API handlers
│   ├── tauri-mocks.ts        # Tauri IPC mock (mockIPC) for contract tests
│   ├── framer-motion-mock.ts # Reusable framer-motion mock
│   ├── sprout-handlers.ts    # MSW handlers for Sprout Video API
│   └── trello-handlers.ts    # MSW handlers for Trello API
├── fixtures/                 # Test data files
│   └── baker-test-data/      # JSON fixtures and folder structures
├── unit/                     # Unit tests (largest category)
│   ├── components/           # Component tests
│   │   ├── Baker/            # Baker-specific component tests
│   │   ├── Settings/         # Settings component tests
│   │   ├── ui/               # UI primitive tests
│   │   └── *.test.tsx        # Other component tests
│   ├── hooks/                # Hook tests
│   ├── pages/                # Page-level tests
│   ├── services/             # Service tests
│   ├── utils/                # Utility tests
│   └── security/             # Security-focused tests
├── contract/                 # Tauri command contract tests
│   ├── baker-*.test.ts       # Baker command contracts
│   ├── useBreadcrumb.contract.test.tsx
│   └── *.contract.test.tsx   # Hook contract tests
├── integration/              # Integration tests
│   ├── baker-scan-workflow.test.ts
│   ├── example-management.test.tsx
│   └── *.test.ts             # Cross-module integration tests
├── lib/                      # Library utility tests
│   └── query-utils.test.ts
└── e2e/                      # Playwright E2E tests (separate runner)
    ├── specs/                # Test specs
    ├── pages/                # Page Object Models
    ├── fixtures/             # E2E fixtures and mocks
    └── utils/                # E2E utilities
```

**Legacy co-located tests** (in `src/`):
- `src/pages/Settings.test.tsx`
- `src/pages/UploadSprout.test.tsx`
- `src/components/Baker/VideoLinksManager.test.tsx`
- `src/components/nav-main.test.tsx`

**Naming:**
- Unit/integration: `{ComponentName}.test.tsx` or `{hookName}.test.ts`
- Animation tests: `{ComponentName}.animations.test.tsx`
- Contract tests: `{command-name}.test.ts` or `{hookName}.contract.test.tsx`
- E2E specs: `{feature}.spec.ts`
- E2E page objects: `{PageName}.ts` or `{page-name}.page.ts`

## Test Structure

**Suite Organization:**
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('ComponentName - Feature Description', () => {
  // Mock data
  const mockData = { ... }
  const defaultProps = { ... }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render all projects', () => {
      render(<Component {...defaultProps} />)
      expect(screen.getByText('...')).toBeInTheDocument()
    })
  })

  describe('Interaction Behavior', () => {
    it('should handle click', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Component onClick={onClick} />)
      await user.click(screen.getByText('...'))
      expect(onClick).toHaveBeenCalledWith('...')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty state', () => { ... })
  })
})
```

**TDD methodology explicitly used:**
- Tests reference TDD phases: `// TDD Methodology: RED -> GREEN -> REFACTOR`
- Test IDs for traceability: `test('T001: returns correct interface', ...)`
- Contract tests written before implementation
- Some tests contain commented-out assertions (RED phase placeholders)

**Patterns:**
- Setup: `beforeEach(() => { vi.clearAllMocks() })` for every suite
- Teardown: Global `afterEach(() => { vi.clearAllMocks() })` in vitest-setup.ts
- Restore: Global `afterAll(() => { vi.restoreAllMocks() })` in vitest-setup.ts
- Assertion: Use Testing Library queries (`getByText`, `getByRole`, `getAllByRole`)
- User events: Always `const user = userEvent.setup()` before interactions

## Mocking

**Framework:** Vitest `vi.mock()` and `vi.fn()`

**Global mocks (in `tests/setup/vitest-setup.ts`):**
- `window.matchMedia` - Required for framer-motion and media queries
- `framer-motion` - Complete mock replacing motion components with plain HTML
- `@tauri-apps/api/window` - Mock `getCurrentWindow()` with position/size/theme
- `@tauri-apps/api/event` - Mock `listen()` and `emit()`
- `@tauri-apps/api/app` - Mock `getVersion()`
- `@tauri-apps/plugin-dialog` - Mock `open()`
- `@tauri-apps/plugin-shell` - Mock `open()`
- `@tauri-apps/plugin-process` - Mock `relaunch()`
- `@tauri-apps/plugin-updater` - Mock `check()`
- `@tauri-apps/plugin-store` - Mock `get/set/del()`
- `@tauri-apps/api/path` - Mock `appDataDir()` etc.
- `window.__TAURI_INTERNALS__` - Mock Tauri runtime internals
- `ResizeObserver` - Required for `@tanstack/react-virtual`
- `Element.prototype.getBoundingClientRect` - For virtual scrolling
- `AbortSignal.timeout` - Polyfill for Node.js

**Hook mocking pattern (most common):**
```typescript
// 1. Import as module namespace
import * as useApiKeysModule from '@hooks/useApiKeys'

// 2. Mock the module
vi.mock('@hooks/useApiKeys')

// 3. Set return values in beforeEach
beforeEach(() => {
  vi.mocked(useApiKeysModule.useSproutVideoApiKey).mockReturnValue({
    apiKey: 'test-api-key',
    isLoading: false,
    error: null
  })
})
```

**Tauri IPC mocking for contract tests:**
```typescript
import { mockIPC } from '@tauri-apps/api/mocks'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_start_scan Contract', () => {
  beforeAll(() => {
    setupTauriMocks()  // Sets up mockIPC with command handlers
  })

  test('should return scan ID', async () => {
    const result = await invoke('baker_start_scan', { rootPath: '/path', options: {} })
    expect(result).toMatch(/^[a-f0-9-]+$/i)
  })
})
```

**MSW (Mock Service Worker) for HTTP APIs:**
```typescript
// tests/setup/msw-server.ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const handlers = [
  http.get('/api/projects', () => HttpResponse.json({ projects: [...] })),
  ...trelloHandlers,
  ...sproutHandlers,
]

export const server = setupServer(...handlers)

// Helper utilities exported:
export const simulateNetworkError = (endpoint: string) => { ... }
export const simulateServerError = (endpoint: string, status, message) => { ... }
export const mockApiResponse = (endpoint: string, responseData, status) => { ... }
```

**What to Mock:**
- All Tauri APIs (`@tauri-apps/*`) - desktop APIs unavailable in test environment
- External HTTP APIs (via MSW) - Trello, Sprout Video
- framer-motion - Avoid animation complexity in unit tests
- Browser APIs not in jsdom (`matchMedia`, `ResizeObserver`)

**What NOT to Mock:**
- React Query internals - use real `QueryClient` with `retry: false`
- React Router - use real routing when needed
- Component internals - test behavior, not implementation
- Zustand stores - test with real stores when possible

## Fixtures and Factories

**Test Data:**
```typescript
// Inline mock data in test files (most common pattern)
const mockProjects: ProjectFolder[] = [
  {
    name: 'Project A',
    path: '/path/to/project-a',
    isValid: true,
    hasBreadcrumbs: true,
    staleBreadcrumbs: false,
    invalidBreadcrumbs: false,
    cameraCount: 3,
    lastScanned: '2025-12-11T10:00:00.000Z',
    validationErrors: []
  }
]

// Factory functions for complex types
const createMockSproutUploadResponse = (
  overrides?: Partial<SproutUploadResponse>
): SproutUploadResponse => ({
  id: 'test-video-id',
  title: 'Test Video',
  // ... all required fields
  ...overrides
})
```

**QueryClient wrapper for hook tests:**
```typescript
// From tests/setup/vitest-setup.ts
export const createWrapper = (queryClient?: any) => {
  return ({ children }: { children: React.ReactNode }) => {
    const client = queryClient || new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false }
      }
    })
    return React.createElement(QueryClientProvider, { client }, children)
  }
}

// Usage in tests:
const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() })
```

**File fixtures:**
- `tests/fixtures/baker-test-data/` - Directory with mock project structures
- `tests/e2e/fixtures/mock-file-data.ts` - E2E mock file data
- `tests/e2e/fixtures/tauri-e2e-mocks.ts` - E2E Tauri mock setup

## Coverage

**Requirements:** None formally enforced (no coverage thresholds configured)

**View Coverage:**
```bash
bun run test:coverage      # Generates coverage report
```

## Test Types

**Unit Tests (~80+ files in `tests/unit/`):**
- Scope: Individual components, hooks, utilities, services
- Pattern: Render component or `renderHook()`, assert on behavior
- Most numerous test type
- Categories: components, hooks, pages, services, utils, security, constants

**Contract Tests (~15 files in `tests/contract/`):**
- Scope: Tauri command interfaces, hook return shapes
- Pattern: Call `invoke()` with mocked IPC, verify response shape and validation
- Test the API contract between frontend and Rust backend
- Use `setupTauriMocks()` from `tests/setup/tauri-mocks.ts`

**Integration Tests (~6 files in `tests/integration/`):**
- Scope: Cross-module workflows, multi-hook interactions
- Examples: `baker-scan-workflow.test.ts`, `scriptFormatter.test.ts`, `retryLogic.test.ts`
- Test multiple hooks/services working together

**Component Tests (~3 files in `tests/component/`):**
- Scope: Full page-level component rendering
- Examples: `BakerPage.test.tsx`, `SettingsPage.test.tsx`, `UploadTrelloPage.test.tsx`

**E2E Tests (Playwright, in `tests/e2e/`):**
- Scope: Full application workflows via browser
- Uses Page Object Model pattern (`tests/e2e/pages/`)
- Fixtures at `tests/e2e/fixtures/`
- Config: Chromium + WebKit, screenshot on failure, trace on retry
- Web server auto-started on port 1422

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const user = userEvent.setup()
  render(<Component />)

  await user.click(screen.getByRole('button'))

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})
```

**Error Testing:**
```typescript
it('should handle error gracefully', async () => {
  vi.mocked(readTextFile).mockRejectedValue(new Error('File not found'))

  const { result } = renderHook(() => useMyHook())

  const errors = await result.current.doAction(['/path'])

  expect(errors).toHaveLength(1)
  expect(errors[0].error).toContain('File not found')
  expect(logger.warn).toHaveBeenCalled()
})
```

**Testing React Query hooks:**
```typescript
it('should fetch data', async () => {
  const { result } = renderHook(() => useMyQueryHook(), {
    wrapper: createWrapper()
  })

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false)
  })

  expect(result.current.data).toBeDefined()
})
```

**Testing component with QueryClient:**
```typescript
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}
```

**E2E Page Object Model:**
```typescript
// tests/e2e/pages/BuildProjectPage.ts
export class BuildProjectPage {
  readonly page: Page
  readonly titleInput: Locator
  readonly createProjectButton: Locator

  constructor(page: Page) {
    this.page = page
    this.titleInput = page.getByPlaceholder('e.g. DBA - IB1234...')
    this.createProjectButton = page.getByRole('button', { name: 'Create Project' })
  }

  async goto(): Promise<void> { ... }
  async fillProjectDetails(title: string, cameras: number): Promise<void> { ... }
}
```

**E2E test structure:**
```typescript
import { expect, test } from '../fixtures/app.fixture'
import { setupTauriMocks } from '../fixtures/mocks.fixture'

test.describe('Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('app loads successfully', async ({ appReady }) => {
    await expect(appReady).toHaveTitle(/Bucket/)
  })
})
```

## Adding New Tests

**For a new component:**
1. Create `tests/unit/components/{ComponentName}.test.tsx`
2. Import component, render with required providers (QueryClient if needed)
3. Test rendering, interactions, edge cases
4. Mock all Tauri/external dependencies

**For a new hook:**
1. Create `tests/unit/hooks/{useHookName}.test.ts(x)`
2. Use `renderHook()` with `createWrapper()` for React Query hooks
3. Test return interface, state transitions, error handling
4. Mock Tauri commands via `vi.mock('@tauri-apps/api/core')`

**For a new Tauri command contract:**
1. Create `tests/contract/{command-name}.test.ts`
2. Add mock handler in `tests/setup/tauri-mocks.ts` (in the `mockIPC` switch)
3. Test valid inputs, validation errors, edge cases

**For a new E2E workflow:**
1. Create Page Object in `tests/e2e/pages/{PageName}.ts`
2. Create spec in `tests/e2e/specs/{feature}.spec.ts`
3. Use `setupTauriMocks(page)` in `beforeEach`
4. Run with `bun run test:e2e`

---

*Testing analysis: 2026-03-07*
