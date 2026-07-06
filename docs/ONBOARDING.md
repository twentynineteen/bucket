# Developer Onboarding Guide

Welcome to Bucket! This guide will help you get started contributing to the codebase in under 30 minutes.

## What You'll Learn

- Setting up your development environment
- Running the app locally
- Understanding the codebase structure
- Making your first change
- Running tests and quality checks
- Submitting a pull request

---

## Prerequisites

Before starting, ensure you have:

- **macOS, Windows, or Linux** (primary development on macOS)
- **Bun** (required -- the project's standard package manager)
- **Rust** 1.70+ ([install from rustup.rs](https://rustup.rs))
- **Git** for version control
- **Code editor** (VS Code recommended with Rust Analyzer extension)

**Optional (for AI features):**

- **Ollama** ([install from ollama.com](https://ollama.com))
- At least one model: `ollama pull llama3.1:latest`

---

## Step 1: Clone and Install (5 minutes)

### Clone the Repository

```bash
git clone https://github.com/twentynineteen/bucket.git
cd bucket
```

### Install Dependencies

```bash
bun install
```

This installs:

- Frontend dependencies (React, TypeScript, Vite, etc.)
- Development tools (Prettier, ESLint, Vitest)
- Tauri CLI

### Verify Rust Installation

```bash
rustc --version  # Should be 1.70+
cargo --version
```

If Rust is not installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

---

## Step 2: Run the App (5 minutes)

### Start Development Mode

```bash
bun run dev:tauri
```

This will:

1. Start the Vite dev server (React frontend)
2. Compile Rust backend
3. Launch the desktop app with devtools

**First-time compilation takes 2-5 minutes** (Rust compiles dependencies). Subsequent builds are much faster (~10 seconds).

### What You Should See

- A desktop window opens with the Bucket app
- You can right-click in the window and select "Inspect Element" to open devtools
- The console shows React and Tauri logs

### Verify Everything Works

1. **Navigate to Build Project** from the sidebar
2. **Click "Select Files"** - You should see a native file picker
3. If file picker works, your setup is correct!

---

## Step 3: Understand the Codebase (10 minutes)

### Project Structure Overview

```
bucket/
├── src/                        # React frontend (TypeScript)
│   ├── features/               # Feature modules (AITools, Auth, Baker,
│   │                           #   BuildProject, Premiere, Settings, Trello, Upload)
│   ├── shared/                 # Cross-feature code
│   │   ├── constants/          # Timing, animation, project constants
│   │   ├── hooks/              # Cross-feature hooks
│   │   ├── lib/                # Query infrastructure
│   │   ├── services/           # ProgressTracker, feedback, cache
│   │   ├── store/              # Zustand stores (appStore, breadcrumbStore)
│   │   ├── types/              # Shared domain types
│   │   ├── ui/                 # Radix primitives, sidebar, theme, layout
│   │   └── utils/              # Logger, storage, validation, cn()
│   ├── App.tsx                 # Root React component
│   └── AppRouter.tsx           # Route definitions (lazy-loaded)
│
├── src-tauri/                  # Rust backend
│   ├── src/commands/           # Tauri commands (API for frontend)
│   ├── src/state/              # Shared Rust state
│   └── Cargo.toml              # Rust dependencies
│
└── docs/                       # Documentation
    ├── README.md               # User-facing documentation
    ├── ARCHITECTURE.md         # System architecture
    ├── API_COMMANDS.md         # Tauri commands reference
    └── ONBOARDING.md           # This file
```

### Key Files to Know

| File                            | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `src/App.tsx`                   | Root React component                   |
| `src/AppRouter.tsx`             | Route definitions                      |
| `src-tauri/src/main.rs`         | Rust app entry point                   |
| `src-tauri/src/commands/mod.rs` | Tauri commands registry                |
| `package.json`                  | npm scripts and dependencies           |
| `CLAUDE.md`                     | Project instructions for AI assistants |

### Read the Documentation

Before making changes, skim these docs:

1. **[README.md](./README.md)** - Get familiar with features
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Understand system design
3. **[API_COMMANDS.md](./API_COMMANDS.md)** - Learn Tauri command API
4. **[CLAUDE.md](../CLAUDE.md)** - Module conventions and import rules

**Time investment:** 15-20 minutes of reading will save hours later.

---

## Step 4: Make Your First Change (10 minutes)

Let's make a simple change to see the development workflow.

### Frontend Change Example

**Task:** Add a welcome message to the Settings page

1. **Open the file:**

   ```bash
   code src/features/Settings/components/SettingsPage.tsx
   ```

2. **Find the return statement** (around line 50)

3. **Add a welcome message above the settings form:**

   ```tsx
   return (
     <div className="container mx-auto p-6">
       <h1 className="text-2xl font-bold mb-4">Settings</h1>

       {/* Add this new section */}
       <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
         <p className="text-blue-800">
           Welcome to Bucket Settings! Configure your API integrations below.
         </p>
       </div>

       {/* Existing settings form below... */}
     </div>
   )
   ```

4. **Save the file** - The app will hot-reload automatically!

5. **Verify the change:**
   - Navigate to Settings in the app
   - You should see the new welcome message

### Backend Change Example

**Task:** Add a command that returns the current timestamp

1. **Create a new command file:**

   ```bash
   code src-tauri/src/commands/timestamp.rs
   ```

2. **Add the command:**

   ```rust
   use chrono::Utc;

   #[tauri::command]
   pub fn get_timestamp() -> String {
       Utc::now().to_rfc3339()
   }
   ```

3. **Export the command:**

   Edit `src-tauri/src/commands/mod.rs`:

   ```rust
   pub mod timestamp;  // Add this line
   pub use timestamp::*;  // Add this line
   ```

4. **Register the command:**

   Edit `src-tauri/src/main.rs`, find `.invoke_handler(...)` and add `get_timestamp`:

   ```rust
   .invoke_handler(tauri::generate_handler![
       // ... existing commands
       get_timestamp,  // Add this
   ])
   ```

5. **Call from frontend:**

   Create a hook in your feature's `hooks/` directory (e.g., `src/features/Settings/hooks/useTimestamp.ts`):

   ```typescript
   import { useQuery } from '@tanstack/react-query'

   import { getTimestamp } from '../api'

   export function useTimestamp() {
     return useQuery({
       queryKey: ['timestamp'],
       queryFn: getTimestamp,
       refetchInterval: 1000 // Update every second
     })
   }
   ```

   > **Convention:** Never import `@tauri-apps` directly in hooks or components.
   > All Tauri calls go through the feature's `api.ts` file (see CLAUDE.md).

6. **Use in a component:**

   Edit `src/features/Settings/components/SettingsPage.tsx`:

   ```tsx
   import { useTimestamp } from '../hooks/useTimestamp'

   export function Settings() {
     const { data: timestamp } = useTimestamp()

     return (
       <div>
         <p>Server time: {timestamp}</p>
         {/* Rest of component */}
       </div>
     )
   }
   ```

7. **Restart the app** (Ctrl+C, then `bun run dev:tauri`)

8. **Verify:** You should see a live-updating timestamp!

---

## Step 5: Code Quality Checks (5 minutes)

Before committing code, always run these checks:

### Auto-Format Code

```bash
# Fix formatting issues
bun run prettier:fix

# Fix linting issues
bun run eslint:fix
```

**Formatting rules:**

- 90 character line width
- Single quotes
- No semicolons
- 2-space indentation

### Run Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode (useful during development)
bun run test:ui
```

**Coverage check:**

```bash
bun run test:coverage
```

### Rust Code Quality

```bash
cd src-tauri

# Format Rust code
cargo fmt

# Run linter
cargo clippy

# Run Rust tests
cargo test
```

### Pre-Commit Checklist

Before every commit:

- [ ] Code formatted: `bun run prettier:fix`
- [ ] Linting passes: `bun run eslint:fix`
- [ ] Tests pass: `bun run test`
- [ ] Rust formatted: `cargo fmt`
- [ ] No compiler warnings

---

## Step 6: Submit a Pull Request (5 minutes)

### Create a Feature Branch

```bash
# Create and switch to a new branch
git checkout -b feature/my-new-feature

# Make your changes, then stage them
git add .

# Commit with a descriptive message
git commit -m "feat: add welcome message to Settings page"
```

### Commit Message Convention

Follow the Conventional Commits format:

```
<type>: <description>

[optional body]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic changes)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**

```bash
git commit -m "feat: add timestamp display to Settings"
git commit -m "fix: resolve file copy corruption issue"
git commit -m "docs: update architecture documentation"
```

### Push and Create PR

```bash
# Push to GitHub
git push origin feature/my-new-feature

# Open GitHub and create a Pull Request to the 'master' branch
```

**PR Description Template:**

```markdown
## What This PR Does

Brief description of changes

## Why These Changes

Explain the motivation

## Testing

- [ ] Tested locally in dev mode
- [ ] Tests pass (`bun run test`)
- [ ] Linting passes (`bun run eslint:fix`)
- [ ] Formatted code (`bun run prettier:fix`)

## Screenshots (if UI changes)

[Add screenshots here]
```

---

## Common Development Tasks

### Adding a New Feature Module

See CLAUDE.md section "How to Add a New Feature Module" for the full checklist. In short:

1. **Create feature directory** with `api.ts`, `types.ts`, `index.ts`, `components/`, `hooks/`, `__contracts__/`

   ```bash
   mkdir -p src/features/MyFeature/{components,hooks,__contracts__}
   ```

2. **Add lazy route** in `src/AppRouter.tsx`:

   ```tsx
   const MyFeaturePage = React.lazy(() =>
     import('@features/MyFeature').then(m => ({ default: m.MyFeaturePage }))
   )
   ```

3. **Add to sidebar** in `src/shared/ui/sidebar/SidebarMenu.tsx`

### Adding a New Tauri Command

See [Step 4: Backend Change Example](#backend-change-example) above.

**Quick reference:**

1. Create command in `src-tauri/src/commands/`
2. Export in `mod.rs`
3. Register in `main.rs`
4. Wrap the invoke call in the feature's `api.ts`
5. Create hook in the feature's `hooks/` directory
6. Use in component

### Adding a New Dependency

**Frontend:**

```bash
bun add package-name
```

**Backend:**

```bash
cd src-tauri
cargo add crate-name
```

### Debugging Tips

**Frontend debugging:**

- Right-click in app → Inspect Element
- Use React DevTools (installed automatically in dev mode)
- Check TanStack Query DevTools (bottom-left icon)

**Backend debugging:**

```bash
# Enable detailed Rust logs
RUST_LOG=debug bun run dev:tauri

# View logs for specific module
RUST_LOG=app_lib::commands=debug bun run dev:tauri
```

**Common issues:**

| Problem                   | Solution                                     |
| ------------------------- | -------------------------------------------- |
| "Command not found" error | Command not registered in `main.rs`          |
| Hot reload not working    | Restart dev server                           |
| Rust compilation fails    | Run `cargo clean`, then rebuild              |
| File picker doesn't open  | Check Tauri permissions in `tauri.conf.json` |

---

## Development Workflow Best Practices

### 1. Use React Query for Data Fetching

**Don't do this:**

```typescript
const [data, setData] = useState(null)

useEffect(() => {
  invoke('get_data').then(setData)
}, [])
```

**Do this:**

```typescript
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: () => invoke('get_data')
})
```

### 2. Use Zustand for Global UI State

**Example:**

```typescript
// src/shared/store/useMyStore.ts
import { create } from 'zustand'

interface MyStore {
  count: number
  increment: () => void
}

export const useMyStore = create<MyStore>(set => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 }))
}))
```

### 3. Keep Components Small

**Guideline:**

- Components should be <200 lines
- Extract complex logic to custom hooks
- Break large components into smaller sub-components

### 4. Type Everything

**Always use TypeScript:**

```typescript
// Good
interface User {
  id: string
  name: string
}

function getUser(): Promise<User> { ... }

// Bad
function getUser() { ... }  // No return type
```

### 5. Test New Features

Write tests for:

- Utility functions (required)
- Custom hooks (recommended)
- Complex components (recommended)

**Example test:**

```typescript
import { myFunction } from '@shared/utils/myFunction'
import { describe, expect, it } from 'vitest'

describe('myFunction', () => {
  it('should return correct value', () => {
    expect(myFunction('input')).toBe('output')
  })
})
```

---

## Learning Resources

### Documentation

- **[README.md](./README.md)** - Features and setup guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and patterns
- **[API_COMMANDS.md](./API_COMMANDS.md)** - Tauri commands reference
- **[BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md)** - Git branching workflow
- **[CLAUDE.md](../CLAUDE.md)** - Project conventions and patterns

### External Resources

**React & TypeScript:**

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TanStack Query](https://tanstack.com/query/latest)

**Tauri:**

- [Tauri Documentation](https://tauri.app/start/)
- [Tauri Commands Guide](https://tauri.app/develop/calling-rust/)

**Rust:**

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)

### Code Examples

**Study these well-implemented features:**

1. **BuildProject workflow** (`src/features/BuildProject/`) - Complex multi-step flow with XState
2. **Baker** (`src/features/Baker/`) - Folder scanning and batch operations
3. **AITools** (`src/features/AITools/`) - AI integration pattern (ScriptFormatter + ExampleEmbeddings)
4. **RAG commands** (`src-tauri/src/commands/rag.rs`) - Database + embedding pattern

---

## Getting Help

### Within the Codebase

1. **Check existing code** - Search for similar patterns in `src/features/`
2. **Read CLAUDE.md** - Project conventions and decisions
3. **Read ARCHITECTURE.md** - System design and patterns

### Community

- **GitHub Issues:** [Report bugs or request features](https://github.com/twentynineteen/bucket/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/twentynineteen/bucket/discussions)

### When You're Stuck

**Before asking for help:**

1. Check the error message carefully
2. Search existing GitHub issues
3. Try `cargo clean && cargo build` (Rust issues)
4. Try deleting `node_modules` and reinstalling with `bun install` (frontend issues)

**When asking for help, include:**

- What you're trying to do
- What you expected to happen
- What actually happened
- Error messages (full text)
- Your environment (OS, Rust version, Node version)

---

## Next Steps

Now that you're set up:

1. **Pick a "good first issue"** from GitHub Issues
2. **Implement a small feature** to get familiar with the codebase
3. **Read the ARCHITECTURE.md** to understand design patterns
4. **Review existing PRs** to learn code review standards

**Suggested first tasks:**

- Add a new field to breadcrumbs.json
- Create a new UI component
- Add a new Tauri command
- Write tests for existing utilities
- Improve documentation

---

## Welcome to the Team!

You're now ready to contribute to Bucket. Don't hesitate to ask questions and remember:

- **Code quality matters** - Run formatters and tests before committing
- **Small PRs are better** - Easier to review and merge
- **Documentation is code** - Update docs when adding features
- **Tests prevent regressions** - Write tests for new code

Happy coding! 🚀

---

**Document Version:** 1.1.0
**Last Updated:** July 2026
**Maintainer:** Check GitHub for current maintainers
