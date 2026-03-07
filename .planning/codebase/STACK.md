# Technology Stack

**Analysis Date:** 2026-03-07

## Languages

**Primary:**
- TypeScript 5.9 - Frontend application (`src/`)
- Rust (Edition 2021) - Backend/native layer (`src-tauri/src/`)

**Secondary:**
- CSS - Styling via TailwindCSS v4 (`src/index.css`)
- JSON - Configuration, breadcrumbs data files
- YAML - GitHub Actions CI/CD workflows (`.github/workflows/`)

## Runtime

**Environment:**
- Tauri 2.9 desktop runtime (Chromium on Windows, WebKit on macOS/Linux)
- Vite 7.1 dev server on `http://localhost:1422`

**Package Manager:**
- Bun (primary, used in all scripts and CI)
- Cargo (Rust dependency management)
- Lockfile: `bun.lock` present

## Frameworks

**Core:**
- React 19.2 - UI framework (`src/`)
- Tauri 2.9 - Desktop app shell with native Rust backend (`src-tauri/`)
- Vite 7.1 - Frontend build tool and dev server (`vite.config.ts`)

**Testing:**
- Vitest 3.2 - Unit/integration tests (`vite.config.ts` test config)
- Testing Library (React 16.3, DOM 10.4, user-event 14.6) - Component testing
- Playwright 1.57 - E2E testing (`playwright.config.ts`, `tests/e2e/playwright.config.ts`)
- MSW 2.11 - API mocking (`tests/setup/msw-server.ts`)

**Build/Dev:**
- Vite 7.1 + `@vitejs/plugin-react` 5.0 - Frontend bundling
- `vite-tsconfig-paths` - Path alias resolution
- `vite-plugin-monaco-editor` - Code editor support
- LightningCSS 1.30 - CSS minification in production
- tauri-build 2.0 - Rust backend compilation

## Key Dependencies

**Critical (Frontend):**
- `@tanstack/react-query` 5.90 - Server state management, data fetching (preferred over useEffect)
- `zustand` 5.0 - Client-side state management (`src/store/`)
- `react-router-dom` 7.9 - Client-side routing
- `xstate` 5.24 + `@xstate/react` 6.0 - State machines (`src/machines/`)
- `zod` 4.1 - Runtime schema validation
- `ai` 5.0 (Vercel AI SDK) - AI model abstraction layer
- `ollama-ai-provider-v2` 1.5 - Ollama LLM integration
- `@xenova/transformers` 2.17 - Client-side ML embeddings for RAG

**Critical (Rust/Backend):**
- `tauri` 2.9 with `macos-private-api` feature - Desktop runtime
- `reqwest` 0.11 with multipart/json/stream - HTTP client for external APIs
- `tokio` 1.x full features - Async runtime
- `rusqlite` 0.32 bundled - SQLite database for RAG embeddings
- `serde` / `serde_json` - Serialization
- `argon2` 0.5 - Password hashing
- `jsonwebtoken` 9.3 - JWT authentication
- `quick-xml` 0.29 - XML parsing (Premiere Pro project files)
- `zip` 0.6 - ZIP/ZXP archive handling (plugin management)

**UI:**
- `@radix-ui/*` (12+ packages) - Headless UI primitives (dialog, dropdown, tabs, accordion, etc.)
- `tailwindcss` 4.1 + `@tailwindcss/postcss` - Utility-first CSS
- `lucide-react` 0.545 - Icon library
- `framer-motion` 12.23 - Animations
- `class-variance-authority` 0.7 + `clsx` 2.1 + `tailwind-merge` 3.3 - Class utilities (shadcn/ui pattern)
- `sonner` 2.0 - Toast notifications
- `next-themes` 0.4 - Theme provider (8 themes supported)

**Utilities:**
- `date-fns` 4.1 - Date formatting
- `fuse.js` 7.1 - Fuzzy search
- `hls.js` 1.6 - HLS video playback
- `mammoth` 1.11 - DOCX-to-HTML conversion (frontend)
- `docx` 9.5 - DOCX generation
- `opentype.js` 1.3 - Font file parsing
- `@monaco-editor/react` 4.7 - Code/script editor
- `react-markdown` 10.1 - Markdown rendering
- `p-limit` 7.2 - Concurrency control

**Infrastructure:**
- `@tauri-apps/plugin-dialog` 2.4 - Native file/folder dialogs
- `@tauri-apps/plugin-fs` 2.4 - Filesystem access
- `@tauri-apps/plugin-shell` 2.3 - Shell command execution
- `@tauri-apps/plugin-opener` 2.5 - URL/file opening
- `@tauri-apps/plugin-updater` 2.9 - Auto-update mechanism
- `@tauri-apps/plugin-process` 2.3 - Process management
- `@tauri-apps/plugin-deep-link` 2.4 - Custom URL scheme (`bucket://`)
- `@tauri-apps/plugin-stronghold` 2.3 - Secure credential storage
- `tauri-plugin-macos-permissions` 2.0 - macOS permission requests

## Configuration

**Environment:**
- API keys stored in `api_keys.json` in Tauri app data directory (NOT `.env` files)
- Keys managed via `src/utils/storage.ts` using `@tauri-apps/plugin-fs`
- Required keys: Sprout Video API key, Trello API key + token, Trello board ID, Ollama URL
- No `.env` files detected in project root

**Build:**
- `vite.config.ts` - Frontend build configuration, dev server port 1422
- `src-tauri/tauri.conf.json` - Tauri app config (window, plugins, bundle, updater)
- `src-tauri/Cargo.toml` - Rust dependency manifest
- `tsconfig.json` - TypeScript config with path aliases (`@components/*`, `@hooks/*`, `@utils/*`, `@store/*`, `@services/*`, `@pages/*`, `@machines/*`, `@context/*`, `@lib/*`, `@/*`)
- `.prettierrc.json` - Code formatting (90 char width, single quotes, no semicolons, no trailing commas)
- `eslint.config.js` - Flat config with react-hooks, react-refresh, `no-console: error`, complexity warnings
- `postcss.config.*` - PostCSS with TailwindCSS v4

**Release Build Profile (`src-tauri/Cargo.toml`):**
- `strip = true` - Symbol stripping
- `panic = "abort"` - No panic cleanup
- `codegen-units = 1` - Maximum optimization
- `lto = true` - Link-time optimization
- `opt-level = "s"` - Size optimization

## Platform Requirements

**Development:**
- macOS (primary development platform)
- Bun runtime installed
- Rust stable toolchain
- Xcode command line tools (for macOS builds)
- Ollama (optional, for AI script formatting)

**Production:**
- macOS 10.13+ (minimum system version)
- Distributed as signed DMG (aarch64 + x86_64 universal)
- Auto-update via Tauri updater (GitHub releases endpoint)
- Deep link support: `bucket://` URL scheme
- Uses `macOSPrivateApi: true` (not App Store compatible)

**CI/CD:**
- GitHub Actions
- Ubuntu 24.04 for lint, test, Linux build
- macOS 14 (Apple Silicon) for signed macOS builds
- Bun for all JS operations in CI
- Rust stable via `dtolnay/rust-toolchain@stable`
- Apple code signing certificate in CI secrets
- Notarization available (opt-in via workflow dispatch)

---

*Stack analysis: 2026-03-07*
