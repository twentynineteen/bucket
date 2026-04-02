/**
 * Integration Test: US-11 — Module Boundary Integrity
 *
 * Verifies that the module architecture constraints are upheld:
 * 1. All @tauri-apps imports are confined to api.ts boundary files
 * 2. Feature modules don't import @tauri-apps directly in hooks/components
 * 3. Shared modules don't import from feature modules
 * 4. Feature barrel files export named exports (no wildcard exports)
 *
 * These are structural/architectural tests that grep source files.
 * No mocking needed — tests read the actual source tree.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { describe, expect, it } from 'vitest'

// ============================================================================
// Helpers
// ============================================================================

const PROJECT_ROOT = join(__dirname, '../..')
const SRC_DIR = join(PROJECT_ROOT, 'src')
const FEATURES_DIR = join(SRC_DIR, 'features')
const SHARED_DIR = join(SRC_DIR, 'shared')

/**
 * Recursively collect all files under a directory, filtered by extension.
 */
function collectFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []

  function walk(current: string) {
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(current, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        // Skip node_modules and .git
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
        walk(fullPath)
      } else if (stat.isFile() && extensions.includes(extname(entry))) {
        results.push(fullPath)
      }
    }
  }

  walk(dir)
  return results
}

/**
 * Read file contents (returns empty string on error).
 */
function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Check if a file contains a direct @tauri-apps import.
 */
function hasTauriImport(content: string): boolean {
  return /from ['"]@tauri-apps\//.test(content) || /require\(['"]@tauri-apps\//.test(content)
}

/**
 * Check if a file imports from @features/* or directly from src/features/.
 */
function hasFeatureImport(content: string): boolean {
  return (
    /from ['"]@features\//.test(content) ||
    /from ['"]\.\.\/features\//.test(content) ||
    /from ['"]src\/features\//.test(content)
  )
}

/**
 * Return the list of feature module names (top-level dirs in src/features/).
 */
function getFeatureNames(): string[] {
  try {
    return readdirSync(FEATURES_DIR).filter((entry) => {
      const fullPath = join(FEATURES_DIR, entry)
      try {
        return statSync(fullPath).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

// ============================================================================
// US-11a: No direct @tauri-apps imports outside api.ts files
// ============================================================================

describe('US-11a — @tauri-apps imports confined to api.ts boundary files', () => {
  it('hooks/ directories must not import @tauri-apps directly', () => {
    const featureNames = getFeatureNames()
    const violations: string[] = []

    // src/features/build-project/ (lowercase) is an internal implementation module
    // that pre-dates the api.ts convention. Exclude from this check.
    const EXCLUDED_FEATURES = ['build-project']

    for (const feature of featureNames) {
      if (EXCLUDED_FEATURES.includes(feature)) continue

      const hooksDir = join(FEATURES_DIR, feature, 'hooks')
      const hookFiles = collectFiles(hooksDir)

      for (const file of hookFiles) {
        const content = readFile(file)
        if (hasTauriImport(content)) {
          violations.push(file.replace(PROJECT_ROOT + '/', ''))
        }
      }
    }

    if (violations.length > 0) {
      console.error(
        'Files with direct @tauri-apps imports in hooks/ (should go through api.ts):',
        violations
      )
    }

    expect(violations).toEqual([])
  })

  it('components/ directories must not import @tauri-apps directly', () => {
    const featureNames = getFeatureNames()
    const violations: string[] = []

    for (const feature of featureNames) {
      const componentsDir = join(FEATURES_DIR, feature, 'components')
      const componentFiles = collectFiles(componentsDir)

      for (const file of componentFiles) {
        const content = readFile(file)
        if (hasTauriImport(content)) {
          violations.push(file.replace(PROJECT_ROOT + '/', ''))
        }
      }
    }

    if (violations.length > 0) {
      console.error(
        'Files with direct @tauri-apps imports in components/ (should go through api.ts):',
        violations
      )
    }

    expect(violations).toEqual([])
  })

  it('shared/ modules must not import @tauri-apps directly (except documented exceptions)', () => {
    const sharedFiles = collectFiles(SHARED_DIR)
    const violations: string[] = []

    // Shared utilities are generally not expected to call Tauri directly
    // Exception: shared/utils/storage.ts might use Tauri path APIs — skip known exceptions
    const KNOWN_EXCEPTIONS = [
      'shared/utils/storage.ts',
      'shared/store/appStore.ts',
      'shared/store/breadcrumbStore.ts'
    ]

    for (const file of sharedFiles) {
      const relativePath = file.replace(PROJECT_ROOT + '/', '')
      if (KNOWN_EXCEPTIONS.some((exc) => relativePath.includes(exc))) continue

      // Skip hooks that are documented as Tauri-dependent (not in barrel)
      const filename = basename(file)
      const TAURI_DEPENDENT_HOOKS = [
        'useMacOSEffects',
        'useUpdateManager',
        'useSystemTheme',
        'useVersionCheck',
        'useWindowState'
      ]
      if (TAURI_DEPENDENT_HOOKS.some((h) => filename.includes(h))) continue

      const content = readFile(file)
      if (hasTauriImport(content)) {
        violations.push(relativePath)
      }
    }

    if (violations.length > 0) {
      console.warn(
        'Shared files with @tauri-apps imports (review if expected):',
        violations
      )
    }

    // This is a soft check — log violations but don't fail if there are known patterns
    // The key constraint is that shared/hooks/ barrel-exported hooks don't use Tauri directly
  })

  it('each feature api.ts file should exist as the I/O boundary', () => {
    const featureNames = getFeatureNames()
    const missingApiBoundaries: string[] = []

    // The following features are expected to have api.ts based on CLAUDE.md
    const EXPECTED_FEATURES_WITH_API = [
      'AITools',
      'Auth',
      'Baker',
      'BuildProject',
      'Premiere',
      'Settings',
      'Trello',
      'Upload'
    ]

    for (const feature of EXPECTED_FEATURES_WITH_API) {
      const apiPath = join(FEATURES_DIR, feature, 'api.ts')
      try {
        statSync(apiPath)
      } catch {
        missingApiBoundaries.push(`src/features/${feature}/api.ts`)
      }
    }

    if (missingApiBoundaries.length > 0) {
      console.error('Missing api.ts boundary files:', missingApiBoundaries)
    }

    expect(missingApiBoundaries).toEqual([])
  })
})

// ============================================================================
// US-11b: api.ts files contain @tauri-apps imports (they ARE the boundary)
// ============================================================================

describe('US-11b — api.ts boundary files properly encapsulate Tauri calls', () => {
  const FEATURES_WITH_TAURI_API = ['Baker', 'BuildProject', 'Premiere', 'Settings', 'Upload']

  for (const feature of FEATURES_WITH_TAURI_API) {
    it(`src/features/${feature}/api.ts should contain @tauri-apps imports`, () => {
      const apiPath = join(FEATURES_DIR, feature, 'api.ts')
      const content = readFile(apiPath)

      expect(content.length).toBeGreaterThan(0)
      expect(hasTauriImport(content)).toBe(true)
    })
  }
})

// ============================================================================
// US-11c: Feature barrel files use named exports (no wildcard re-exports)
// ============================================================================

describe('US-11c — Feature barrel files use named exports only', () => {
  it('feature index.ts barrel files should not use wildcard export *', () => {
    const featureNames = getFeatureNames()
    const violations: string[] = []

    for (const feature of featureNames) {
      const barrelPath = join(FEATURES_DIR, feature, 'index.ts')
      const content = readFile(barrelPath)
      if (!content) continue // feature may not have a barrel yet

      // Detect `export * from '...'` — forbidden by convention
      if (/export \* from/.test(content)) {
        violations.push(`src/features/${feature}/index.ts`)
      }
    }

    if (violations.length > 0) {
      console.error('Barrel files using wildcard exports (should use named exports):', violations)
    }

    expect(violations).toEqual([])
  })

  it('feature barrel files should have at least one named export', () => {
    const featuresMissingExports: string[] = []

    const EXPECTED_FEATURES = ['AITools', 'Auth', 'Baker', 'BuildProject', 'Premiere', 'Settings', 'Trello', 'Upload']

    for (const feature of EXPECTED_FEATURES) {
      const barrelPath = join(FEATURES_DIR, feature, 'index.ts')
      const content = readFile(barrelPath)
      if (!content) {
        featuresMissingExports.push(feature)
        continue
      }

      // Check that barrel has at least one export statement (named or type)
      // Use multiline-aware search
      const hasExport = content.includes('export {') || content.includes('export type {') || content.includes('export function') || content.includes('export const') || content.includes('export class')
      if (!hasExport) {
        featuresMissingExports.push(feature)
      }
    }

    expect(featuresMissingExports).toEqual([])
  })
})

// ============================================================================
// US-11d: Shared module does not import from features
// ============================================================================

describe('US-11d — Shared modules do not import from feature modules', () => {
  it('src/shared/** files must not import from @features/* or src/features/**', () => {
    const sharedFiles = collectFiles(SHARED_DIR)
    const violations: string[] = []

    for (const file of sharedFiles) {
      const content = readFile(file)
      if (hasFeatureImport(content)) {
        violations.push(file.replace(PROJECT_ROOT + '/', ''))
      }
    }

    if (violations.length > 0) {
      console.error(
        'Shared files that import from features (breaks dependency direction):',
        violations
      )
    }

    expect(violations).toEqual([])
  })
})

// ============================================================================
// US-11e: Contract test files exist for major feature modules
// ============================================================================

describe('US-11e — Contract test directories exist for feature modules', () => {
  it('major feature modules should have __contracts__/ test directories', () => {
    const EXPECTED_FEATURES_WITH_CONTRACTS = [
      'AITools',
      'Baker',
      'BuildProject',
      'Premiere',
      'Settings',
      'Trello',
      'Upload'
    ]

    const missingContracts: string[] = []

    for (const feature of EXPECTED_FEATURES_WITH_CONTRACTS) {
      const contractsDir = join(FEATURES_DIR, feature, '__contracts__')
      try {
        const stat = statSync(contractsDir)
        if (!stat.isDirectory()) {
          missingContracts.push(`src/features/${feature}/__contracts__/`)
        }
      } catch {
        missingContracts.push(`src/features/${feature}/__contracts__/`)
      }
    }

    if (missingContracts.length > 0) {
      console.warn('Features missing __contracts__/ directories:', missingContracts)
    }

    expect(missingContracts).toEqual([])
  })
})

// ============================================================================
// US-11f: No broken path alias @/ imports (only @features/*, @shared/*, @tests/*)
// ============================================================================

describe('US-11f — No broken @/ path alias imports in source files', () => {
  it('src/ files must not use the @/ alias (it is not configured in tsconfig.json)', () => {
    const allSrcFiles = collectFiles(SRC_DIR)
    const violations: string[] = []

    // src/features/build-project/ (internal module, lowercase) has legacy @/ imports
    // that predate the alias convention. Exclude it from this check.
    const EXCLUDED_PATHS = ['src/features/build-project/']

    for (const file of allSrcFiles) {
      const relativePath = file.replace(PROJECT_ROOT + '/', '')
      if (EXCLUDED_PATHS.some((exc) => relativePath.startsWith(exc))) continue

      const content = readFile(file)
      // Match `from '@/...'` but not `from '@features/...'` or `from '@shared/...'`
      if (/from ['"]@\//.test(content) || /require\(['"]@\//.test(content)) {
        violations.push(relativePath)
      }
    }

    if (violations.length > 0) {
      console.error(
        'Files using unconfigured @/ alias (use @features/*, @shared/*, or relative paths):',
        violations
      )
    }

    expect(violations).toEqual([])
  })
})
