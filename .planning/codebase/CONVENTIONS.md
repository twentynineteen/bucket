# Coding Conventions

**Analysis Date:** 2026-03-07

## Naming Patterns

**Files:**
- Components: PascalCase (`AddFootageStep.tsx`, `VideoLinksManager.tsx`, `ThemeSelector.tsx`)
- Hooks: camelCase with `use` prefix (`useBreadcrumb.ts`, `useBakerScan.ts`, `useProjectState.ts`)
- Utilities: camelCase (`logger.ts`, `themeMapper.ts`, `breadcrumbsValidation.ts`)
- Types: camelCase or PascalCase (`baker.ts`, `customTheme.ts`, `media.ts`)
- Stores: camelCase with `use` prefix and `Store` suffix (`useBreadcrumbStore.ts`, `useAppStore.ts`)
- Constants: camelCase (`animations.ts`, `themes.ts`, `timing.ts`)
- Test files: Same name as source + `.test.tsx` or `.test.ts` (`ProjectListPanel.test.tsx`)

**Functions:**
- Use camelCase for all functions: `handleTitleChange`, `createProject`, `updateFileCamera`
- Event handlers: prefix with `handle` or `on` (`handleCreateProject`, `onSelectFiles`)
- Callbacks passed as props: prefix with `on` (`onProjectSelection`, `onProjectClick`)
- Factory/creator functions: prefix with `create` (`createNamespacedLogger`, `createQueryOptions`, `createMockQueryClient`)

**Variables:**
- Use camelCase: `selectedFolder`, `numCameras`, `copyProgress`
- Boolean variables: prefix with `is`, `has`, `show`, or `should` (`isLoading`, `hasBreadcrumbs`, `showSuccess`, `shouldReduceMotion`)
- Constants (module-level): UPPER_SNAKE_CASE (`CACHE`, `RETRY`, `QUERY_PROFILES`, `STEP_CARD_ANIMATION`)

**Types/Interfaces:**
- Use PascalCase: `ProjectFolder`, `BreadcrumbsFile`, `ScanOptions`
- Interface props: suffix with `Props` (`AddFootageStepProps`, `ButtonProps`)
- State interfaces: suffix with `State` (`BreadcrumbState`, `LoadingState`, `ProgressState`)

## Code Style

**Formatting:**
- Prettier with config at `.prettierrc.json`
- Print width: 90 characters
- Single quotes (no double quotes for strings)
- No semicolons
- No trailing commas
- Import sorting via `@ianvs/prettier-plugin-sort-imports`
- Tailwind class sorting via `prettier-plugin-tailwindcss`

**Run formatting:**
```bash
bun run prettier:fix       # Format all src/ files
```

**Linting:**
- ESLint 9 with flat config at `eslint.config.js`
- TypeScript-ESLint recommended rules
- React Hooks plugin (recommended rules)
- React Refresh plugin (warn on non-component exports)
- `no-console: 'error'` - use `logger` utility instead of `console.*`
- `complexity: ['warn', { max: 15 }]` - target is 10
- `max-depth: ['warn', { max: 5 }]` - target is 4
- `max-params: ['warn', { max: 6 }]` - target is 5

**Run linting:**
```bash
bun run eslint:fix         # Auto-fix linting issues
```

## Import Organization

**Order** (auto-sorted by prettier plugin):
1. External packages (`react`, `@tanstack/react-query`, `vitest`)
2. Aliased internal imports (`@components/*`, `@hooks/*`, `@utils/*`, `@lib/*`)
3. Relative imports (`./AddFootageStep`, `../setup/tauri-mocks`)

**Path Aliases** (defined in `tsconfig.json`, resolved by `vite-tsconfig-paths`):
- `@components/*` -> `src/components/*`
- `@hooks/*` -> `src/hooks/*`
- `@lib/*` -> `src/lib/*`
- `@utils/*` -> `src/utils/*`
- `@constants/*` -> `src/constants/*`
- `@store/*` -> `src/store/*`
- `@services/*` -> `src/services/*`
- `@pages/*` -> `src/pages/*`
- `@machines/*` -> `src/machines/*`
- `@context/*` -> `src/context/*`
- `@/*` -> `src/*`
- `@tests/*` -> `tests/*`

**Import example from `src/pages/BuildProject/BuildProject.tsx`:**
```typescript
import { useTrelloApiKeys } from '@hooks/useApiKeys'
import { useBuildProjectMachine } from '@hooks/useBuildProjectMachine'
import { createNamespacedLogger } from '@utils/logger'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { useBreadcrumb, useCameraAutoRemap, useProjectState, useUsername } from '@/hooks'

import { AddFootageStep } from './AddFootageStep'
import { CreateProjectStep } from './CreateProjectStep'
```

**Barrel exports:**
- Hooks use a barrel file at `src/hooks/index.ts` for commonly used hooks
- Import from barrel: `import { useBreadcrumb, useCameraAutoRemap } from '@/hooks'`
- Direct imports used for less common hooks: `import { useTrelloApiKeys } from '@hooks/useApiKeys'`

## Component Patterns

**Component declaration:**
- Use `React.FC` typing for components: `const BuildProject: React.FC = () => { ... }`
- Use named exports for sub-components: `export const AddFootageStep: React.FC<Props> = ({ ... }) => { ... }`
- Use default export for page-level components: `export default BuildProject`
- Define props interface inline above component

**Component structure (page components):**
```typescript
// 1. Imports (external, aliased, relative)
// 2. Logger instance
const logger = createNamespacedLogger('ComponentName')

// 3. Component
const PageComponent: React.FC = () => {
  // a. Custom hooks for state/logic
  const { state, actions } = useCustomHook()

  // b. Breadcrumb setup (memoized)
  const breadcrumbItems = useMemo(() => [...], [])
  useBreadcrumb(breadcrumbItems)

  // c. Event handlers
  const handleAction = () => { ... }

  // d. Effects (minimal - prefer React Query)
  useEffect(() => { ... }, [deps])

  // e. JSX return
  return (...)
}

export default PageComponent
```

**UI component structure (shadcn/ui pattern):**
- Located in `src/components/ui/`
- Use `cva` (class-variance-authority) for variant styling
- Use `cn()` utility from `@components/lib/utils` for class merging
- Support `asChild` prop pattern via Radix `Slot`

**Example from `src/components/ui/button.tsx`:**
```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center ...',
  {
    variants: {
      variant: { default: '...', destructive: '...', outline: '...', ghost: '...' },
      size: { default: '...', sm: '...', lg: '...', icon: '...' }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  // ...
}

export { Button, buttonVariants }
```

## State Management

**Zustand stores:**
- Located in `src/store/`
- Named with `use` prefix and `Store` suffix: `useBreadcrumbStore`, `useAppStore`
- Keep stores minimal - thin interface, simple state
- Example from `src/store/useBreadcrumbStore.ts`:
```typescript
export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  breadcrumbs: [],
  setBreadcrumbs: (items) => set({ breadcrumbs: items })
}))
```

**React Query (preferred for server/async state):**
- Use `createQueryOptions()` from `@lib/query-utils` with query profiles (`STATIC`, `DYNAMIC`, `REALTIME`, `EXTERNAL`)
- Use `queryKeys` factory from `@lib/query-keys` for consistent cache keys
- Query keys follow domain-based hierarchy: `['domain', 'action', ...identifiers]`
- Prefer React Query over `useEffect` for data fetching

**XState (complex workflows):**
- Used for multi-step workflows like BuildProject
- State machines in `src/machines/`
- Access via hooks: `useBuildProjectMachine()`

## Error Handling

**Patterns:**
- Use `toast.error()` from `sonner` for user-facing errors
- Use `logger.error()` / `logger.warn()` for development logging
- React Query handles retry logic via `retryStrategies` in `src/lib/query-utils.ts`
- Error types: `'network' | 'server' | 'validation' | 'timeout' | 'authentication' | 'system' | 'unknown'`
- Use `QueryErrorBoundary` component at app root (`src/components/ErrorBoundary`)

**Error display pattern from `src/pages/BuildProject/BuildProject.tsx`:**
```typescript
useEffect(() => {
  if (error) {
    toast.error(error, {
      duration: 5000,
      description: 'Please try again or contact support if the issue persists.'
    })
  }
}, [error])
```

## Logging

**Framework:** Custom logger utility at `src/utils/logger.ts`

**Rules:**
- NEVER use `console.*` directly - ESLint `no-console: 'error'` enforces this
- Use `logger` for general logging: `import { logger } from '@utils/logger'`
- Use `createNamespacedLogger` for module-specific logging: `const logger = createNamespacedLogger('BuildProject')`
- All logging is dev-only (noop in production via `import.meta.env.DEV`)
- Namespaced logger prefixes output: `[BuildProject] Component mounted`

**Available methods:**
- `logger.log()`, `logger.info()`, `logger.debug()`, `logger.trace()`
- `logger.error()`, `logger.warn()`
- `logger.group()`, `logger.groupEnd()`, `logger.table()`
- `logger.time()`, `logger.timeEnd()`

## Comments

**When to Comment:**
- JSDoc-style comments on type definitions (see `src/types/baker.ts`)
- Module-level doc comments explaining purpose (see `src/utils/logger.ts`)
- Inline comments for non-obvious business logic
- Deprecation notes on legacy fields: `// === DEPRECATED FIELD (keep for backward compatibility) ===`
- Phase/feature annotations: `// === NEW FIELDS (Phase 004) ===`

**Test comments:**
- File-level JSDoc with test purpose, feature reference, and methodology
- Test IDs for traceability: `test('T001: returns correct interface', ...)`

## Function Design

**Size:** Keep components and functions focused. Complex pages decompose into sub-components (e.g., BuildProject splits into `ProjectConfigurationStep`, `AddFootageStep`, `CreateProjectStep`, `SuccessSection`)

**Parameters:** Use props interfaces for components. Use options objects for hooks with multiple parameters:
```typescript
usePostProjectCompletion({
  isCreatingTemplate,
  isShowingSuccess,
  projectFolder,
  projectTitle: title,
  send,
  isIdle
})
```

**Return Values:** Hooks return destructurable objects with named properties:
```typescript
const { title, numCameras, files, setNumCameras, handleTitleChange } = useProjectState()
```

## Module Design

**Exports:**
- Named exports for utilities, hooks, and sub-components
- Default exports for page-level components
- Barrel files for hook re-exports (`src/hooks/index.ts`)

**Constants:**
- Centralized in `src/constants/` with domain-specific files
- `timing.ts` for cache/retry timing constants
- `animations.ts` for animation configuration
- `themes.ts` for theme registry

**Tailwind CSS:**
- Use Tailwind v4 with `@tailwindcss/postcss`
- CSS variables defined in `src/index.css` for theming
- Use semantic color tokens: `bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`
- Use `cn()` utility for conditional class merging

---

*Convention analysis: 2026-03-07*
