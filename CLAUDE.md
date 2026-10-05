# CLAUDE.md

Bucket is a Tauri 2 desktop app for video production: footage ingest, project creation, render
QC, and integration with Adobe Premiere, Trello and Sprout Video. Rust backend in `src-tauri/`,
React + TypeScript frontend in `src/`.

## Commands

- `bun run dev:tauri` runs the app. `bun run test:run` runs Vitest once; `bun run test` watches.
  The rest are in `package.json`.
- Bun is the only package manager, including for one-off tools (`bunx`, not `npx`).
- Lefthook formats and lints staged files on commit and typechecks on push. CI runs the same
  checks over the whole tree, plus tests.

## Where to look

- `docs/ARCHITECTURE.md`: module map, each feature's data flow, cross-feature edges, and the
  steps for adding a feature page or Tauri command.
- `CODING_STANDARDS.md`: read before writing or deleting tests. Also the review rules.
- `docs/agents/`: issue tracker (GitHub), triage labels and domain-doc layout for the
  engineering skills.

## Module rules

Each feature is one PascalCase directory, `src/features/<Name>/`, holding `api.ts` (the only file
that calls Tauri), an `index.ts` barrel, `__contracts__/`, `components/`, `hooks/` and
`internal/`. Features import `@shared/*` and other features' barrels; shared never imports
features. ESLint enforces the import shape.

- One feature stays in one directory. A feature spread over two modules escapes its own contract
  tests, which is how a module with seven direct `@tauri-apps` imports went unnoticed (#208).
- Only three path aliases exist: `@features/*`, `@shared/*`, `@tests/*`. The `@/` alias and
  `src/pages/` are gone, though older code and docs still mention them.

## Security

The app has no authentication: it is a single-user local tool with no login, account or
password. Third-party credentials (Sprout, Trello, AI providers) sit unencrypted in
`api_keys.json` in the app data directory, protected only by OS file permissions. No hashing,
token signing or encrypted keystore exists; anything that needs one has to add it.

## Agent skills

Issue tracker (GitHub), triage labels and domain docs: see `docs/agents/`.
