# Bucket - Video Production Workflow Desktop App

## What This Does

Bucket is a desktop application that streamlines professional video production workflows by automating video ingest, multi-camera project setup, and integrating with Adobe Premiere, Trello, and Sprout Video. It eliminates manual file organization and repetitive tasks, letting video editors focus on creative work instead of project administration.

## Quick Start

Get up and running in under 5 minutes:

### Prerequisites

- **Node.js** 18+ or **Bun** (recommended)
- **Rust** 1.70+ (for building from source)
- **Ollama** (optional - for AI Script Formatter feature)
  - Download from [ollama.com](https://ollama.com)
  - Required models: `ollama pull llama3.1:latest`

### Installation

#### Option 1: Download Pre-built App (Recommended)

1. Download the latest DMG from [Releases](https://github.com/twentynineteen/bucket/releases)
2. Open the DMG and drag Bucket to your Applications folder
3. Launch Bucket from Applications

#### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/twentynineteen/bucket.git
cd bucket

# Install dependencies (using Bun - recommended)
bun install

# Build the desktop app
npm run build:tauri

# On macOS, the app will be in /target/build/dmg
# Open the DMG and copy Bucket.app to Applications
```

### Verify It's Working

1. **Launch Bucket** from your Applications folder
2. **Create an account** or log in
3. **Navigate to Build Project** from the sidebar
4. **Select some video files** to verify file selection works
5. You should see your selected files listed with camera assignment options

### Development Setup

For active development with hot reload:

```bash
# Install dependencies
bun install

# Run in development mode (starts Tauri with devtools)
npm run dev:tauri

# In a separate terminal, run tests
npm run test
```

## Project Structure

```
bucket/
├── src/                           # Frontend React/TypeScript code
│   ├── pages/                     # Page-level components (routes)
│   │   ├── BuildProject/          # Main project creation workflow
│   │   ├── Baker/                 # Batch breadcrumbs management
│   │   ├── AI/                    # AI-powered features
│   │   │   ├── ScriptFormatter/   # Script formatting with LLMs
│   │   │   └── ExampleEmbeddings/ # RAG example management
│   │   ├── auth/                  # Login and registration
│   │   ├── UploadSprout.tsx       # Sprout Video integration
│   │   ├── UploadTrello.tsx       # Trello integration
│   │   ├── Posterframe.tsx        # Custom posterframe generation
│   │   └── Settings.tsx           # App configuration
│   ├── components/                # Reusable UI components
│   │   ├── ui/                    # Radix UI components (buttons, dialogs, etc.)
│   │   ├── Baker/                 # Baker-specific components
│   │   └── trello/                # Trello integration components
│   ├── hooks/                     # Custom React hooks
│   │   ├── useBreadcrumb.ts       # Breadcrumbs file operations
│   │   ├── useCreateProject.ts    # Project creation logic
│   │   ├── useBakerScan.ts        # Folder scanning for Baker
│   │   ├── useScriptProcessor.ts  # AI script formatting
│   │   └── ...                    # 40+ specialized hooks
│   ├── store/                     # Zustand state management
│   │   ├── useBreadcrumbStore.ts  # Breadcrumbs state
│   │   └── useAppStore.ts         # Global app state
│   ├── services/                  # Business logic services
│   ├── utils/                     # Utility functions
│   ├── types/                     # TypeScript type definitions
│   └── lib/                       # Shared libraries and configs
│
├── src-tauri/                     # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands/              # Tauri command handlers
│   │   │   ├── auth.rs            # User authentication (argon2 + JWT)
│   │   │   ├── file_ops.rs        # File operations with progress tracking
│   │   │   ├── premiere.rs        # Adobe Premiere integration
│   │   │   ├── sprout_upload.rs   # Sprout Video API
│   │   │   ├── docx.rs            # Word document processing
│   │   │   ├── rag.rs             # RAG embeddings for script formatting
│   │   │   └── ai_provider.rs     # AI provider management
│   │   ├── state/                 # Shared state management
│   │   ├── utils/                 # Rust utility functions
│   │   ├── baker.rs               # Baker workflow logic
│   │   └── media.rs               # Media file handling
│   ├── Cargo.toml                 # Rust dependencies
│   ├── tauri.conf.json            # Tauri app configuration
│   └── resources/                 # Bundled resources
│       └── embeddings/            # Pre-computed script examples database
│
├── specs/                         # Feature specifications (PRDs)
│   ├── 004-embed-multiple-video/  # Multiple video links feature
│   ├── 007-frontend-script-example/ # Script example management
│   └── ...
├── tests/                         # Vitest test suite
├── .claude/                       # Claude Code configuration
│   └── skills/                    # Custom Claude skills
└── docs/                          # Additional documentation
```

### Key Directories Explained

**src/pages/** - Top-level page components that map to routes. Each page represents a major feature (BuildProject, Baker, AI tools, etc.). Add new pages here when creating new top-level features.

**src/components/** - Reusable UI components. Organized by feature (Baker/, trello/) or as general UI primitives (ui/). Components here should be presentational and reusable across multiple pages.

**src/hooks/** - Custom React hooks that encapsulate business logic, API calls, and complex state management. Use TanStack React Query for data fetching (preferred over useEffect). Add hooks here when logic is reused across 2+ components.

**src-tauri/src/commands/** - Rust functions exposed to the frontend via Tauri's IPC bridge. Each module represents a functional domain (file operations, authentication, AI, etc.). Add new commands here for any Rust-side functionality.

**src/store/** - Zustand stores for global state management. Currently contains breadcrumbs state and app-wide settings. Prefer local state or React Query for component-specific data.

## Key Concepts

### Breadcrumbs System

**What it is:** A `breadcrumbs.json` file stored in each project folder that contains metadata about the project (title, date, camera count, video links, Trello cards, etc.).

**Why this matters:** Breadcrumbs serve as the central source of truth for project metadata. They enable:

- Quick project identification without opening Premiere
- Integration with external tools (Trello, Sprout Video)
- Batch operations across multiple projects (Baker workflow)
- Persistent metadata that survives file system changes

**Example breadcrumbs.json:**

```json
{
  "version": "2.0.0",
  "title": "Conference Keynote 2024",
  "shoot_date": "2024-03-15",
  "num_cameras": 3,
  "videoLinks": [
    {
      "video_id": "abc123",
      "embed_code": "<iframe...>",
      "title": "Full Event",
      "thumbnailUrl": "https://..."
    }
  ],
  "trelloCards": [
    {
      "url": "https://trello.com/c/xyz789",
      "title": "Q1 Marketing Event",
      "cached_at": "2024-03-20T10:30:00Z"
    }
  ]
}
```

### Multi-Camera Workflow

**What it is:** A system for organizing video files by camera number (1 to N) during project creation.

**Why this matters:** Professional multi-camera shoots generate hundreds of files from different cameras. Bucket automates the organization:

- Files are validated to ensure they have camera assignments from 1 to `num_cameras`
- Files are copied to the appropriate camera subfolder (`Camera 1/`, `Camera 2/`, etc.)
- Adobe Premiere project template is configured for the camera count

**Example:**

```javascript
// Selected files
[
  { name: 'clip1.mov', camera: 1 },
  { name: 'clip2.mov', camera: 1 },
  { name: 'clip3.mov', camera: 2 }
]

// Resulting folder structure
Conference Keynote 2024/
├── Footage/
│   ├── Camera 1/
│   │   ├── clip1.mov
│   │   └── clip2.mov
│   └── Camera 2/
│       └── clip3.mov
├── Projects/
│   └── Conference Keynote 2024.prproj
└── breadcrumbs.json
```

### RAG-Powered Script Formatting

**What it is:** AI-powered autocue script formatting using Retrieval-Augmented Generation (RAG) with locally hosted LLM models.

**Why this matters:** Professional autocue scripts require specific formatting (punctuation, paragraph breaks, speaker notes). Instead of manual formatting:

- Upload a Word document with raw transcript
- System retrieves similar example scripts from embedding database
- LLM uses examples to format the script consistently
- Review changes in a diff editor before exporting

**How it works:**

1. User uploads script → parsed with mammoth.js
2. Script chunks are embedded using Ollama's embedding model
3. Similar examples are retrieved from SQLite vector database
4. Examples + user script sent to LLM for formatting
5. Formatted output displayed in Monaco diff editor
6. User can edit and export as .docx

## Common Tasks

### Creating a New Video Project

1. **Navigate to Build Project** from the sidebar
2. **Click "Select Files"** and choose your video footage
3. **Assign camera numbers** to each file (or use auto-assign for sequential numbering)
4. **Set the number of cameras** (validates that all cameras 1-N are assigned)
5. **Enter project title** and select destination folder
6. **Click "Create Project"**
7. **Watch progress bar** as files are copied and Premiere project is generated

**Expected result:** A new folder with organized footage, Premiere project file, and breadcrumbs.json

### Formatting a Script with AI

1. **Ensure Ollama is running** (`ollama serve` in terminal)
2. **Navigate to AI Tools → Script Formatter**
3. **Select AI Provider** (Ollama) and choose a model (e.g., llama3.1)
4. **Upload your .docx script** (click "Upload .docx File")
5. **Click "Format Script"** and wait for processing
6. **Review changes** in the diff editor (original left, formatted right)
7. **Make manual edits** if needed in the right pane
8. **Click "Download Formatted Script"** to save as .docx

**Expected result:** A professionally formatted script ready for teleprompter use

### Batch Updating Breadcrumbs (Baker Workflow)

1. **Navigate to Baker** from the sidebar
2. **Click "Select Root Directory"** and choose a folder containing multiple project folders
3. **Wait for scan to complete** (identifies projects with Footage/, Projects/, etc.)
4. **Review detected projects** in the list
5. **Update fields** you want to change (title, date, video links, Trello cards)
6. **Select projects** to update using checkboxes
7. **Click "Preview Changes"** to see what will be modified
8. **Click "Apply Changes"** to batch update breadcrumbs.json files

**Expected result:** Updated breadcrumbs across multiple projects with progress tracking

### Adding a Sprout Video Link

1. **Upload your video to Sprout Video** (external step)
2. **Copy the embed code** from Sprout Video dashboard
3. **In Bucket, open the project** or navigate to Upload Sprout
4. **Paste the embed code**
5. **System extracts video ID and thumbnail** automatically
6. **Save to breadcrumbs**

**Expected result:** Video link with thumbnail stored in breadcrumbs.json

### Connecting a Trello Card

1. **Navigate to Upload Trello** or use Baker's Trello integration
2. **Paste Trello card URL** (e.g., `https://trello.com/c/abc123`)
3. **System fetches card details** (title, members, description) via Trello API
4. **Review card information** in accordion
5. **Save to breadcrumbs**

**Expected result:** Trello card metadata cached in breadcrumbs.json (refreshed every 7 days)

## Configuration

### Environment Variables

Not currently used. Configuration is stored in Tauri's app data directory and managed through the Settings page.

### Application Settings

**Accessible via:** Settings page in the app

| Setting                  | Description                            | Default                  | Required            |
| ------------------------ | -------------------------------------- | ------------------------ | ------------------- |
| **Ollama URL**           | Ollama server endpoint for AI features | `http://localhost:11434` | For AI features     |
| **Trello API Key**       | Trello API key for card integration    | None                     | For Trello features |
| **Trello Token**         | Trello OAuth token                     | None                     | For Trello features |
| **Sprout Video API Key** | Sprout Video API key                   | None                     | For Sprout features |

**How to configure:**

1. Open Bucket
2. Navigate to Settings
3. Enter your API keys
4. Click "Test Connection" to verify
5. Save settings

## Development

### Running Tests

```bash
# Run all tests (Vitest)
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests once (CI mode)
npm run test:run

# Run Rust tests
cd src-tauri
cargo test
```

### Code Style

**Frontend (TypeScript/React):**

- **Component Style:** Functional components with `React.FC` typing
- **Naming:** PascalCase for components, camelCase for functions/variables
- **Imports:** Auto-sorted with `@ianvs/prettier-plugin-sort-imports`
- **Tailwind Classes:** Auto-sorted with `prettier-plugin-tailwindcss`
- **State Management:** Zustand stores for global state, React Query for server state

**Auto-formatting:**

```bash
# Check formatting
npm run prettier

# Fix formatting issues
npm run prettier:fix

# Check linting
npm run eslint

# Fix linting issues
npm run eslint:fix
```

**Backend (Rust):**

- Follow standard Rust conventions (rustfmt)
- Use `Result<T, E>` for error handling
- Document public APIs with `///` doc comments
- Prefer explicit error types over `.unwrap()`

```bash
# Format Rust code
cd src-tauri
cargo fmt

# Run Clippy linter
cargo clippy
```

### Debugging

**Frontend Debugging:**

Development mode includes React DevTools and TanStack Query DevTools:

```bash
# Start with devtools open
npm run dev:tauri
```

Open the devtools in the app window (right-click → Inspect Element)

**Backend Debugging:**

Rust logs are output to the terminal when running in dev mode:

```bash
# Enable detailed Rust logs
RUST_LOG=debug npm run dev:tauri

# Enable logs for specific modules
RUST_LOG=app_lib::commands=debug npm run dev:tauri
```

**Common debugging commands:**

```bash
# Check Ollama connection
curl http://localhost:11434/api/tags

# View Tauri app data directory (breadcrumbs, settings, etc.)
# macOS:
open ~/Library/Application\ Support/com.bucket.app

# Inspect SQLite embeddings database
cd src-tauri/resources/embeddings
sqlite3 examples.db "SELECT COUNT(*) FROM examples;"
```

## Troubleshooting

### Ollama Connection Failed

**Problem:** AI Script Formatter shows "Failed to connect to Ollama" or "No models available"

**Solution:**

```bash
# 1. Check if Ollama is running
curl http://localhost:11434/api/tags

# If connection refused, start Ollama
ollama serve

# 2. Verify models are installed
ollama list

# If no models, install one
ollama pull llama3.1:latest

# 3. Check Settings in Bucket
# - Open Settings
# - Verify Ollama URL is http://localhost:11434
# - Click "Test Connection"
```

### Build Errors (Missing Dependencies)

**Problem:** `npm run build:tauri` fails with missing dependency errors

**Solution:**

```bash
# 1. Clear node_modules and reinstall
rm -rf node_modules bun.lock package-lock.json
bun install

# 2. Clear Rust build cache
cd src-tauri
cargo clean

# 3. Rebuild
cd ..
npm run build:tauri

# 4. If still failing, check Rust version
rustc --version  # Should be 1.70+

# Update Rust if needed
rustup update
```

### File Copy Fails During Project Creation

**Problem:** "Failed to copy file" or "Permission denied" errors during BuildProject workflow

**Solution:**

1. **Check disk space:** Ensure destination folder has enough space
2. **Check permissions:** Make sure you have write access to the destination folder
3. **Check file locks:** Close any apps (Premiere, Finder) that might have files open
4. **Try a different destination:** Some network drives may not support certain operations

```bash
# Check disk space
df -h

# Check permissions on destination folder
ls -ld /path/to/destination

# Grant write access if needed (macOS)
chmod u+w /path/to/destination
```

### Premiere Project File Corrupted

**Problem:** Premiere project file won't open or shows corruption errors

**Solution:** This was fixed in v0.9.1 with proper file sync. If you encounter this:

1. **Update to latest version** of Bucket
2. **Recreate the project** using Bucket (the bug is fixed)
3. **Check Premiere template:** Ensure `src-tauri/assets/Premiere 4K Template 2025.prproj` exists

### Baker Scan Finds No Projects

**Problem:** Baker scan completes but shows 0 projects found

**Solution:**

Baker requires folders to have this structure to be detected as valid projects:

```
ProjectFolder/
├── Footage/
├── Projects/
└── breadcrumbs.json (optional - created if missing)
```

**Fix:**

1. Ensure folders have at least `Footage/` and `Projects/` subdirectories
2. Folder names are case-sensitive on Linux/macOS
3. Try scanning a parent directory that contains multiple project folders

## Additional Documentation

- **[PREMIERE_PLUGINS.md](./PREMIERE_PLUGINS.md)** - Install and manage Premiere Pro CEP extensions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture and design decisions
- **[API_COMMANDS.md](./API_COMMANDS.md)** - Complete Tauri command reference
- **[CLAUDE.md](../CLAUDE.md)** - Instructions for Claude Code when working with this codebase
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and release notes
- **[specs/](../specs/)** - Feature specifications and PRDs for each major feature

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/twentynineteen/bucket/issues)
- **Discussions:** [GitHub Discussions](https://github.com/twentynineteen/bucket/discussions)
- **Email:** Check repository for contact information

## License

This project is proprietary software. All rights reserved. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.

---

**Version:** 0.9.3
**Last Updated:** January 2025
**Platform Support:** macOS, Windows, Linux
