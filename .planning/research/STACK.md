# Technology Stack: Module Boundary Enforcement

**Project:** Bucket Deep Module Refactor
**Researched:** 2026-03-07

## Recommended Stack

This stack adds tooling to enforce the deep module architecture described in PROJECT.md. No framework changes -- these are dev dependencies for linting, dead code detection, and contract testing patterns on top of the existing Vitest + ESLint setup.

### Module Boundary Enforcement (Lint-Time)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `eslint-plugin-boundaries` | 5.4.0 | Enforce import rules between feature modules | The only mature ESLint plugin purpose-built for architectural boundary enforcement. Has 7 rules covering element types, entry points, external deps, and private internals. Supports ESLint flat config. Active maintenance (published 19 days ago). |
| ESLint `no-restricted-imports` | (built-in) | Block specific cross-module deep imports | Already available in ESLint -- zero install cost. Use as a safety net alongside boundaries plugin for explicit blocklist patterns. |
| `@typescript-eslint/no-restricted-imports` | (existing) | Type-aware import restrictions | Already in the project's typescript-eslint setup. Handles type-only import edge cases that the base rule misses. |

### Dead Code Detection (CI/Pre-commit)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `knip` | 5.85.x | Find unused files, exports, and dependencies | Best-in-class dead code detector for TypeScript. Has a Vitest plugin built-in, understands barrel exports natively. Critical during refactor to catch orphaned code as modules get reorganized. 100+ framework plugins including Vite and Vitest. |

### Dependency Visualization (Ad-hoc)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `dependency-cruiser` | 17.3.x | Visualize and validate dependency graphs | Generates visual dependency graphs to verify module boundaries are clean. Useful during initial refactor to map current state and validate after each module migration. Rules can catch circular dependencies. Use ad-hoc, not in CI. |

### Contract Testing (Vitest)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vitest` | 3.2.x (existing) | Contract test runner | Already in the project. No additional test framework needed. Contract tests are a testing *pattern*, not a library. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-boundaries` | 5.4.0 | Primary boundary enforcement | Always -- runs on every lint |
| `knip` | 5.85.x | Dead export/file detection | CI pipeline + pre-refactor audit |
| `dependency-cruiser` | 17.3.x | Dependency graph visualization | During refactor planning, post-migration validation |

## Detailed Configuration

### eslint-plugin-boundaries Setup

This is the most important addition. It provides 7 rules, but 3 are critical for this refactor:

**`boundaries/entry-point`** -- Forces all cross-module imports through barrel `index.ts` files. This is the rule that actually enforces the deep module pattern.

**`boundaries/element-types`** -- Controls which module types can import from which others (e.g., features can import shared, shared cannot import features).

**`boundaries/no-private`** -- Prevents importing child files of another module directly, enforcing encapsulation.

Example configuration for the Bucket module structure:

```javascript
// eslint.config.js additions
import boundaries from 'eslint-plugin-boundaries'

// Add to the existing tseslint.config() call:
{
  plugins: {
    boundaries
  },
  settings: {
    'boundaries/elements': [
      { type: 'feature', pattern: ['src/features/*/index.ts'], capture: ['feature'] },
      { type: 'shared', pattern: ['src/shared/*/index.ts'], capture: ['shared'] },
      { type: 'app', pattern: ['src/App.tsx', 'src/main.tsx'], capture: ['app'] }
    ],
    'boundaries/ignore': ['**/*.test.ts', '**/*.test.tsx', '**/__contracts__/**']
  },
  rules: {
    // Force imports through barrel files only
    'boundaries/entry-point': [2, {
      default: 'disallow',
      rules: [
        { target: ['feature'], allow: 'index.ts' },
        { target: ['shared'], allow: 'index.ts' }
      ]
    }],
    // Control cross-module dependencies
    'boundaries/element-types': [2, {
      default: 'disallow',
      rules: [
        { from: ['feature'], allow: ['shared'] },
        { from: ['shared'], allow: ['shared'] },
        { from: ['app'], allow: ['feature', 'shared'] }
      ]
    }],
    // Prevent reaching into module internals
    'boundaries/no-private': [2, {
      allowUncles: false
    }],
    // Flag files not belonging to any module
    'boundaries/no-unknown-files': 1,
    'boundaries/no-unknown': 1
  }
}
```

### Knip Configuration

```jsonc
// knip.config.ts
export default {
  entry: ['src/main.tsx', 'src/App.tsx'],
  project: ['src/**/*.{ts,tsx}'],
  ignore: ['**/__contracts__/**'],
  ignoreDependencies: ['@tauri-apps/*'],
  vitest: true,
  vite: true
}
```

Run during refactor to find dead code: `bunx knip --reporter compact`

### Contract Testing Pattern (Vitest)

Contract tests are not a library -- they are a pattern. Each module's `__contracts__/` directory contains tests that validate the public API surface exposed by `index.ts`.

```typescript
// src/features/BuildProject/__contracts__/BuildProject.contract.test.ts
import { describe, it, expect } from 'vitest'

// Import ONLY through the barrel -- this IS the contract
import {
  BuildProjectPage,
  useBuildProject,
  type BuildProjectConfig
} from '../index'

describe('BuildProject contract', () => {
  it('exports the page component', () => {
    expect(BuildProjectPage).toBeDefined()
  })

  it('exports the hook', () => {
    expect(useBuildProject).toBeDefined()
  })

  // Test behavioral contracts, not implementation
  it('useBuildProject returns expected shape', () => {
    // renderHook test validating the public API shape
  })
})
```

Contract tests serve two purposes:
1. **Lock the public API** -- if someone accidentally removes an export, the contract test fails
2. **Document the interface** -- the import list IS the module's public API documentation

### dependency-cruiser Configuration

Use for one-time visualization, not CI enforcement (eslint-plugin-boundaries handles that):

```bash
# Initialize
bunx dependency-cruiser --init

# Generate dependency graph for a feature module
bunx depcruise src/features/BuildProject --output-type dot | dot -T svg > build-project-deps.svg

# Validate no circular dependencies
bunx depcruise --validate src/features/
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Boundary enforcement | `eslint-plugin-boundaries` | `@softarc/eslint-plugin-sheriff` (v0.19.6) | Sheriff is pre-1.0, smaller community (last release Sep 2025), and originated from Angular ecosystem. eslint-plugin-boundaries has broader adoption, more frequent releases, and better docs for React/feature-based architectures. |
| Boundary enforcement | `eslint-plugin-boundaries` | Nx `@nx/eslint-plugin` | Nx module boundaries require adopting the Nx monorepo toolchain. Massive overkill for a single Tauri app. eslint-plugin-boundaries gives the same enforcement without the Nx dependency tree. |
| Boundary enforcement | `eslint-plugin-boundaries` | ESLint `no-restricted-imports` alone | `no-restricted-imports` requires manually listing every forbidden path. It does not understand architectural concepts like "feature modules" or "entry points." Unscalable as modules grow. Use as a supplement, not primary tool. |
| Dead code detection | `knip` | `ts-prune` | ts-prune is abandoned (last commit 2023). Knip is its spiritual successor with far more capability. |
| Dead code detection | `knip` | Manual `grep` for unused exports | Does not scale. Knip builds the full module graph and understands re-exports through barrels. |
| Dependency visualization | `dependency-cruiser` | Madge | Madge is simpler but less configurable. dependency-cruiser has rule-based validation and better TypeScript support. |
| Contract testing | Vitest (pattern) | Pact / contract-testing libraries | Pact is for service-to-service contract testing (HTTP APIs). Module contracts are internal TypeScript boundaries -- they need import/export validation, not HTTP schema matching. Vitest is the right tool. |

## What NOT to Use

| Tool | Why Avoid |
|------|-----------|
| `@nx/eslint-plugin` | Requires Nx adoption. The `@nx/enforce-module-boundaries` rule only works within Nx workspaces. Not applicable to standalone Tauri apps. |
| `eslint-plugin-import` for boundaries | `eslint-plugin-import` validates import syntax correctness, not architectural boundaries. Different concern. Keep it for import hygiene if desired, but do not rely on it for module enforcement. |
| `ts-prune` | Abandoned. Use Knip instead. |
| `eslint-plugin-barrel-files` | This plugin *warns against* barrel files. The project explicitly wants barrel files as the module interface pattern. Opposite of what we need. |
| Pact / consumer-driven contract testing | Over-engineered for internal module boundaries. These tools are for microservice API contracts over HTTP, not TypeScript module exports. |

## Installation

```bash
# Module boundary enforcement (lint-time)
bun add -D eslint-plugin-boundaries

# Dead code detection (CI + ad-hoc)
bun add -D knip

# Dependency visualization (ad-hoc, optional)
bun add -D dependency-cruiser
```

No other installations needed. Contract testing uses existing Vitest. ESLint `no-restricted-imports` is built-in.

## Integration Points

### With Existing ESLint Config

The project uses ESLint flat config (`eslint.config.js`) with `typescript-eslint`. `eslint-plugin-boundaries` v5.x supports flat config natively. Add it as an additional config object in the existing `tseslint.config()` call.

### With Existing Vitest

Contract tests go in `__contracts__/` directories inside each feature module. Vitest will pick them up automatically via the existing `**/*.test.{ts,tsx}` glob. No config changes needed.

### With Knip

Knip has built-in plugins for Vite and Vitest. It will understand the project structure out of the box. The only configuration needed is specifying entry points and ignoring Tauri plugin imports (which are used at runtime through IPC, not static imports).

### With CI Pipeline

```yaml
# Add to GitHub Actions lint step
- run: bun run eslint:fix  # existing -- now includes boundary rules
- run: bunx knip --reporter compact  # new -- catch dead code
```

## Confidence Assessment

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| `eslint-plugin-boundaries` 5.4.0 | HIGH | Official docs verified, active maintenance, ESLint flat config support confirmed, 7 rules match exactly what this refactor needs |
| `knip` 5.85.x | HIGH | Official site verified, Vite/Vitest plugins confirmed, actively maintained (500+ releases) |
| `dependency-cruiser` 17.3.x | MEDIUM | Well-established tool but recommendation is ad-hoc use only. Not critical path. |
| Contract testing with Vitest | HIGH | This is a pattern, not a library. Already validated by the reference architecture article. Vitest is already in the project. |
| Avoid Sheriff | MEDIUM | Pre-1.0, smaller community. May mature into a viable option but not ready for production reliance today. |
| Avoid Nx boundaries | HIGH | Requires full Nx adoption -- confirmed via official Nx docs. Not applicable. |

## Sources

- [eslint-plugin-boundaries GitHub](https://github.com/javierbrea/eslint-plugin-boundaries) - v5.4.0, ESLint flat config support, 7 rules
- [eslint-plugin-boundaries Rules Reference](https://www.jsboundaries.dev/docs/rules/) - entry-point, element-types, no-private rules
- [Knip Official Site](https://knip.dev/) - v5.85.x, unused exports/files/dependencies detection
- [Knip GitHub](https://github.com/webpro-nl/knip) - 100+ plugins, Vite/Vitest support
- [dependency-cruiser GitHub](https://github.com/sverweij/dependency-cruiser) - v17.3.x, TypeScript dependency validation
- [Sheriff GitHub](https://github.com/softarc-consulting/sheriff) - v0.19.6, framework-agnostic but pre-1.0
- [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports) - built-in import restriction
- [TypeScript-ESLint no-restricted-imports](https://typescript-eslint.io/rules/no-restricted-imports/) - type-aware variant
- [Nx Enforce Module Boundaries](https://nx.dev/docs/features/enforce-module-boundaries) - requires Nx workspace

---

*Stack analysis: 2026-03-07*
