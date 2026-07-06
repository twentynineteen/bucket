# Bucket Architecture Overview

## What This Document Covers

This document explains the high-level architecture of Bucket, including how different components interact, key design decisions, data flow patterns, and where to make common changes.

**Target audience:** Developers who need to understand the system design before making significant changes or adding new features.

**Last updated:** July 2026 (v0.16.0)

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Bucket Desktop App                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐       ┌──────────────────────┐    │
│  │   React Frontend    │◀─────▶│   Rust Backend       │    │
│  │  (TypeScript/Vite)  │  IPC  │   (Tauri 2.0)        │    │
│  │                     │       │                      │    │
│  │  - UI Components    │       │  - File Operations   │    │
│  │  - State (Zustand)  │       │  - API Integrations  │    │
│  │  - React Query      │       │  - SQLite Database   │    │
│  └─────────────────────┘       └──────────────────────┘    │
│           │                             │                    │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
            ▼                             ▼
   ┌─────────────────┐          ┌──────────────────┐
   │  Browser APIs   │          │   File System    │
   │  - Monaco       │          │   - breadcrumbs  │
   │  - IndexedDB    │          │   - projects     │
   └─────────────────┘          │   - temp files   │
                                 └──────────────────┘
                                          │
                                          ▼
                           ┌────────────────────────────┐
                           │   External Integrations    │
                           ├────────────────────────────┤
                           │  - Trello API (REST)       │
                           │  - Sprout Video API (REST) │
                           │  - Ollama API (Local LLM)  │
                           │  - Adobe Premiere (Files)  │
                           └────────────────────────────┘
```

**Components:**

1. **React Frontend** - User interface built with React 19, TypeScript 5.9, and TailwindCSS 4. Handles all UI rendering, user interactions, and client-side state management. Organized into feature modules (`src/features/`) with shared code in `src/shared/`.

2. **Rust Backend (Tauri)** - Native application layer that provides secure file system access, API integrations, and performance-critical operations. Exposes commands to the frontend via Tauri's IPC bridge.

3. **File System** - Local storage for project files, breadcrumbs.json metadata, and application data. Managed through Tauri's secure file system APIs.

4. **External Integrations** - Third-party services for project management (Trello), video hosting (Sprout Video), AI formatting (Ollama), and video editing (Premiere Pro).

### Technology Stack

| Layer                  | Technology                     | Why We Chose It                                                                          |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Frontend Framework** | React 19 + TypeScript 5.9      | Type safety, large ecosystem, excellent tooling, team expertise                          |
| **Build Tool**         | Vite 7.3                       | Fast HMR, modern ESM support, optimized production builds                                |
| **Desktop Runtime**    | Tauri 2.0                      | Smaller app size than Electron, better security, Rust performance, native OS integration |
| **UI Components**      | Radix UI + TailwindCSS         | Accessible primitives, utility-first styling, consistent design system                   |
| **State Management**   | Zustand + TanStack React Query | Simple API, minimal boilerplate, excellent async state handling                          |
| **Backend Language**   | Rust 2021                      | Memory safety, performance, excellent async support (tokio), cargo ecosystem             |
| **Database**           | SQLite (rusqlite)              | Embedded, zero-config, perfect for desktop apps, supports vector embeddings              |
| **AI/LLM**             | Ollama + Vercel AI SDK         | Local-first, privacy-preserving, unified provider interface                              |
| **Testing**            | Vitest + Testing Library       | Fast, ESM-native, compatible with Vite, excellent DX                                     |

## Directory Structure

> **Note:** The frontend was reorganized in March 2026 from a flat layout
> (`src/pages/`, `src/hooks/`, `src/components/`, etc.) into a feature-module
> architecture. See CLAUDE.md for the canonical module map and conventions.

```
bucket/
├── src/                            # React frontend source
│   ├── features/                   # Feature modules (domain-driven)
│   │   ├── AITools/                # ScriptFormatter + ExampleEmbeddings
│   │   │   ├── api.ts              # I/O boundary (Tauri invoke wrappers)
│   │   │   ├── types.ts            # Shared type definitions
│   │   │   ├── index.ts            # Barrel file (named re-exports + JSDoc)
│   │   │   ├── __contracts__/      # Contract tests (shape, behavioral, no-bypass)
│   │   │   ├── internal/           # Internal utilities (not exported)
│   │   │   ├── ScriptFormatter/    # RAG-based script formatting UI
│   │   │   └── ExampleEmbeddings/  # Manage RAG examples UI
│   │   │
│   │   ├── Auth/                   # Login, registration, token management
│   │   │   ├── api.ts
│   │   │   ├── AuthContext.ts
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   ├── components/         # Login.tsx, Register.tsx
│   │   │   └── hooks/
│   │   │
│   │   ├── Baker/                  # Drive scanning, breadcrumbs management
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── BakerPage.tsx       # Main Baker page component
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   ├── components/         # ProjectList, VideoLinksManager, BatchActions, etc.
│   │   │   ├── hooks/              # useBakerScan, useBreadcrumbsManager, etc.
│   │   │   ├── internal/
│   │   │   └── utils/
│   │   │
│   │   ├── BuildProject/           # File ingest, camera assignment, XState
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── BuildProjectPage.tsx
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   │
│   │   ├── Premiere/               # Adobe Premiere plugin management
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   └── components/
│   │   │
│   │   ├── Settings/               # App configuration with per-domain tabs
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   │
│   │   ├── Trello/                 # Trello card management, video links
│   │   │   ├── api.ts
│   │   │   ├── types.ts
│   │   │   ├── index.ts
│   │   │   ├── __contracts__/
│   │   │   ├── components/         # TrelloCardsManager, UploadTrello, etc.
│   │   │   ├── hooks/
│   │   │   └── internal/
│   │   │
│   │   └── Upload/                 # Sprout Video, Posterframe, Otter
│   │       ├── api.ts
│   │       ├── types.ts
│   │       ├── index.ts
│   │       ├── __contracts__/
│   │       ├── components/         # UploadSprout, Posterframe, UploadOtter
│   │       ├── hooks/
│   │       └── internal/
│   │
│   ├── shared/                     # Cross-feature shared code
│   │   ├── constants/              # Timing, animation, project constants
│   │   ├── hooks/                  # Cross-feature hooks (breadcrumb, search, API keys, mobile)
│   │   ├── lib/                    # Query infrastructure: keys, client, utils, prefetch, perf
│   │   ├── services/               # ProgressTracker, feedback, cache services
│   │   ├── store/                  # Zustand stores: useAppStore, useBreadcrumbStore
│   │   ├── types/                  # Shared domain types: media, script, breadcrumbs
│   │   ├── ui/                     # Radix primitives, sidebar, theme, layout (NO barrel)
│   │   └── utils/                  # Logger, storage, validation, cn(), breadcrumbs utils
│   │
│   ├── app/                        # Layout shell
│   │   └── dashboard/
│   │       └── page.tsx            # Root layout (sidebar + outlet)
│   │
│   ├── App.tsx                     # Root React component (providers, QueryClient)
│   ├── AppRouter.tsx               # React Router configuration (lazy-loaded routes)
│   └── index.tsx                   # App entry point
│
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── baker/                  # Baker-specific Tauri commands
│   │   │   ├── mod.rs
│   │   │   ├── breadcrumbs.rs      # Scan, read, update breadcrumbs
│   │   │   ├── scanning.rs         # Folder scanning logic
│   │   │   ├── types.rs            # Baker Rust types
│   │   │   └── video_links.rs      # Video link + Trello card commands
│   │   │
│   │   ├── build_project/          # BuildProject file-transfer commands
│   │   │   ├── mod.rs
│   │   │   ├── commands.rs         # transfer_files_with_progress, cancel_file_transfer
│   │   │   ├── error.rs            # Error types
│   │   │   ├── registry.rs         # Operation registry (Arc<DashMap>)
│   │   │   └── transfer.rs         # File copy logic
│   │   │
│   │   ├── commands/               # General Tauri command modules
│   │   │   ├── mod.rs              # Command exports
│   │   │   ├── auth.rs             # Authentication (argon2, JWT)
│   │   │   ├── plugins.rs          # Premiere CEP plugin management
│   │   │   ├── premiere.rs         # Premiere Pro template operations
│   │   │   ├── sprout_upload.rs    # Sprout Video API client
│   │   │   ├── docx.rs             # Word document processing
│   │   │   ├── rag.rs              # RAG embeddings + vector search
│   │   │   ├── ai_provider.rs      # AI provider management
│   │   │   ├── system.rs           # System utilities
│   │   │   └── tests/              # Rust unit tests
│   │   │
│   │   ├── state/                  # Shared state (Arc<Mutex<T>>)
│   │   │   ├── mod.rs
│   │   │   └── auth.rs             # Authentication state
│   │   │
│   │   ├── utils/                  # Rust utilities
│   │   │   ├── mod.rs
│   │   │   └── macos_copyfile.rs   # macOS-optimized file copying
│   │   │
│   │   ├── media.rs                # Media file handling (VideoLink, TrelloCard types)
│   │   ├── lib.rs                  # Library root
│   │   └── main.rs                 # App entry point + command registration
│   │
│   ├── resources/                  # Bundled app resources
│   │   ├── embeddings/
│   │   │   └── examples.db         # SQLite vector embeddings DB
│   │   └── examples/               # Bundled script examples
│   │
│   ├── assets/                     # Static assets
│   │   ├── plugins/                # Premiere CEP plugin files
│   │   ├── Premiere 4K Template 2025.prproj
│   │   └── Premiere 4K Template 2023.prproj
│   │
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri app configuration
│   └── build.rs                    # Build script
│
├── tests/                          # Frontend tests
│   └── ...
│
├── .claude/                        # Claude Code configuration
│   ├── skills/                     # Custom Claude skills
│   └── ...
│
├── docs/                           # Documentation
│   ├── README.md                   # Project overview
│   ├── ARCHITECTURE.md             # Architecture overview (this file)
│   └── API_COMMANDS.md             # Tauri commands reference
│
├── package.json                    # Bun dependencies + scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
└── CLAUDE.md                       # Claude Code instructions
```

### Directory Purpose and Rules

#### src/features/\<Name\>/

**Purpose:** Self-contained feature modules, each with its own components, hooks, types, and I/O boundary.

**What goes here:**

- `api.ts` -- wraps ALL Tauri invoke/plugin calls (single I/O boundary)
- `types.ts` -- shared type definitions for the module
- `index.ts` -- barrel file with named re-exports and JSDoc
- `__contracts__/` -- contract tests (shape, behavioral, no-bypass)
- `components/` -- React components specific to this feature
- `hooks/` -- React hooks specific to this feature
- `internal/` -- internal utilities (NOT exported from barrel)

**Import rules:**

- Features import shared via `@shared/*` barrel imports
- Features import other features via `@features/*` barrel only
- Shared NEVER imports from features
- No direct `@tauri-apps` plugin imports in components/hooks -- all I/O goes through `api.ts`

**When to add a module:** When creating a new feature area in the application. See CLAUDE.md for the full checklist.

#### src/shared/

**Purpose:** Cross-feature shared code. Dependency flows one direction: features depend on shared, never the reverse.

**Subdirectories:** `constants/`, `hooks/`, `lib/`, `services/`, `store/`, `types/`, `ui/`, `utils/`

**Note:** `shared/ui/` has NO barrel file -- use direct imports (e.g., `@shared/ui/button`, `@shared/ui/sidebar/Sidebar`).

#### src-tauri/src/ (Rust backend)

**Purpose:** Rust functions exposed to the frontend via Tauri's IPC, organized by domain.

**What goes here:**

- `baker/` -- Baker scanning and breadcrumbs commands
- `build_project/` -- File transfer with progress and cancellation
- `commands/` -- General commands (auth, premiere, docx, rag, sprout, AI provider, plugins, system)
- `state/` -- Shared state (Arc<Mutex<T>>)
- `utils/` -- Rust utilities (macOS-optimized file copying)

**Naming convention:** Functions are annotated with `#[tauri::command]` and use snake_case (e.g., `transfer_files_with_progress`, `baker_start_scan`).

## Data Flow

### BuildProject Feature Flow

End-to-end data flow for creating a multi-camera project:

```
User Interaction → React Component → Tauri Command → File System
       ↓
    Zustand Store Update
       ↓
    UI Re-render (Progress)
       ↓
    Completion Callback
```

**Step-by-step:**

1. **User selects files** in `BuildProjectPage.tsx`
   - User clicks "Select Files" button
   - File selection goes through the feature's `api.ts` I/O boundary
   - Hook invokes `open()` from `@tauri-apps/plugin-dialog`
   - Returns file paths array

2. **User assigns cameras**
   - Files displayed in list with camera number inputs
   - Auto-assign logic validates that cameras 1 to N are all assigned

3. **User creates project**
   - Clicks "Create Project" in `BuildProjectPage.tsx`
   - Hook validates inputs (title, folder, camera assignments)

4. **Frontend invokes Tauri command**
   - Calls `invoke('transfer_files_with_progress', { ... })` via `api.ts`
   - Tauri IPC serializes arguments to JSON
   - Rust backend receives command

5. **Backend transfers files**
   - `transfer_files_with_progress()` in `build_project/commands.rs`
   - Creates folder structure: `Footage/Camera 1/`, `Footage/Camera 2/`, etc.
   - Copies files to appropriate camera folders with progress callbacks
   - Supports cancellation via `cancel_file_transfer()` and an `OperationRegistry`
   - Generates breadcrumbs.json

6. **Backend copies Premiere template**
   - `copy_premiere_project()` in `commands/premiere.rs`
   - Reads template from `assets/Premiere 4K Template 2025.prproj`
   - Copies to `Projects/[title].prproj`
   - Uses `file.sync_all()` to prevent corruption (v0.9.1 fix)

7. **Frontend updates progress**
   - Progress events streamed from backend
   - Updates progress bar in real-time
   - Shows file-by-file status

8. **Completion**
   - Tauri command returns `Ok(())`
   - Frontend shows success message
   - Optionally opens project folder in Finder

### AI Script Formatting Flow (RAG Pipeline)

```
.docx Upload → Parse → Chunk → Embed → Retrieve Examples → LLM → Diff View
```

**Step-by-step:**

1. **User uploads .docx** in ScriptFormatter
   - File selected via `<input type="file" accept=".docx" />`
   - Upload hook reads file as ArrayBuffer
   - Calls `invoke('parse_docx_file', { filePath })` via `api.ts`

2. **Backend parses Word document**
   - `parse_docx_file()` in `commands/docx.rs`
   - Extracts text content and formatting metadata
   - Returns `ParseResult` with text, HTML, and formatting info

3. **Frontend chunks text**
   - `useScriptProcessor` splits text into semantic chunks
   - Each chunk ~500 tokens for context window efficiency

4. **Backend searches for similar examples**
   - Frontend calls `invoke('search_similar_scripts', { ... })` via `api.ts`
   - `search_similar_scripts()` in `commands/rag.rs`
   - Generates embedding, then performs cosine similarity search in SQLite
   - Uses `SELECT ... ORDER BY similarity DESC LIMIT 3`
   - Returns top 3 most relevant examples

5. **Frontend calls LLM**
   - `useScriptProcessor` constructs prompt:
     - System prompt: "Format this autocue script..."
     - Examples: Retrieved before/after pairs
     - User script: The text to format
   - Calls Ollama API via Vercel AI SDK
   - Streams response chunks

6. **Frontend displays diff**
   - `DiffEditor.tsx` uses Monaco Editor
   - Original text (left pane)
   - Formatted text (right pane)
   - User can edit right pane

7. **User exports**
   - Clicks "Download Formatted Script"
   - `useDocxGenerator` creates .docx from formatted text
   - Uses `docx` library to generate Word document
   - Triggers browser download

### State Management Architecture

**State organization:**

```
Application State
├── Global State (Zustand)
│   ├── useBreadcrumbStore        # Breadcrumbs UI state (current file, edit mode)
│   └── useAppStore               # App settings (Ollama URL, theme, etc.)
│
├── Server State (React Query)
│   ├── Breadcrumbs queries       # Read/write breadcrumbs files
│   ├── Trello queries            # Fetch card details (7-day cache)
│   ├── Sprout Video queries      # Fetch video metadata (cached)
│   ├── AI models queries         # List available Ollama models
│   └── Baker scan queries        # Folder scanning results
│
└── Local Component State (useState)
    ├── Form inputs               # User text input, selections
    ├── UI toggles                # Modal open/closed, accordion expanded
    └── Transient data            # Search filters, pagination
```

**Data flow rules:**

1. **Global state (Zustand):** Use for UI state that needs to be shared across routes
   - Example: Current breadcrumbs file being edited
   - Example: Dark mode theme preference

2. **Server state (React Query):** Use for all data fetching and mutations
   - Automatically caches responses
   - Handles loading/error states
   - Supports optimistic updates
   - Example: `useQuery({ queryKey: queryKeys.breadcrumbs(filePath), queryFn: () => api.readBreadcrumbs(filePath) })`

3. **Local state (useState):** Use for component-specific UI state
   - Form inputs before submission
   - Modal visibility
   - Transient search/filter state

**Why this architecture:**

- Zustand: Minimal boilerplate, easy to use, no provider nesting
- React Query: Best-in-class async state management, caching, deduplication
- useState: Simple, fast, no overhead for local state

## Key Design Decisions

### Decision 1: Tauri 2.0 over Electron

**What we decided:** Build the desktop app with Tauri instead of Electron.

**Context:**

- Need cross-platform desktop app (macOS, Windows, Linux)
- File system access for large video files (100+ GB projects)
- Security concerns with executing untrusted code
- App distribution size matters (DMG downloads)

**Why we decided this:**

- **Smaller app size:** Tauri apps are ~10MB vs. Electron's ~100MB (bundles OS webview instead of Chromium)
- **Better security:** Rust's memory safety, restricted IPC, no Node.js in renderer
- **Performance:** Rust backend handles file operations faster than Node.js
- **Native OS integration:** Better system dialogs, notifications, and permissions

**Trade-offs:**

- ✅ **Pros:** Smaller downloads, better security, native performance, modern Rust ecosystem
- ❌ **Cons:** Smaller community than Electron, fewer plugins/libraries, Rust learning curve
- 🤔 **When to reconsider:** If we need plugins that only exist for Electron (rare now with Tauri 2.0)

**Alternatives considered:**

- **Electron:** Rejected due to app size and security concerns
- **Progressive Web App:** Rejected because we need full file system access and OS integration

### Decision 2: TanStack React Query over useEffect

**What we decided:** Use React Query for all data fetching instead of manual `useEffect` + `useState`.

**Context:**

- Application makes many Tauri IPC calls for file operations, API calls
- Need to handle loading states, errors, retries, caching
- Previous implementation used `useEffect` with manual state management (Phase 002 refactor)

**Why we decided this:**

- **Automatic caching:** Queries are cached by key, preventing redundant Tauri calls
- **Deduplication:** Multiple components requesting same data share a single request
- **Simpler code:** Eliminates 90% of `useEffect` boilerplate
- **Built-in features:** Loading states, error handling, retries, stale-while-revalidate

**Trade-offs:**

- ✅ **Pros:** Less code, fewer bugs, better UX, excellent DevTools
- ❌ **Cons:** Learning curve for developers new to React Query
- 🤔 **When to reconsider:** If React Server Components become viable for desktop apps (unlikely)

**Example comparison:**

```typescript
// OLD: Manual useEffect (before Phase 002)
const [breadcrumbs, setBreadcrumbs] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  invoke('read_breadcrumbs', { filePath })
    .then(data => {
      setBreadcrumbs(data)
      setLoading(false)
    })
    .catch(err => {
      setError(err)
      setLoading(false)
    })
}, [filePath])

// NEW: React Query (current) -- invoked via feature api.ts
const {
  data: breadcrumbs,
  isLoading,
  error
} = useQuery({
  queryKey: queryKeys.breadcrumbs(filePath),
  queryFn: () => api.readBreadcrumbs(filePath)
})
```

### Decision 3: SQLite for RAG Embeddings

**What we decided:** Use SQLite with cosine similarity for vector search instead of dedicated vector database.

**Context:**

- AI Script Formatter needs to retrieve similar examples from ~50 bundled examples
- Need vector embeddings storage (768-dimensional vectors)
- Desktop app, not server application
- Examples database must be bundled with app

**Why we decided this:**

- **Zero configuration:** SQLite is embedded, no separate database server
- **Good enough performance:** 50 examples is tiny, linear search is <1ms
- **Bundled with app:** Database file ships in `resources/embeddings/examples.db`
- **Simple queries:** Standard SQL with custom cosine similarity function

**Trade-offs:**

- ✅ **Pros:** Simple, fast enough, no dependencies, works offline
- ❌ **Cons:** Won't scale to millions of vectors (but we only have 50)
- 🤔 **When to reconsider:** If we add user-uploaded examples reaching 10,000+ (then consider pgvector or Qdrant)

**Implementation:**

```rust
// Custom cosine similarity in SQLite
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot_product / (magnitude_a * magnitude_b)
}

// Query finds top 3 similar examples
SELECT * FROM examples
ORDER BY cosine_similarity(embedding, ?) DESC
LIMIT 3;
```

### Decision 4: Breadcrumbs as Source of Truth

**What we decided:** Use `breadcrumbs.json` files as the canonical metadata source instead of a centralized database.

**Context:**

- Need to store project metadata (title, date, cameras, video links, Trello cards)
- Projects are folder-based on user's file system
- Users may move/rename project folders
- Need metadata to survive file system changes

**Why we decided this:**

- **Portable:** Metadata travels with the project folder
- **Resilient:** Works even if Bucket app is uninstalled/reinstalled
- **Simple:** No database migrations, no schema versioning complexity
- **Inspectable:** Users can open breadcrumbs.json in any text editor

**Trade-offs:**

- ✅ **Pros:** Portable, simple, inspectable, no database
- ❌ **Cons:** Can't query across all projects efficiently (Baker workflow scans files)
- 🤔 **When to reconsider:** If we add "global search across all projects" feature (then add optional database index)

**breadcrumbs.json schema (v2.0.0):**

```json
{
  "version": "2.0.0",
  "title": "Project Title",
  "shoot_date": "2024-01-15",
  "num_cameras": 3,
  "videoLinks": [
    {
      "video_id": "abc123",
      "embed_code": "<iframe...>",
      "title": "Video Title",
      "thumbnailUrl": "https://...",
      "privacy": "public"
    }
  ],
  "trelloCards": [
    {
      "url": "https://trello.com/c/xyz",
      "title": "Card Title",
      "cached_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

## Module Dependencies

### Dependency Graph (Frontend)

```
features/<Name>/
  └─→ @shared/* (constants, hooks, lib, services, store, types, utils, ui)
  └─→ @features/<Other>/ (via barrel only, cross-feature imports)

shared/
  └─→ (never imports from features -- dependency flows one direction)
```

**Dependency rules:**

1. **No circular dependencies**
   - Enforced by TypeScript module system and ESLint boundaries plugin
   - Use dependency injection or events if needed

2. **Features import shared, never the reverse**
   - ❌ `@shared/hooks/` can't import from `@features/Baker/`
   - ✅ `@features/Baker/` can import from `@shared/hooks/`

3. **Cross-feature imports go through barrels only**
   - ❌ `import { X } from '@features/Trello/components/TrelloCardsManager'`
   - ✅ `import { TrelloCardsManager } from '@features/Trello'`

4. **All Tauri I/O goes through `api.ts`**
   - No direct `@tauri-apps` plugin imports in components/hooks
   - Enforced by no-bypass contract tests in each feature's `__contracts__/`

### External Dependencies (Key Packages)

| Package                   | Version  | Used For                 | Notes                                            |
| ------------------------- | -------- | ------------------------ | ------------------------------------------------ |
| **@tauri-apps/api**       | ~2.10.1  | Tauri IPC bridge         | Invoke Rust commands from React                  |
| **@tanstack/react-query** | ^5.90.3  | Async state management   | Replaces useEffect for data fetching             |
| **zustand**               | ^5.0.8   | Global state             | Lightweight alternative to Redux                 |
| **@radix-ui/react-\***    | 1.x--2.x | Accessible UI primitives | Headless components for dialogs, dropdowns, etc. |
| **ai** (Vercel AI SDK)    | ^6.0.199 | AI provider abstraction  | Unified interface for Ollama, OpenAI, etc.       |
| **@monaco-editor/react**  | ^4.7.0   | Code/diff editor         | Script formatting diff view                      |
| **docx**                  | ^9.5.1   | Word document generation | Export formatted scripts                         |
| **mammoth**               | ^1.12.0  | Word document parsing    | Import .docx scripts                             |
| **fuse.js**               | ^7.1.0   | Fuzzy search             | Search projects in Baker                         |
| **vite**                  | ^7.3.2   | Build tool               | Fast dev server, production builds               |
| **xstate**                | ^5.24.0  | State machines           | BuildProject workflow orchestration              |
| **react-router-dom**      | ^7.17.0  | Client-side routing      | Lazy-loaded routes via React.lazy()              |

**Rust dependencies:** See `src-tauri/Cargo.toml` for full list.

Key Rust crates:

- `tauri`: Desktop app framework
- `tokio`: Async runtime
- `reqwest`: HTTP client (Trello, Sprout Video APIs)
- `rusqlite`: SQLite database (embeddings)
- `serde`/`serde_json`: JSON serialization
- `argon2`: Password hashing
- `jsonwebtoken`: JWT authentication

## Extension Points

### Adding a New Feature Page

To add a new feature page (e.g., "Timeline" page), follow the feature-module pattern:

1. **Create feature module:**

   ```
   src/features/Timeline/
   ├── api.ts              # I/O boundary -- wraps ALL Tauri invoke/plugin calls
   ├── types.ts            # Shared type definitions
   ├── index.ts            # Barrel file -- named re-exports with JSDoc
   ├── __contracts__/      # Contract tests (shape, behavioral, no-bypass)
   ├── TimelinePage.tsx    # Main page component
   ├── components/         # Sub-components
   └── hooks/              # Feature-specific hooks
   ```

2. **Add lazy-loaded route:**
   - Open `src/AppRouter.tsx`
   - Add lazy import and route:
     ```tsx
     const TimelinePage = React.lazy(() =>
       import('@features/Timeline').then((m) => ({ default: m.TimelinePage }))
     )
     // Inside <Routes>:
     <Route path="timeline" element={<TimelinePage />} />
     ```

3. **Add sidebar navigation:**
   - Open `src/shared/ui/layout/app-sidebar.tsx`
   - Add menu item to the appropriate section

4. **Add Tauri commands (if needed):**
   - Create `src-tauri/src/commands/timeline.rs` (or a `src-tauri/src/timeline/` module)
   - Implement Rust functions with `#[tauri::command]`
   - Export in the appropriate `mod.rs`
   - Register in `src-tauri/src/main.rs` invoke_handler

5. **Run linting to verify boundary compliance:**
   ```bash
   bun run eslint:fix
   ```

### Adding a New Tauri Command

To add a new Rust function callable from React:

1. **Create command function:**

```rust
// src-tauri/src/commands/my_feature.rs
use tauri::command;

#[command]
pub async fn my_command(arg1: String, arg2: i32) -> Result<String, String> {
    // Implementation
    Ok(format!("Result: {} {}", arg1, arg2))
}
```

2. **Export command:**

```rust
// src-tauri/src/commands/mod.rs
pub mod my_feature;
pub use my_feature::*;
```

3. **Register with Tauri:**

```rust
// src-tauri/src/main.rs
// Add to the invoke_handler list:
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_command,
])
```

4. **Call from React (via feature api.ts):**

```typescript
// src/features/MyFeature/api.ts
import { invoke } from '@tauri-apps/api/core'

export async function myCommand(arg1: string, arg2: number): Promise<string> {
  return invoke<string>('my_command', { arg1, arg2 })
}

// src/features/MyFeature/hooks/useMyFeature.ts
import { useMutation } from '@tanstack/react-query'
import { myCommand } from '../api'

export function useMyFeature() {
  return useMutation({
    mutationFn: async (args: { arg1: string; arg2: number }) => {
      return await myCommand(args.arg1, args.arg2)
    }
  })
}
```

### Adding a New RAG Example

To add a new bundled script example for RAG:

1. **Create example directory:**

   ```
   src-tauri/resources/examples/new-example-1/
   ├── before.txt           # Raw script
   ├── after.txt            # Formatted script
   └── metadata.json        # Example metadata
   ```

2. **Generate embeddings:**

   ```bash
   bun run embed:examples:ollama
   ```

   This script:
   - Reads all examples from `resources/examples/`
   - Generates embeddings via Ollama
   - Inserts into `resources/embeddings/examples.db`

3. **Rebuild app:**
   ```bash
   bun run build:tauri
   ```

Examples are bundled with the app in the resources directory.

## Performance Considerations

### Critical Performance Paths

1. **File copy during project creation**
   - **Current performance:** ~100 MB/s on SSD
   - **Bottleneck:** I/O throughput (disk limited)
   - **Optimization:** Use buffered I/O (8 KB buffer), parallel copies for multiple files

2. **RAG vector search**
   - **Current performance:** <1ms for 50 examples
   - **Bottleneck:** Linear scan of embeddings (no index)
   - **Optimization:** Good enough; only needed if scaling to 10,000+ examples

3. **Script formatting (LLM inference)**
   - **Current performance:** 2-10 seconds depending on model (llama3.1: ~5s)
   - **Bottleneck:** LLM inference speed
   - **Optimization:** Use faster models (llama3.2) or GPU acceleration (if available)

### Caching Strategy

**What we cache:**

1. **Trello card details:** 7-day cache in breadcrumbs.json
   - Reduces API calls (rate limits)
   - Refreshed on manual "Refresh" button

2. **Sprout Video thumbnails:** Cached in breadcrumbs.json forever
   - Thumbnails don't change once generated
   - Reduces API latency

3. **React Query cache:** In-memory cache (5 minutes default)
   - Breadcrumbs queries: Stale after 5 minutes
   - API queries: Stale after 1 minute

**Cache invalidation:**

- **Breadcrumbs update:** Invalidates `['breadcrumbs', filePath]` query
- **Baker batch update:** Invalidates all `['breadcrumbs', ...]` queries
- **Trello card refresh:** Sets `cached_at` to current time, invalidates query

## Security Architecture

### Authentication Flow

1. **User registers** (Register.tsx)
   - Enters username + password
   - Frontend calls `invoke('register_user', { username, password })`
   - Backend hashes password with argon2 (32-byte salt, 19 MiB memory, 2 iterations)
   - Stores hash in Tauri's stronghold (secure encrypted storage)

2. **User logs in** (Login.tsx)
   - Enters username + password
   - Frontend calls `invoke('login_user', { username, password })`
   - Backend verifies password against stored hash
   - Issues JWT token (signed with HS256, 24-hour expiration)
   - Frontend stores token in memory (not localStorage - security)

3. **Authenticated requests**
   - Frontend includes JWT in Tauri command arguments
   - Backend validates JWT signature + expiration
   - Returns error if invalid/expired

### Data Security

- **Password storage:** Argon2id hashing (OWASP recommended)
- **Sensitive data:** Stored in Tauri's stronghold plugin (OS-level encryption)
- **API keys:** Encrypted in app data directory (not plain text)
- **File access:** Restricted to user-selected folders (Tauri security model)
- **IPC:** Tauri validates all command arguments (type safety + allowlist)

### Threat Model

**Trusted:**

- User's file system
- Locally running Ollama instance

**Untrusted:**

- External APIs (Trello, Sprout Video) - use HTTPS, validate responses
- User-uploaded files - validate file types, sanitize filenames
- AI model outputs - sanitize before rendering (XSS protection)

## Deployment Architecture

### Environments

| Environment          | Purpose                           | How to Run            |
| -------------------- | --------------------------------- | --------------------- |
| **Development**      | Local development with hot reload | `bun run dev:tauri`   |
| **Production Build** | Release builds for distribution   | `bun run build:tauri` |

No staging/preview environments (desktop app, not web app).

### Build Process

```bash
# Development build (debug, fast compilation)
bun run dev:tauri

# Production build (optimized, stripped)
bun run build:tauri
```

**Production build steps:**

1. **Pre-build:** Embed script examples (`bun run embed:examples:ollama`)
2. **Frontend build:** Vite builds React app → `dist/`
3. **Rust build:** Cargo compiles Rust → `target/release/`
4. **Tauri bundle:** Packages app + webview → Platform-specific installer
   - macOS: `.dmg` + `.app` bundle
   - Windows: `.msi` + `.exe` installer
   - Linux: `.AppImage` + `.deb` package

**Build artifacts:**

- macOS: `src-tauri/target/release/bundle/dmg/Bucket_<version>_universal.dmg`
- Windows: `src-tauri/target/release/bundle/msi/Bucket_<version>_x64_en-US.msi`
- Linux: `src-tauri/target/release/bundle/appimage/bucket_<version>_amd64.AppImage`

### Auto-Updates (Tauri Updater)

Bucket supports automatic updates via Tauri's updater plugin:

1. **Check for updates** on app launch
2. **Download new version** in background (if available)
3. **Prompt user** to install update
4. **Restart app** to apply update

**Update manifest:** Hosted at GitHub Releases (JSON file with version + download URLs)

## Monitoring and Observability

### Logging

**Log levels (Rust):**

- `ERROR`: Critical failures (file not found, API errors, database errors)
- `WARN`: Recoverable issues (missing optional fields, deprecated features)
- `INFO`: Normal operations (project created, file copied)
- `DEBUG`: Detailed execution flow (only in dev builds)

**Log destinations:**

- **Development:** Terminal output (`RUST_LOG=debug bun run dev:tauri`)
- **Production:** Tauri logs to app data directory (macOS: `~/Library/Logs/com.bucket.app/`)

**TypeScript logging:**

- `console.log` in development (Tauri devtools)
- Errors logged to Sentry (TODO: not yet implemented)

### Metrics

Currently no telemetry/metrics collection (privacy-focused desktop app).

**Future considerations:**

- Opt-in anonymous usage analytics (feature usage, crash reports)
- Performance monitoring (file copy speeds, LLM inference times)

## Troubleshooting

### Common Architecture Issues

**Issue: Tauri command not found**

- **Symptoms:** `Error: Command 'my_command' not found` in browser console
- **Cause:** Command not registered in `main.rs` or wrong function name
- **Solution:**
  1. Check `src-tauri/src/main.rs` → `generate_handler![..., my_command]`
  2. Verify function has `#[tauri::command]` attribute
  3. Verify the module is imported in `main.rs` (via `use` or `mod`)
  4. Rebuild Rust: `cd src-tauri && cargo build`

**Issue: React Query not refetching**

- **Symptoms:** Stale data displayed, changes not reflected
- **Cause:** Query not invalidated after mutation
- **Solution:**

  ```typescript
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: updateBreadcrumbs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] })
    }
  })
  ```

**Issue: File copy fails silently**

- **Symptoms:** Files not copied, no error message
- **Cause:** Tauri command threw error but wasn't caught
- **Solution:** Wrap Tauri calls in try-catch (via the feature's api.ts):
  ```typescript
  try {
    await api.transferFiles(args)
  } catch (error) {
    console.error('Copy failed:', error)
    toast.error(`Failed to copy files: ${error}`)
  }
  ```

**Issue: Premiere project corrupted**

- **Symptoms:** Premiere won't open project, shows corruption error
- **Cause:** File not flushed to disk (fixed in v0.9.1)
- **Solution:** Update to v0.9.1+ (includes `file.sync_all()` fix)

## Additional Resources

- **[API Commands Reference](./API_COMMANDS.md)** - Complete Tauri command documentation
- **[React Query Documentation](https://tanstack.com/query/latest)** - Learn React Query patterns
- **[Tauri Documentation](https://tauri.app/v2/guides/)** - Tauri framework guides
- **[Zustand Documentation](https://zustand-demo.pmnd.rs/)** - State management library

## Questions and Feedback

- **GitHub Issues:** [bucket/issues](https://github.com/twentynineteen/bucket/issues)
- **GitHub Discussions:** [bucket/discussions](https://github.com/twentynineteen/bucket/discussions)

---

**Document Version:** 2.0.0
**Last Updated:** July 2026
**Applies to:** Bucket v0.16.0
