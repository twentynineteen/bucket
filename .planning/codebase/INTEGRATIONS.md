# External Integrations

**Analysis Date:** 2026-03-07

## APIs & External Services

**Video Hosting:**
- Sprout Video - Video upload, folder management, video metadata/thumbnails
  - SDK/Client: `reqwest` (Rust) for upload with progress tracking
  - Auth: `SproutVideo-Api-Key` header, key stored in `api_keys.json`
  - Base URL: `https://api.sproutvideo.com/v1/`
  - Endpoints used: `GET /v1/folders`, `POST /v1/videos` (multipart upload)
  - Frontend hooks: `src/hooks/useSproutVideoApi.ts`, `src/hooks/useSproutVideoPlayer.ts`, `src/hooks/useSproutVideoProcessor.ts`
  - Backend commands: `get_folders`, `upload_video` in `src-tauri/src/commands/sprout_upload.rs`
  - Frontend pages: `src/pages/UploadSprout.tsx`, `src/pages/FolderTreeSprout.tsx`

**Project Management:**
- Trello - Card management, board browsing, card detail fetching
  - SDK/Client: Direct REST API via Tauri HTTP / frontend fetch
  - Auth: API key + token, stored in `api_keys.json`
  - Endpoints used: `GET /1/cards/{id}`, board listing, card details
  - Frontend hooks: `src/hooks/useTrelloBoard.ts`, `src/hooks/useTrelloBoards.ts`, `src/hooks/useTrelloBoardSearch.ts`, `src/hooks/useTrelloCardDetails.ts`, `src/hooks/useTrelloCardsManager.ts`, `src/hooks/useTrelloActions.ts`, `src/hooks/useTrelloBreadcrumbs.ts`
  - Frontend components: `src/components/trello/TrelloIntegrationModal.tsx`, `src/components/Baker/TrelloCardsManager.tsx`, `src/components/Baker/TrelloCardItem.tsx`
  - Frontend pages: `src/pages/UploadTrello.tsx`, `src/pages/UploadTrello/`
  - Settings: `src/components/Settings/TrelloBoardSelector.tsx`
  - Trello card data cached in `breadcrumbs.json` with 7-day refresh

**Video Editing:**
- Adobe Premiere Pro - Project template generation and CEP plugin management
  - Integration: Rust-side XML manipulation of `.prproj` files using `quick-xml`
  - Backend commands: `copy_premiere_project` in `src-tauri/src/commands/premiere.rs`
  - Plugin management: CEP extension installation from bundled ZXP files via `src-tauri/src/commands/plugins.rs`
  - Plugin commands: `get_available_plugins`, `install_plugin`, `check_plugin_installed`, `get_cep_directory`, `enable_cep_debug_mode`, `open_cep_folder`
  - Frontend page: `src/pages/PremierePluginManager/PremierePluginManager.tsx`
  - CEP directory: `~/Library/Application Support/Adobe/CEP/extensions/` (macOS user-level)

**AI/LLM:**
- Ollama (Local) - AI-powered autocue script formatting
  - SDK/Client: `ollama-ai-provider-v2` via Vercel AI SDK (`ai` package)
  - Auth: None (local service)
  - Default URL: `http://localhost:11434` (configurable in Settings)
  - Provider config: `src/services/ai/providerConfig.ts`
  - Model factory: `src/services/ai/modelFactory.ts`
  - Frontend hooks: `src/hooks/useAIProvider.ts`, `src/hooks/useOllamaEmbedding.ts`, `src/hooks/useScriptProcessor.ts`
  - Connection validation: `validate_provider_connection` in `src-tauri/src/commands/ai_provider.rs`

- OpenAI (Future Phase 2) - Planned but commented out
  - SDK/Client: `@ai-sdk/openai` installed but adapter code commented out in `src/services/ai/providerConfig.ts`
  - Factory function `createOpenAIModel` exists in `src/services/ai/modelFactory.ts`

**ML/Embeddings:**
- Xenova Transformers - Client-side vector embeddings for RAG search
  - SDK/Client: `@xenova/transformers` 2.17
  - Purpose: Generate embeddings for script example similarity search
  - Frontend hook: `src/hooks/useOllamaEmbedding.ts`
  - Build script: `scripts/embed-examples-ollama.js` (runs as prebuild step)
  - Bundled embeddings: `resources/embeddings/` directory

## Data Storage

**Databases:**
- SQLite (via `rusqlite` bundled)
  - Purpose: RAG example embeddings storage for AI script formatting
  - Location: Tauri `app_data_dir()` (persists across app updates)
  - Client: `rusqlite` 0.32 with bundled SQLite
  - Schema: Examples with id, title, category, before_text, after_text, embedding vectors, source column (bundled vs user-uploaded)
  - Commands: `src-tauri/src/commands/rag.rs` (search_similar_scripts, get_example_by_id, upload_example, replace_example, delete_example)
  - Bundled DB copied to app data on first run

**File Storage:**
- Local filesystem only (Tauri plugin-fs)
  - API keys: `api_keys.json` in `appDataDir()` via `src/utils/storage.ts`
  - Project data: `breadcrumbs.json` files in project directories
  - Video project structure: `Footage/`, `Graphics/`, `Renders/`, `Projects/`, `Scripts/` folders
  - Premiere templates: Bundled in `assets/` directory, copied to project folders
  - CEP plugins: Bundled ZXP files in `assets/plugins/`

**Caching:**
- TanStack React Query in-memory cache with persistence
  - Config: `src/lib/query-client-config.ts`
  - Persistence via `@tauri-apps/plugin-store` (get/set/del)
  - Sprout Video thumbnails cached in `breadcrumbs.json`
  - Trello card titles cached with 7-day refresh cycle
- localStorage for theme preferences

## Authentication & Identity

**Auth Provider:**
- Custom token-based authentication
  - Implementation: In-memory token store managed by Rust backend
  - Backend: `src-tauri/src/commands/auth.rs` (`check_auth`, `add_token`)
  - State: `src-tauri/src/state/auth.rs` (`AuthState` with `Mutex<Vec<String>>` token list)
  - Password hashing: `argon2` 0.5 (Rust)
  - JWT: `jsonwebtoken` 9.3 (Rust)
  - Secure storage: `@tauri-apps/plugin-stronghold` for credential vault (`$APPDATA/vault.hold`)
  - Frontend: `src/pages/auth/` directory

**External API Auth:**
- Sprout Video: API key in custom header (`SproutVideo-Api-Key`)
- Trello: API key + token as query parameters
- Ollama: No auth (local service)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- Rust backend: `log` + `simple_logger` crate, initialized in `src-tauri/src/main.rs`
- Frontend: Custom namespaced logger utility (`src/utils/logger.ts`)
- ESLint enforces `no-console: error` - use logger utility instead of `console.*`

## CI/CD & Deployment

**Hosting:**
- GitHub Releases for distribution
- gh-pages branch for `latest.json` updater manifest

**CI Pipeline (GitHub Actions):**
- `.github/workflows/ci.yml` - Lint (ESLint + Prettier), unit tests, Linux build, macOS build (release branch only), E2E tests (Playwright Chromium)
- `.github/workflows/publish.yml` - Release builds (macOS aarch64 + x86_64), code signing, optional notarization, GitHub Release creation
- `.github/workflows/auto-release-pr.yml` - Automated release PR creation
- `.github/workflows/e2e-tests.yml` - Dedicated E2E test workflow
- `.github/workflows/update-node-dependencies.yml` - Automated dependency updates
- `.github/workflows/update-rust-packages.yml` - Automated Rust dependency updates

**Release Process:**
1. Push to `release` branch triggers `publish.yml`
2. Builds signed DMGs for aarch64 and x86_64 macOS
3. Creates draft GitHub Release with DMGs + updater artifacts
4. Generates `latest.json` for Tauri auto-updater
5. Publishes `latest.json` to gh-pages
6. Local notarization via `./scripts/notarize-local.sh` (default, saves CI costs)
7. Full CI notarization available via manual workflow dispatch

**Auto-Update:**
- Tauri updater plugin checks `https://github.com/twentynineteen/bucket/releases/latest/download/latest.json`
- Signed update bundles (`.app.tar.gz` + `.sig`)
- Update check and install via `src/AppRouter.tsx`

## Environment Configuration

**Required configuration (stored in `api_keys.json` via Settings page):**
- `sproutVideo` - Sprout Video API key (for video upload features)
- `trello` - Trello API key (for project management integration)
- `trelloToken` - Trello API token
- `trelloBoardId` - Default Trello board ID
- `ollamaUrl` - Ollama service URL (default: `http://localhost:11434`)
- `defaultBackgroundFolder` - Default folder for background assets

**CI Secrets (GitHub Actions):**
- `TAURI_SIGNING_PRIVATE_KEY` - Tauri updater signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Signing key password
- `APPLE_CERTIFICATE` - Apple code signing certificate (base64)
- `APPLE_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_SIGNING_IDENTITY` - Apple signing identity
- `APPLE_ID` - Apple ID for notarization
- `APPLE_PASSWORD` - App-specific password for notarization
- `APPLE_TEAM_ID` - Apple Developer Team ID

**Secrets location:**
- Runtime API keys: `api_keys.json` in Tauri app data directory (per-user, not in repo)
- Secure credentials: Tauri Stronghold vault (`$APPDATA/vault.hold`)
- CI secrets: GitHub Actions secrets

## Webhooks & Callbacks

**Incoming:**
- Deep link handler: `bucket://` URL scheme registered in `src-tauri/tauri.conf.json`
- Also registered: `myapp://`, `Bucket://`

**Outgoing:**
- None detected

## Tauri IPC Commands

All frontend-to-backend communication uses Tauri's `invoke()` IPC mechanism. Commands registered in `src-tauri/src/main.rs`:

**File Operations:** `move_files`, `copy_premiere_project`, `open_folder`, `get_folder_size`
**Baker/Breadcrumbs:** `baker_start_scan`, `baker_get_scan_status`, `baker_cancel_scan`, `baker_validate_folder`, `baker_read_breadcrumbs`, `baker_update_breadcrumbs`, `baker_scan_current_files`, `baker_read_raw_breadcrumbs`
**Video Links:** `baker_get_video_links`, `baker_associate_video_link`, `baker_remove_video_link`, `baker_update_video_link`, `baker_reorder_video_links`
**Trello:** `baker_get_trello_cards`, `baker_associate_trello_card`, `baker_remove_trello_card`, `baker_fetch_trello_card_details`, `fetch_trello_boards`
**Sprout Video:** `get_folders`, `upload_video`, `fetch_sprout_video_details`
**AI/RAG:** `search_similar_scripts`, `get_example_by_id`, `get_all_examples`, `get_all_examples_with_metadata`, `upload_example`, `replace_example`, `delete_example`, `validate_provider_connection`, `validate_provider_with_auth`
**DOCX:** `parse_docx_file`, `generate_docx_file`, `validate_docx_file`
**Premiere Plugins:** `get_available_plugins`, `install_plugin`, `check_plugin_installed`, `get_cep_directory`, `enable_cep_debug_mode`, `open_cep_folder`
**System:** `graceful_restart`, `show_confirmation_dialog`, `open_resource_file`, `get_username`, `check_auth`, `add_token`

**Event Emitters (Rust to Frontend):**
- `copy_file_error` - Individual file copy failure
- Upload progress events during Sprout Video upload (via `ProgressReader`)
- File copy progress events during `move_files`

---

*Integration audit: 2026-03-07*
