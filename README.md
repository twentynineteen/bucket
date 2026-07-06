# Bucket

A desktop video-production workflow app built with Tauri 2 (Rust + React/TypeScript). Bucket streamlines footage ingest, project creation, and integration with Adobe Premiere, Trello, and Sprout Video.

**Version:** 0.16.0  
**Platform:** macOS (primary)  
**License:** UNLICENSED (proprietary)

## What Bucket Does

Bucket is a single desktop app that ties together the repetitive steps of a video-production pipeline:

- **BuildProject** -- Select footage files, assign camera numbers, and generate an organised folder structure with an Adobe Premiere project in one step. File operations run in the Rust backend with real-time progress tracking.
- **Baker** -- Scan a drive for project folders, validate their structure (Footage, Graphics, Renders, Projects, Scripts), and create or update `breadcrumbs.json` metadata files in batch. Recent updates added a full-height layout, diff-row previews, and a rebuilt batch dialog.
- **Upload** -- Publish videos to Sprout Video, generate custom posterframes, and manage hosting metadata.
- **Trello** -- Link projects to Trello cards, sync breadcrumbs metadata, and self-assign to cards via a toggle (added in v0.16.0).
- **Premiere** -- Install and update Premiere Pro CEP extension plugins (BreadcrumbsPremiere, Boring) with one click.
- **AI Tools** -- AI-powered script formatting for autocue/teleprompter use, powered by local Ollama models via the Vercel AI SDK.
- **Auth** -- Login, registration, and token management with argon2 hashing and Tauri Stronghold secure storage.
- **Settings** -- Per-domain configuration tabs covering Trello boards, Ollama connection, and app preferences. Thirteen themes available (System, Light, Dark, Dracula, Tokyo Night, Catppuccin variants, Solarized Light, GitHub Light, Nord Light, One Light).

## Getting Bucket

Releases are published to GitHub via the `publish` workflow. The latest macOS build is available on the [Releases page](https://github.com/twentynineteen/bucket/releases). The app includes a built-in auto-updater.

## Development

### Prerequisites

- [Bun](https://bun.sh) -- package manager and script runner (replaces npm entirely)
- [Rust toolchain](https://rustup.rs) -- required by the Tauri 2 backend
- Xcode Command Line Tools (macOS) -- needed for native compilation

### Setup

```bash
git clone https://github.com/twentynineteen/bucket.git
cd bucket
bun install
```

### Running

```bash
bun run dev:tauri       # Start the full Tauri app in dev mode (primary dev command)
bun run dev             # Start the Vite frontend dev server only
bun run preview         # Preview the production frontend build
```

### Building

```bash
bun run build:tauri     # Build the complete desktop app (produces a DMG in target/build/dmg)
bun run build           # Build the frontend only
```

### Tests

```bash
bun run test            # Run Vitest in watch mode
bun run test:run        # Run Vitest once (CI mode)
bun run test:coverage   # Run with coverage report
bun run test:ui         # Open the Vitest browser UI
```

End-to-end tests use Playwright:

```bash
bun run test:e2e                    # Run all e2e tests
bun run test:e2e:headed             # Run with a visible browser
bun run test:e2e:buildproject       # Run only BuildProject e2e tests
bun run test:e2e:report             # View the HTML test report
```

### Code Quality

Run these before committing:

```bash
bun run eslint:fix      # Fix lint issues (includes module-boundary rules)
bun run prettier:fix    # Auto-format (90 char width, single quotes, no semicolons)
bun run knip            # Detect unused exports and dependencies
```

## CI

GitHub Actions workflows run on every push and PR to `master` and `release`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** (`ci.yml`) | Push/PR to `master`, `release` | Lint, unit tests, frontend build |
| **E2E Tests** (`e2e-tests.yml`) | PRs touching BuildProject or e2e paths | Playwright end-to-end tests |
| **Publish** (`publish.yml`) | Push to `release` | Build app, create GitHub release, upload artifacts |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2 + TypeScript 5.9 + Vite 7.3 |
| Backend | Tauri 2.0 (Rust 2021 edition) |
| UI | TailwindCSS 4 + Radix UI + Lucide icons |
| State | Zustand + TanStack React Query |
| State machines | XState (BuildProject workflow) |
| Testing | Vitest + Testing Library + Playwright |
| AI | Vercel AI SDK + Ollama (local LLM) |
| Formatting | Prettier + ESLint (auto-configured) |

## Project Structure

```
src/
  features/
    AITools/        Script formatting + embeddings
    Auth/           Login, registration, token management
    Baker/          Drive scanning, breadcrumbs management
    BuildProject/   File ingest, camera assignment, project creation
    Premiere/       Premiere Pro plugin management
    Settings/       App configuration
    Trello/         Trello card management, video links
    Upload/         Sprout Video, posterframe generation
  shared/
    constants/      Timing, animation, project constants
    hooks/          Cross-feature hooks
    lib/            React Query infrastructure
    services/       Progress tracking, feedback, caching
    store/          Zustand stores (appStore, breadcrumbStore)
    types/          Shared domain types
    ui/             Radix primitives, sidebar, theme, layout
    utils/          Logger, storage, validation utilities

src-tauri/
  src/              Rust backend (file operations, API integrations)
  Cargo.toml        Rust dependencies
  tauri.conf.json   Tauri app configuration
```

Each feature module follows a strict convention: an `api.ts` I/O boundary wrapping all Tauri calls, a barrel `index.ts` with JSDoc exports, and `__contracts__/` tests enforcing shape, behaviour, and no-bypass rules. Shared modules never import from features.

## Further Reading

- **[CLAUDE.md](./CLAUDE.md)** -- Architecture conventions, import rules, and how to add a new feature module
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** -- System design, data flow, and component interactions
- **[docs/ONBOARDING.md](./docs/ONBOARDING.md)** -- Developer onboarding guide
- **[docs/PREMIERE_PLUGINS.md](./docs/PREMIERE_PLUGINS.md)** -- Premiere Pro plugin documentation
- **[docs/BRANCHING_STRATEGY.md](./docs/BRANCHING_STRATEGY.md)** -- Git branching and release conventions

## Version Bumping

```bash
bun run version:patch   # 0.16.0 -> 0.16.1
bun run version:minor   # 0.16.0 -> 0.17.0
bun run version:major   # 0.16.0 -> 1.0.0
```

These scripts update `package.json`, `Cargo.toml`, and `tauri.conf.json` in one step.
