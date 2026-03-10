---
created: 2026-03-10T11:31:55.976Z
title: Fix ESLint boundaries no-unknown-files warning on lazy routes
area: tooling
files:
  - eslint.config.js
  - src/AppRouter.tsx
---

## Problem

After converting route imports to `React.lazy()` with Suspense (commit f845c19), ESLint's `boundaries/no-unknown-files` rule fires warnings on files that don't match any configured boundary element pattern. The lazy-loaded route files aren't recognized by the boundaries plugin's element classification, causing false positives during linting.

This was identified as a minor issue during Phase 009 UAT (test #4: Route lazy loading).

## Solution

Update `eslint.config.js` to configure the `boundaries` plugin's element patterns to recognize lazy-loaded route files. This likely involves adding or adjusting the `elements` configuration to include the file patterns used by the lazy-loaded route components.
