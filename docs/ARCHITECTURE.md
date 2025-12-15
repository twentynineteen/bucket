# Bucket Architecture Overview

## What This Document Covers

This document explains the high-level architecture of Bucket, including how different components interact, key design decisions, data flow patterns, and where to make common changes.

**Target audience:** Developers who need to understand the system design before making significant changes or adding new features.

**Last updated:** January 2025 (v0.9.3)

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

1. **React Frontend** - User interface built with React 19, TypeScript 5.9, and TailwindCSS. Handles all UI rendering, user interactions, and client-side state management.

2. **Rust Backend (Tauri)** - Native application layer that provides secure file system access, API integrations, and performance-critical operations. Exposes commands to the frontend via Tauri's IPC bridge.

3. **File System** - Local storage for project files, breadcrumbs.json metadata, and application data. Managed through Tauri's secure file system APIs.

4. **External Integrations** - Third-party services for project management (Trello), video hosting (Sprout Video), AI formatting (Ollama), and video editing (Premiere Pro).

### Technology Stack

| Layer                  | Technology                     | Why We Chose It                                                                          |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| **Frontend Framework** | React 19 + TypeScript 5.9      | Type safety, large ecosystem, excellent tooling, team expertise                          |
| **Build Tool**         | Vite 7.1                       | Fast HMR, modern ESM support, optimized production builds                                |
| **Desktop Runtime**    | Tauri 2.0                      | Smaller app size than Electron, better security, Rust performance, native OS integration |
| **UI Components**      | Radix UI + TailwindCSS         | Accessible primitives, utility-first styling, consistent design system                   |
| **State Management**   | Zustand + TanStack React Query | Simple API, minimal boilerplate, excellent async state handling                          |
| **Backend Language**   | Rust 2021                      | Memory safety, performance, excellent async support (tokio), cargo ecosystem             |
| **Database**           | SQLite (rusqlite)              | Embedded, zero-config, perfect for desktop apps, supports vector embeddings              |
| **AI/LLM**             | Ollama + Vercel AI SDK         | Local-first, privacy-preserving, unified provider interface                              |
| **Testing**            | Vitest + Testing Library       | Fast, ESM-native, compatible with Vite, excellent DX                                     |

## Directory Structure

```
bucket/
├── src/                            # React frontend source
│   ├── pages/                      # Page-level components (routes)
│   │   ├── BuildProject/           # Multi-camera project creation
│   │   │   ├── BuildProject.tsx    # Main orchestrator component
│   │   │   ├── ProjectInputs.tsx   # Title, date, camera count inputs
│   │   │   ├── ProjectFileList.tsx # File selection and camera assignment
│   │   │   ├── ProjectActions.tsx  # Create project button + logic
│   │   │   └── ProgressBar.tsx     # File copy progress tracking
│   │   │
│   │   ├── Baker/                  # Batch breadcrumbs management
│   │   │   └── Baker.tsx           # Main Baker workflow component
│   │   │
│   │   ├── AI/                     # AI-powered features
│   │   │   ├── ScriptFormatter/    # RAG-based script formatting
│   │   │   │   ├── ScriptFormatter.tsx # Main formatter UI
│   │   │   │   ├── DiffEditor.tsx      # Monaco diff viewer
│   │   │   │   ├── FileUploader.tsx    # .docx upload
│   │   │   │   ├── ModelSelector.tsx   # AI model selection
│   │   │   │   └── ExampleToggleList.tsx # Example selection
│   │   │   │
│   │   │   └── ExampleEmbeddings/  # Manage RAG examples
│   │   │       ├── ExampleEmbeddings.tsx # Main management UI
│   │   │       ├── ExampleCard.tsx       # Display example
│   │   │       ├── UploadDialog.tsx      # Upload new example
│   │   │       └── ViewExampleDialog.tsx # View example details
│   │   │
│   │   ├── auth/                   # Authentication pages
│   │   │   ├── Login.tsx           # Login form
│   │   │   └── Register.tsx        # Registration form
│   │   │
│   │   ├── UploadSprout.tsx        # Sprout Video integration
│   │   ├── UploadTrello.tsx        # Trello integration
│   │   ├── Posterframe.tsx         # Custom posterframe generator
│   │   ├── Settings.tsx            # App settings and API keys
│   │   └── ...                     # Other pages
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # Radix UI primitives
│   │   │   ├── button.tsx          # Button component
│   │   │   ├── dialog.tsx          # Modal dialogs
│   │   │   ├── select.tsx          # Dropdown selects
│   │   │   ├── progress.tsx        # Progress bars
│   │   │   └── ...                 # 25+ UI primitives
│   │   │
│   │   ├── Baker/                  # Baker-specific components
│   │   │   ├── ProjectList.tsx     # Scanned projects list
│   │   │   ├── VideoLinksManager.tsx # Manage video links
│   │   │   ├── TrelloCardsManager.tsx # Manage Trello cards
│   │   │   └── BatchActions.tsx    # Batch update controls
│   │   │
│   │   ├── trello/                 # Trello components
│   │   │   ├── TrelloIntegrationButton.tsx
│   │   │   └── TrelloIntegrationModal.tsx
│   │   │
│   │   ├── BreadcrumbsViewer.tsx   # Display breadcrumbs data
│   │   └── ErrorBoundary.tsx       # Global error handling
│   │
│   ├── hooks/                      # Custom React hooks (40+)
│   │   ├── useCreateProject.ts     # Project creation orchestration
│   │   ├── useBreadcrumb.ts        # Read/write breadcrumbs files
│   │   ├── useBakerScan.ts         # Scan folders for projects
│   │   ├── useCameraAutoRemap.ts   # Auto-assign camera numbers
│   │   ├── useScriptProcessor.ts   # AI script formatting logic
│   │   ├── useExampleManagement.ts # Manage RAG examples
│   │   ├── useTrelloCardDetails.ts # Fetch Trello card data
│   │   ├── useSproutVideoApi.ts    # Sprout Video operations
│   │   ├── useAuth.ts              # Authentication state
│   │   └── ...                     # Domain-specific hooks
│   │
│   ├── store/                      # Zustand global state
│   │   ├── useBreadcrumbStore.ts   # Breadcrumbs UI state
│   │   └── useAppStore.ts          # App-wide settings
│   │
│   ├── services/                   # Business logic services
│   │   ├── ai/                     # AI provider abstraction
│   │   │   ├── modelFactory.ts     # Create AI provider instances
│   │   │   ├── providerConfig.ts   # Provider configurations
│   │   │   └── types.ts            # AI service types
│   │   ├── ProgressTracker.ts      # Progress tracking utility
│   │   └── cache-invalidation.ts   # React Query cache logic
│   │
│   ├── utils/                      # Utility functions
│   │   ├── validation.ts           # Input validation helpers
│   │   ├── breadcrumbsValidation.ts # Breadcrumbs schema validation
│   │   ├── parseSproutVideoUrl.ts  # Extract Sprout video IDs
│   │   ├── extractVideoInfoBlock.ts # Parse video info from text
│   │   ├── debounce.ts             # Debounce utility
│   │   └── ...                     # Domain utilities
│   │
│   ├── types/                      # TypeScript type definitions
│   │   ├── baker.ts                # Baker workflow types
│   │   ├── scriptFormatter.ts      # Script formatter types
│   │   ├── exampleEmbeddings.ts    # RAG example types
│   │   └── media.ts                # Media file types
│   │
│   ├── lib/                        # Shared library code
│   │   ├── query-client-config.ts  # React Query configuration
│   │   ├── query-keys.ts           # Centralized query key factory
│   │   └── query-utils.ts          # Query helper functions
│   │
│   ├── App.tsx                     # Root React component
│   ├── AppRouter.tsx               # React Router configuration
│   └── index.tsx                   # App entry point
│
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── commands/               # Tauri command modules
│   │   │   ├── mod.rs              # Command exports
│   │   │   ├── auth.rs             # Authentication (argon2, JWT)
│   │   │   ├── file_ops.rs         # File system operations
│   │   │   ├── premiere.rs         # Premiere Pro integration
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
│   │   │   └── file_copy.rs        # Optimized file copying
│   │   │
│   │   ├── baker.rs                # Baker workflow types
│   │   ├── media.rs                # Media file handling
│   │   ├── lib.rs                  # Library root
│   │   └── main.rs                 # App entry point
│   │
│   ├── resources/                  # Bundled app resources
│   │   ├── embeddings/
│   │   │   └── examples.db         # SQLite vector embeddings DB
│   │   └── examples/               # Bundled script examples
│   │       ├── educational-lecture-1/
│   │       └── business-presentation-1/
│   │
│   ├── assets/                     # Static assets
│   │   ├── Premiere 4K Template 2025.prproj
│   │   └── Premiere 4K Template 2023.prproj
│   │
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri app configuration
│   └── build.rs                    # Build script
│
├── specs/                          # Feature specifications (PRDs)
│   ├── 004-embed-multiple-video/   # Multiple video links design
│   ├── 007-frontend-script-example/ # Script examples management
│   └── ...
│
├── tests/                          # Frontend tests
│   └── ...
│
├── .claude/                        # Claude Code configuration
│   ├── skills/                     # Custom Claude skills
│   └── ...
│
├── docs/                           # Documentation
│   ├── README.md                   # This file
│   ├── ARCHITECTURE.md             # Architecture overview
│   └── API_COMMANDS.md             # Tauri commands reference
│
├── package.json                    # npm dependencies + scripts
├── Cargo.toml                      # Workspace root (if applicable)
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
└── CLAUDE.md                       # Claude Code instructions
```

### Directory Purpose and Rules

#### src/pages/

**Purpose:** Page-level components that represent routes in the application.

**What goes here:**

- Top-level feature pages (BuildProject, Baker, Settings, etc.)
- Route-specific orchestrator components
- Sub-components specific to one page (in subdirectories)

**What doesn't go here:**

- Reusable components (put in `components/`)
- Business logic (put in `hooks/` or `services/`)
- Utilities (put in `utils/`)

**When to add a file:** When creating a new route/page in the application.

#### src/hooks/

**Purpose:** Custom React hooks that encapsulate reusable logic.

**What goes here:**

- Tauri command wrappers (e.g., `useBreadcrumb`)
- TanStack React Query hooks for data fetching
- Complex state management logic
- Reusable UI behavior (e.g., `useZoomPan`)

**What doesn't go here:**

- Pure utility functions (put in `utils/`)
- UI components (put in `components/`)
- Global state stores (put in `store/`)

**When to add a file:** When logic is reused across 2+ components or when abstracting Tauri commands.

#### src-tauri/src/commands/

**Purpose:** Rust functions exposed to the frontend via Tauri's IPC.

**What goes here:**

- File system operations
- API integrations (Trello, Sprout Video, Ollama)
- Database operations (SQLite)
- CPU-intensive operations (embeddings, file hashing)

**What doesn't go here:**

- UI logic (stays in React)
- Simple data transformations (do in TypeScript unless performance-critical)

**When to add a file:** When adding new Rust functionality that the frontend needs to call.

**Naming convention:** Functions are annotated with `#[tauri::command]` and use snake_case (e.g., `create_project_folder`).

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

1. **User selects files** in `ProjectFileList.tsx`
   - User clicks "Select Files" button
   - Calls `useFileSelector` hook
   - Hook invokes `open()` from `@tauri-apps/plugin-dialog`
   - Returns file paths array

2. **User assigns cameras**
   - Files displayed in list with camera number inputs
   - Auto-assign button triggers `useCameraAutoRemap` hook
   - Validates that cameras 1 to N are all assigned

3. **User creates project**
   - Clicks "Create Project" in `ProjectActions.tsx`
   - Calls `useCreateProject` hook
   - Hook validates inputs (title, folder, camera assignments)

4. **Frontend invokes Tauri command**
   - `useCreateProject` calls `invoke('create_project_folder', { ... })`
   - Tauri IPC serializes arguments to JSON
   - Rust backend receives command

5. **Backend creates project**
   - `create_project_folder()` in `file_ops.rs`
   - Creates folder structure: `Footage/Camera 1/`, `Footage/Camera 2/`, etc.
   - Copies files to appropriate camera folders with progress callbacks
   - Emits progress events via `window.emit('copy_progress', ...)`
   - Generates breadcrumbs.json

6. **Backend copies Premiere template**
   - `copy_premiere_template()` in `premiere.rs`
   - Reads template from `assets/Premiere 4K Template 2025.prproj`
   - Copies to `Projects/[title].prproj`
   - Uses `file.sync_all()` to prevent corruption (v0.9.1 fix)

7. **Frontend updates progress**
   - `useCopyProgress` hook listens to `copy_progress` events
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

1. **User uploads .docx** in `FileUploader.tsx`
   - File selected via `<input type="file" accept=".docx" />`
   - `useScriptFileUpload` hook reads file as ArrayBuffer
   - Calls `invoke('parse_docx', { fileData: Array.from(buffer) })`

2. **Backend parses Word document**
   - `parse_docx()` in `docx.rs`
   - Uses `mammoth` crate to extract text
   - Returns plain text string

3. **Frontend chunks text**
   - `useScriptProcessor` splits text into semantic chunks
   - Each chunk ~500 tokens for context window efficiency

4. **Backend generates embeddings**
   - Frontend calls `invoke('embed_text_ollama', { text, model })`
   - `embed_text_ollama()` in `rag.rs`
   - Sends text to Ollama embedding endpoint
   - Returns vector embedding (e.g., 768 dimensions for nomic-embed-text)

5. **Backend retrieves similar examples**
   - `find_similar_examples()` in `rag.rs`
   - Performs cosine similarity search in SQLite
   - Uses `SELECT ... ORDER BY similarity DESC LIMIT 3`
   - Returns top 3 most relevant examples

6. **Frontend calls LLM**
   - `useScriptProcessor` constructs prompt:
     - System prompt: "Format this autocue script..."
     - Examples: Retrieved before/after pairs
     - User script: The text to format
   - Calls Ollama API via Vercel AI SDK
   - Streams response chunks

7. **Frontend displays diff**
   - `DiffEditor.tsx` uses Monaco Editor
   - Original text (left pane)
   - Formatted text (right pane)
   - User can edit right pane

8. **User exports**
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
   - Example: `useQuery(['breadcrumbs', filePath], () => invoke('read_breadcrumbs', { filePath }))`

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

// NEW: React Query (current)
const {
  data: breadcrumbs,
  isLoading,
  error
} = useQuery({
  queryKey: ['breadcrumbs', filePath],
  queryFn: () => invoke('read_breadcrumbs', { filePath })
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
pages/
  └─→ components/
        └─→ hooks/
              └─→ lib/ (React Query config)
                    └─→ services/
                          └─→ utils/

store/
  └─→ (no dependencies, stores are independent)

hooks/
  └─→ services/ (AI provider abstraction)
  └─→ lib/ (query utilities)
```

**Dependency rules:**

1. **No circular dependencies**
   - Enforced by TypeScript and Rust module system
   - Use dependency injection or events if needed

2. **Lower layers can't depend on higher layers**
   - ❌ `hooks/` can't import from `pages/`
   - ✅ `pages/` can import from `hooks/`

3. **Services are UI-agnostic**
   - Don't import React components in `services/`
   - Keep business logic separate from UI

### External Dependencies (Key Packages)

| Package                   | Version | Used For                 | Notes                                            |
| ------------------------- | ------- | ------------------------ | ------------------------------------------------ |
| **@tauri-apps/api**       | 2.9.0   | Tauri IPC bridge         | Invoke Rust commands from React                  |
| **@tanstack/react-query** | 5.90.3  | Async state management   | Replaces useEffect for data fetching             |
| **zustand**               | 5.0.8   | Global state             | Lightweight alternative to Redux                 |
| **@radix-ui/react-\***    | 1.x     | Accessible UI primitives | Headless components for dialogs, dropdowns, etc. |
| **ai** (Vercel AI SDK)    | 5.0.72  | AI provider abstraction  | Unified interface for Ollama, OpenAI, etc.       |
| **@monaco-editor/react**  | 4.7.0   | Code/diff editor         | Script formatting diff view                      |
| **docx**                  | 9.5.1   | Word document generation | Export formatted scripts                         |
| **mammoth**               | 1.11.0  | Word document parsing    | Import .docx scripts                             |
| **fuse.js**               | 7.1.0   | Fuzzy search             | Search projects in Baker                         |
| **vite**                  | 7.1.10  | Build tool               | Fast dev server, production builds               |

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

To add a new feature page (e.g., "Timeline" page):

1. **Create page component:**

   ```
   src/pages/Timeline/
   ├── Timeline.tsx           # Main page component
   ├── TimelineView.tsx       # Sub-component
   └── TimelineControls.tsx   # Sub-component
   ```

2. **Add route:**
   - Open `src/AppRouter.tsx`
   - Add route: `<Route path="/timeline" element={<Timeline />} />`

3. **Add sidebar navigation:**
   - Open `src/components/nav-main.tsx`
   - Add menu item:
     ```tsx
     {
       title: "Timeline",
       url: "/timeline",
       icon: Calendar,
     }
     ```

4. **Create hooks (if needed):**
   - `src/hooks/useTimelineData.ts` - Fetch timeline data
   - Use React Query for data fetching

5. **Add Tauri commands (if needed):**
   - Create `src-tauri/src/commands/timeline.rs`
   - Implement Rust functions
   - Export in `src-tauri/src/commands/mod.rs`
   - Add to Tauri builder in `src-tauri/src/main.rs`

6. **Add types:**
   - `src/types/timeline.ts` - TypeScript types for timeline feature

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
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            my_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

4. **Call from React:**

```typescript
// src/hooks/useMyFeature.ts
import { invoke } from '@tauri-apps/api/core'

export function useMyFeature() {
  return useMutation({
    mutationFn: async (args: { arg1: string; arg2: number }) => {
      return await invoke<string>('my_command', args)
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
   npm run embed:examples:ollama
   ```

   This script:
   - Reads all examples from `resources/examples/`
   - Generates embeddings via Ollama
   - Inserts into `resources/embeddings/examples.db`

3. **Rebuild app:**
   ```bash
   npm run build:tauri
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
| **Development**      | Local development with hot reload | `npm run dev:tauri`   |
| **Production Build** | Release builds for distribution   | `npm run build:tauri` |

No staging/preview environments (desktop app, not web app).

### Build Process

```bash
# Development build (debug, fast compilation)
npm run dev:tauri

# Production build (optimized, stripped)
npm run build:tauri
```

**Production build steps:**

1. **Pre-build:** Embed script examples (`npm run embed:examples:ollama`)
2. **Frontend build:** Vite builds React app → `dist/`
3. **Rust build:** Cargo compiles Rust → `target/release/`
4. **Tauri bundle:** Packages app + webview → Platform-specific installer
   - macOS: `.dmg` + `.app` bundle
   - Windows: `.msi` + `.exe` installer
   - Linux: `.AppImage` + `.deb` package

**Build artifacts:**

- macOS: `src-tauri/target/release/bundle/dmg/Bucket_0.9.3_universal.dmg`
- Windows: `src-tauri/target/release/bundle/msi/Bucket_0.9.3_x64_en-US.msi`
- Linux: `src-tauri/target/release/bundle/appimage/bucket_0.9.3_amd64.AppImage`

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

- **Development:** Terminal output (`RUST_LOG=debug npm run dev:tauri`)
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
  1. Check `src-tauri/src/main.rs` → `invoke_handler!([..., my_command])`
  2. Verify function has `#[tauri::command]` attribute
  3. Rebuild Rust: `cd src-tauri && cargo build`

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
- **Solution:** Wrap Tauri calls in try-catch:
  ```typescript
  try {
    await invoke('copy_files', args)
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

**Document Version:** 1.0.0
**Last Updated:** January 2025
**Applies to:** Bucket v0.9.3
