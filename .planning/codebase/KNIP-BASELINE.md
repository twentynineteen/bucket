# Knip Baseline Report

**Date:** 2026-03-08
**Knip Version:** 5.86.0
**Configuration:** knip.json (vite/vitest/eslint plugins disabled due to vite-plugin-monaco-editor load error)

## Summary Counts

| Category | Count |
|----------|-------|
| Unused files | 43 |
| Unused dependencies | 9 |
| Unused devDependencies | 8 |
| Unlisted dependencies | 5 |
| Unresolved imports | 1 |
| Unused exports | 145 |
| Unused exported types | 62 |
| Duplicate exports | 6 |

**Total issues: 279**

## Known False Positives

The following are known false positives and should NOT be counted as real issues:

### Configuration Hints (Ignore)

Knip suggests removing items from `ignore` and `ignoreDependencies` in knip.json. These are intentional:

- `src-tauri/**` and `scripts/**` are outside the TypeScript project scope
- `@tauri-apps/cli` and `@tauri-apps/api` are used by the Tauri runtime, not directly imported
- `vite-plugin-monaco-editor`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `lightningcss` are Vite ecosystem deps used in vite.config.ts
- `@tailwindcss/postcss`, `postcss`, `tailwindcss` are CSS toolchain deps
- `prettier-plugin-tailwindcss`, `@ianvs/prettier-plugin-sort-imports` are Prettier plugins loaded by config
- `babel-plugin-transform-import-meta` is used in test/build tooling

### Unlisted Dependencies (False Positives)

- `@types/media` and `@types/scriptFormatter` are local TypeScript path aliases (tsconfig paths), not npm packages

### Unresolved Imports (False Positive)

- `jest` in tsconfig.json is a leftover reference from Jest-to-Vitest migration -- should be cleaned up

### Dependency False Positives (Likely)

Some "unused" dependencies may be used by the Tauri backend or loaded indirectly:
- `@tauri-apps/plugin-deep-link` -- used by Rust backend
- `@tauri-apps/plugin-stronghold` -- used by Rust backend
- `caniuse-lite` -- peer dependency used by browserslist/PostCSS
- `tailwindcss-animate` -- used in CSS via @import, not JS imports
- `tauri-plugin-macos-permissions-api` -- used by Rust backend

## Full Report

### Unused Files (43)

```
src/components/Baker/ProjectList.tsx
src/components/BreadcrumbsViewer.tsx
src/components/BreadcrumbsViewer/NormalView.tsx
src/components/BreadcrumbsViewer/PreviewComparison.tsx
src/components/BreadcrumbsViewerEnhanced.tsx
src/components/ProjectChangeDetailView.tsx
src/components/Settings/ThemeImport.tsx
src/components/Settings/TrelloBoardError.tsx
src/components/trello/TrelloIntegrationButton.tsx
src/components/trello/TrelloIntegrationModal.tsx
src/components/ui/button-variants.ts
src/components/ui/sonner.tsx
src/constants/index.ts
src/hooks/useFileOperations.ts
src/hooks/useHighlights.ts
src/hooks/usePremiereIntegration.ts
src/hooks/useProjectBreadcrumbs.ts
src/hooks/useProjectFolders.ts
src/hooks/useProjectValidation.ts
src/hooks/useScriptFileUpload.ts
src/hooks/useSproutVideoPlayer.ts
src/hooks/useTranscript.ts
src/hooks/useTrelloActions.ts
src/hooks/useTrelloBoardSearch.ts
src/hooks/useTrelloBreadcrumbs.ts
src/hooks/useTrelloCardSelection.ts
src/hooks/useTrelloVideoInfo.ts
src/hooks/useUpdateMutation.ts
src/hooks/useVideoDetails.ts
src/lib/query-client-config.ts
src/pages/FolderTreeNavigator.tsx
src/pages/FolderTreeSprout.tsx
src/services/ProgressTracker.ts
src/services/UserFeedbackService.ts
src/types/customTheme.ts
src/types/plugins.ts
src/utils/breadcrumbsMigration.ts
src/utils/breadcrumbsValidation.ts
src/utils/themeLoader.ts
src/utils/themeMapper.ts
src/utils/trello/TrelloCardMembers.tsx
src/utils/trello/VideoInfoAccordion.tsx
src/utils/updateManifest.ts
```

### Unused Dependencies (9)

```
@ai-sdk/openai
@tanstack/react-query-persist-client
@tauri-apps/plugin-deep-link
@tauri-apps/plugin-stronghold
ai-labs-claude-skills
caniuse-lite
hls.js
tailwindcss-animate
tauri-plugin-macos-permissions-api
```

### Unused devDependencies (8)

```
@ai-sdk/provider-utils
@babel/plugin-syntax-import-meta
@typescript-eslint/parser
baseline-browser-mapping
depcheck
eslint-config-prettier
npm-check-updates
prettier-eslint-cli
```

### Unused Exports (145)

See full knip output for details. Major categories:
- UI component library re-exports (Radix UI wrappers): ~30 exports
- Animation constants: ~12 exports
- Query/performance utilities: ~20 exports
- Hook barrel re-exports: ~15 exports
- Breadcrumb comparison utilities: ~10 exports
- AI/Script formatter utilities: ~10 exports
- Type exports: 62 (interfaces/types defined but not imported)

### Duplicate Exports (6)

```
Page|default                      src/app/dashboard/page.tsx
AppRouter|default                 src/AppRouter.tsx
QueryPerformanceMonitor|default   src/lib/performance-monitor.ts
QueryPrefetchManager|default      src/lib/prefetch-strategies.ts
CacheInvalidationService|default  src/services/cache-invalidation.ts
useAppStore|appStore              src/store/useAppStore.ts
```

## Notes

- This baseline was captured BEFORE the deep module refactor begins
- Dead code will NOT be deleted in this phase -- this is a report-only baseline
- Later phases will compare against these counts to track cleanup progress
- The vite/vitest/eslint knip plugins are disabled because vite-plugin-monaco-editor cannot be loaded by knip's config parser (it uses a non-standard default export pattern)
- Many "unused exports" in UI components are intentional -- they are Radix UI primitive re-exports kept for future use
