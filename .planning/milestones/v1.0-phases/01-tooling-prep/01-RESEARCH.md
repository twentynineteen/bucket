# Phase 1: Tooling & Prep - Research

**Researched:** 2026-03-07
**Domain:** Developer tooling (ESLint boundaries, dead code detection, dependency visualization, path aliases, stale file cleanup)
**Confidence:** HIGH

## Summary

Phase 1 installs three enforcement/analysis tools (eslint-plugin-boundaries, knip, dependency-cruiser), resolves stale file ambiguity, and configures new path aliases. The project already has ESLint 9 flat config, Vite with vite-tsconfig-paths, and 12 existing path aliases -- so new tooling integrates into established patterns rather than requiring greenfield setup.

All three tools are mature, well-documented, and have clear installation paths for this stack. The main complexity is in configuration tuning: eslint-plugin-boundaries zone definitions need to account for the legacy/target directory split, knip needs entry file and ignore patterns to avoid false positives from Tauri invoke() strings, and dependency-cruiser requires GraphViz (not currently installed) for SVG output.

**Primary recommendation:** Install all three tools as devDependencies, configure each with a dedicated config file or config block, add npm scripts for each, and verify with the success criteria before proceeding to Phase 2.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Start eslint-plugin-boundaries rules as **warnings** (not errors) -- promote to errors in Phase 9 after all modules migrate
- Define zones for **target dirs only**: `@features/*` and `@shared/*` -- legacy dirs (src/pages/, src/hooks/, etc.) are unconstrained until they migrate
- Features **can import from other features**, but only through their barrel (index.ts) -- matches roadmap dependency graph (Baker -> Trello, BuildProject -> Premiere)
- Install **both** eslint-plugin-boundaries (lint-time enforcement) and dependency-cruiser (visual graph generation) -- different purposes, both required by TOOL-01 and TOOL-03
- **Baseline report only** -- run knip, produce report, do not delete dead code in this phase
- Configure knip with proper **entry files and project patterns** to minimize false positives (handle Tauri invoke() strings, barrel re-exports, test setup files)
- Keep knip as a **separate command** (`bun run knip`) -- not part of the lint pipeline
- **Commit baseline** as `.planning/codebase/KNIP-BASELINE.md` for tracking cleanup progress across phases
- **Diff and decide** each .refactored/.old file pair -- Claude proposes canonical version, user approves
- 4 known stale files: `useCreateProject.refactored.ts`, `useUploadTrello.refactored.ts`, `AddCardDialog.old.tsx`, `AddVideoDialog.old.tsx`
- **Full stale scan** beyond .refactored/.old -- also find orphaned spec files, empty directories, unused test fixtures
- **Delete completed specs** -- if a spec's feature is merged and working, delete the spec file (git history preserves it)
- **Leave old aliases untouched** (`@hooks/*`, `@pages/*`, `@components/*`, etc.) -- they keep working normally until each feature migrates, removed in Phase 9
- `@features/*` maps to **new `src/features/` directory**
- `@shared/*` maps to **new `src/shared/` directory**
- **Create both directories now** with `.gitkeep` files so aliases resolve and structure is visible

### Claude's Discretion
- Exact eslint-plugin-boundaries zone/element configuration syntax
- Dependency-cruiser configuration and output format
- Knip configuration details (entry files, ignore patterns, plugins)
- Which stale spec files qualify as "completed" for deletion

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOL-01 | ESLint boundary violation warnings for cross-module imports | eslint-plugin-boundaries v5.4.0 with flat config, zone definitions for @features/* and @shared/* |
| TOOL-02 | Knip report of dead code, unused exports, orphaned files | knip with Vitest/ESLint plugins, custom entry files, Tauri ignore patterns |
| TOOL-03 | Dependency-cruiser visual dependency graph | dependency-cruiser v17.3.9 with dot output, requires GraphViz installation |
| TOOL-04 | .refactored file ambiguity resolved | 4 known stale files identified, diff-and-decide approach, full stale scan |
| TOOL-05 | @features/* and @shared/* path aliases configured | tsconfig.json paths + vite-tsconfig-paths auto-resolution |
| DOCS-03 | Stale specs, .old files, orphaned markdown removed | Full scan for .refactored, .old, orphaned specs, empty dirs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eslint-plugin-boundaries | 5.4.0 | Lint-time cross-module import enforcement | Only ESLint plugin purpose-built for architectural boundary rules; supports flat config |
| knip | latest | Dead code, unused exports, orphaned file detection | De facto standard for JS/TS dead code analysis; understands ecosystem (Vitest, ESLint, Vite) |
| dependency-cruiser | 17.3.9 | Dependency graph generation and validation | Industry standard for JS/TS dependency visualization; supports TypeScript, dot/mermaid output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| graphviz | system | Renders dot format to SVG/PNG | Required by dependency-cruiser for visual graph output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| eslint-plugin-boundaries | eslint-plugin-import/no-restricted-paths | Less expressive zone model, no element-type concept |
| knip | ts-prune | knip is the successor with broader scope (files, deps, not just exports) |
| dependency-cruiser | madge | dependency-cruiser has richer rule system and better TypeScript support |

**Installation:**
```bash
bun add -d eslint-plugin-boundaries knip dependency-cruiser
brew install graphviz
```

## Architecture Patterns

### Recommended Project Structure (Post Phase 1)
```
src/
├── features/           # NEW - .gitkeep initially, populated in later phases
│   └── .gitkeep
├── shared/             # NEW - .gitkeep initially, populated in Phase 2
│   └── .gitkeep
├── pages/              # EXISTING - legacy, unconstrained by boundary rules
├── components/         # EXISTING - legacy, unconstrained
├── hooks/              # EXISTING - legacy, unconstrained
├── store/              # EXISTING - legacy, unconstrained
├── utils/              # EXISTING - legacy, unconstrained
├── constants/          # EXISTING - legacy, unconstrained
├── services/           # EXISTING - legacy, unconstrained
└── ...
```

### Pattern 1: ESLint Boundaries Zone Configuration (Flat Config)
**What:** Define architectural zones using eslint-plugin-boundaries elements, then declare import rules between them
**When to use:** When setting up module boundary enforcement
**Example:**
```typescript
// In eslint.config.js
import boundaries from 'eslint-plugin-boundaries'

// Add as a new config object in the tseslint.config() array:
{
  plugins: {
    boundaries
  },
  settings: {
    'boundaries/elements': [
      { type: 'feature', pattern: ['src/features/*'], capture: ['featureName'] },
      { type: 'shared', pattern: ['src/shared/*'], capture: ['sharedModule'] },
      // Legacy zones -- unconstrained (no rules target them)
      { type: 'legacy', pattern: ['src/pages/*', 'src/hooks/*', 'src/components/*', 'src/store/*', 'src/utils/*', 'src/constants/*', 'src/services/*', 'src/machines/*', 'src/context/*', 'src/lib/*', 'src/types/*'] }
    ],
    'boundaries/ignore': ['**/*.test.*', '**/*.spec.*']
  },
  rules: {
    // Start as warnings per user decision -- promote to error in Phase 9
    'boundaries/element-types': ['warn', {
      default: 'allow',  // Allow everything by default (legacy is unconstrained)
      rules: [
        // Features can import shared
        { from: ['feature'], allow: ['shared'] },
        // Features can import other features ONLY through barrel (index.ts)
        {
          from: ['feature'],
          allow: [['feature', { featureName: '*' }]],
          importKind: 'value',
          // Only allow importing from the feature's index file
        },
        // Shared cannot import features
        { from: ['shared'], disallow: ['feature'] }
      ]
    }],
    'boundaries/no-unknown-files': ['warn'],
    'boundaries/no-unknown': ['warn']
  }
}
```

**Note on barrel enforcement:** eslint-plugin-boundaries v5+ can restrict imports to specific files within an element using the `allowedFiles` or pattern matching. The exact syntax for "only allow imports from index.ts" should be verified during implementation. The `capture` groups and `allow` rules support matching specific files within elements.

### Pattern 2: Knip Configuration
**What:** Configure knip to understand project entry points and ignore Tauri-specific patterns
**When to use:** Setting up dead code detection
**Example:**
```json
// knip.json
{
  "$schema": "https://unpkg.com/knip@latest/schema.json",
  "entry": [
    "src/main.tsx",
    "src/App.tsx"
  ],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "src-tauri/**",
    "scripts/**"
  ],
  "ignoreDependencies": [
    "@tauri-apps/cli"
  ],
  "vitest": {
    "entry": [
      "tests/**/*.test.{ts,tsx}",
      "tests/setup/*.ts"
    ]
  }
}
```

### Pattern 3: Dependency-Cruiser Configuration
**What:** Generate visual dependency graph of the codebase
**When to use:** Understanding current module relationships before migration
**Example:**
```bash
# Initialize config
npx depcruise --init

# Generate SVG dependency graph
npx depcruise src --include-only "^src" --output-type dot | dot -T svg > dependency-graph.svg

# Generate focused graph (e.g., just pages and their deps)
npx depcruise src/pages --include-only "^src" --output-type dot | dot -T svg > pages-graph.svg
```

### Anti-Patterns to Avoid
- **Over-constraining legacy zones:** Do NOT add boundary rules to legacy directories. They must remain unconstrained until code actually migrates into features/shared.
- **Promoting warnings to errors prematurely:** Boundary rules start as warnings. Only Phase 9 promotes them.
- **Adding knip to CI/lint pipeline:** Knip is informational and slow. Keep it as a separate manual command.
- **Deleting dead code during knip baseline:** Phase 1 produces the report only. Cleanup happens in later phases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import boundary checking | Custom ESLint rules | eslint-plugin-boundaries | Complex zone/element model with capture groups, tested across thousands of projects |
| Dead code detection | Manual grep for unused exports | knip | Understands import graphs, re-exports, dynamic imports, framework-specific entry points |
| Dependency visualization | Manual architecture diagrams | dependency-cruiser | Traverses actual import graph, output is always accurate to code |
| Path alias resolution | Manual vite.config.ts resolve entries | vite-tsconfig-paths | Already installed; reads tsconfig.json paths automatically |

**Key insight:** All three tools are configuration-heavy but implementation-light. The work is in getting config right, not writing code.

## Common Pitfalls

### Pitfall 1: eslint-plugin-boundaries Not Matching Files
**What goes wrong:** Elements defined with patterns that don't match actual file paths, so no violations are reported
**Why it happens:** Pattern paths are relative to project root by default; confusion between `src/features/*` and `features/*`
**How to avoid:** After configuration, create a deliberate violation (e.g., shared importing from features) and verify ESLint reports it as a warning
**Warning signs:** `bun run eslint src` shows zero boundary-related warnings even with known violations

### Pitfall 2: Knip False Positives from Tauri
**What goes wrong:** Knip flags Tauri plugin imports, invoke() command strings, and barrel re-exports as unused
**Why it happens:** Tauri's `invoke('command_name')` is a string-based dynamic call that knip can't trace; barrel re-exports look "unused" if consumers import directly
**How to avoid:** Configure entry files explicitly, use `ignoreDependencies` for Tauri packages that appear unused from knip's perspective, use `ignoreExportsUsedInFile` for barrel patterns
**Warning signs:** Baseline report lists dozens of Tauri-related items as "unused"

### Pitfall 3: GraphViz Not Installed
**What goes wrong:** dependency-cruiser `dot` output has no renderer; SVG generation fails silently or with cryptic error
**Why it happens:** GraphViz is a system dependency, not an npm package
**How to avoid:** Install GraphViz before running dependency-cruiser: `brew install graphviz` on macOS
**Warning signs:** `dot` command not found (verified: **NOT currently installed on this machine**)

### Pitfall 4: Path Alias Collision
**What goes wrong:** New `@features/*` or `@shared/*` aliases conflict with existing aliases or resolve incorrectly
**Why it happens:** TypeScript path resolution order matters; overlapping patterns can cause wrong resolution
**How to avoid:** New aliases use distinct prefixes (`@features/`, `@shared/`) that don't overlap with any existing alias. Verify with a test import after configuration.
**Warning signs:** TypeScript errors on import, Vite failing to resolve modules

### Pitfall 5: Stale File Deletion Breaking Imports
**What goes wrong:** Deleting a .refactored or .old file breaks an import somewhere
**Why it happens:** Both versions might be imported in different places; not checking the import graph before deletion
**How to avoid:** Search for all imports of each stale file before deletion. Use the canonical version's path in all consumers.
**Warning signs:** TypeScript compilation errors after deletion

## Code Examples

### Adding Path Aliases to tsconfig.json
```json
// Add to compilerOptions.paths in tsconfig.json:
{
  "paths": {
    // ... existing 12 aliases ...
    "@features/*": ["src/features/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```
No vite.config.ts changes needed -- vite-tsconfig-paths reads from tsconfig.json automatically.

### ESLint Flat Config Integration Point
```typescript
// eslint.config.js -- the existing config uses tseslint.config() which accepts
// an array of config objects. The boundaries config is added as another object:
import boundaries from 'eslint-plugin-boundaries'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    // ... existing config block with react-hooks, react-refresh, complexity rules ...
  },
  // NEW: Boundary enforcement block
  {
    plugins: { boundaries },
    settings: { /* elements definition */ },
    rules: { /* boundary rules as warnings */ }
  }
)
```

### Package.json Script Additions
```json
{
  "scripts": {
    "knip": "knip",
    "dep-graph": "depcruise src --include-only \"^src\" --output-type dot | dot -T svg > dependency-graph.svg",
    "dep-graph:html": "depcruise src --include-only \"^src\" --output-type dot | dot -T svg | npx depcruise-wrap-stream-in-html > dependency-graph.html"
  }
}
```

### Verifying Alias Resolution
```typescript
// Quick test file to verify aliases resolve:
// src/features/.gitkeep exists, so this import resolves to the directory
// Actual verification: create a temp .ts file that imports from @features/* and @shared/*
// and confirm tsc --noEmit passes

// In tsconfig paths:
// "@features/*": ["src/features/*"]  -- src/features/ must exist
// "@shared/*": ["src/shared/*"]      -- src/shared/ must exist
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| .eslintrc.json config | eslint.config.js flat config | ESLint v9 (2024) | Already migrated in this project |
| ts-prune for dead exports | knip for comprehensive dead code | 2023 | knip subsumes ts-prune with broader scope |
| Manual dependency diagrams | dependency-cruiser auto-generation | Mature since 2018 | Always-accurate graphs from actual imports |
| eslint-plugin-import restricted-paths | eslint-plugin-boundaries | 2021+ | Richer zone model with capture groups |

**Deprecated/outdated:**
- ts-prune: Superseded by knip (same author recommended knip)
- eslintrc format: Deprecated in ESLint 9; this project already uses flat config

## Open Questions

1. **eslint-plugin-boundaries barrel-only enforcement syntax**
   - What we know: The plugin supports element-type rules with capture groups and file pattern matching
   - What's unclear: Exact syntax to restrict feature-to-feature imports to only `index.ts` barrel files
   - Recommendation: During implementation, test with a concrete example; the `allow` rule likely needs a file pattern constraint. If not natively supported, a complementary `no-restricted-imports` rule can enforce barrel-only imports.

2. **Knip Tauri invoke() handling**
   - What we know: Knip can't trace string-based invoke() calls to Rust backend
   - What's unclear: Whether knip has a Tauri-specific plugin or if manual ignores are needed
   - Recommendation: Run knip once with minimal config, review false positives, then add targeted ignores. The baseline report will document known false positives.

3. **Dependency-cruiser mermaid vs dot output**
   - What we know: Both formats are supported; dot requires GraphViz, mermaid renders in markdown/GitHub
   - What's unclear: Whether the team prefers SVG files or inline mermaid in docs
   - Recommendation: Use dot->SVG as primary (richer visualization), offer mermaid as alternative for markdown embedding. Install GraphViz first.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | vite.config.ts (test section) |
| Quick run command | `bun run test:run` |
| Full suite command | `bun run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | ESLint reports boundary warnings | smoke | `bun run eslint src 2>&1 \| grep boundaries` | N/A - verified via lint output |
| TOOL-02 | Knip produces baseline report | smoke | `bun run knip` | N/A - verified via command output |
| TOOL-03 | Dependency-cruiser generates graph | smoke | `bun run dep-graph` | N/A - verified via file existence |
| TOOL-04 | No .refactored/.old files remain | smoke | `find src -name '*.refactored.*' -o -name '*.old.*'` | N/A - verified via file absence |
| TOOL-05 | Path aliases resolve correctly | unit | `npx tsc --noEmit` | N/A - verified via TypeScript compilation |
| DOCS-03 | Stale artifacts removed | smoke | `find . -name '*.old.*' -o -name '*.refactored.*' -o -empty -type d` | N/A - verified via file absence |

### Sampling Rate
- **Per task commit:** `bun run eslint src` (quick lint check)
- **Per wave merge:** `bun run test:run && bun run eslint src`
- **Phase gate:** All 5 success criteria from phase description verified

### Wave 0 Gaps
- [ ] GraphViz installation: `brew install graphviz` -- required before dependency-cruiser can generate SVG output
- [ ] `src/features/` directory with `.gitkeep` -- must exist before alias resolution works
- [ ] `src/shared/` directory with `.gitkeep` -- must exist before alias resolution works

*(No new test files needed -- this phase is tooling configuration, verified by tool output rather than unit tests)*

## Sources

### Primary (HIGH confidence)
- [eslint-plugin-boundaries GitHub](https://github.com/javierbrea/eslint-plugin-boundaries) - v5.4.0 confirmed, flat config support, element/zone configuration
- [dependency-cruiser GitHub](https://github.com/sverweij/dependency-cruiser) - v17.3.9 confirmed, CLI usage, output types, GraphViz requirement
- [knip.dev](https://knip.dev/) - Official documentation, configuration format, plugin system
- Project files: eslint.config.js, tsconfig.json, vite.config.ts, package.json -- existing configuration patterns

### Secondary (MEDIUM confidence)
- [knip.dev/overview/configuration](https://knip.dev/overview/configuration) - Config file formats, entry/project patterns, zero-config defaults

### Tertiary (LOW confidence)
- eslint-plugin-boundaries barrel-only enforcement syntax -- needs implementation-time verification
- knip Tauri-specific handling -- needs empirical testing with first run

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all three tools are well-established, versions confirmed from official sources
- Architecture: HIGH - existing project config (flat ESLint, tsconfig paths, vite-tsconfig-paths) provides clear integration points
- Pitfalls: HIGH - GraphViz absence confirmed on this machine; Tauri false-positive risk well-understood from project patterns
- Stale files: HIGH - all 4 files confirmed to exist at expected paths; specs directory does not exist (already clean)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable tooling, unlikely to change rapidly)
