/**
 * Every feature module has an api.ts, and nothing else in it touches Tauri
 * (issues #178, #208)
 *
 * The rule that all feature I/O goes through the module's own `api.ts` was
 * enforced by nine hand-written per-module contract tests, one per feature. A
 * registry that has to be updated by hand exempts whatever nobody added to it,
 * and one module had been exempt for its whole life: `src/features/build-project`
 * has no api.ts and imports `@tauri-apps` directly from four source files.
 *
 * So this walks the filesystem instead of a list. A new feature module is
 * covered the moment its directory exists, with no change to this file.
 *
 * The known exceptions below are asserted in BOTH directions: the tests fail if
 * a new violator appears, and equally if a listed violator has been fixed but
 * not delisted. A one-directional skip rots into a permanent hole.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../../..')
const FEATURES_DIR = join(REPO_ROOT, 'src/features')

/**
 * Modules with no api.ts yet.
 *
 * `build-project` predates the convention and is tracked by #208, which cannot
 * land until the typecheck gate in #178 is in place because the move touches
 * 2,224 lines of test. **Delete the entry, not the assertion, when #208 lands** -
 * the second test below will tell you to.
 */
const WITHOUT_API_BOUNDARY = new Set(['build-project'])

/**
 * Modules that still import `@tauri-apps` outside their api.ts. Same story and
 * same instruction as above: tracked by #208, delete the entry when it lands.
 */
const WITH_DIRECT_TAURI_IMPORTS = new Set(['build-project'])

/** A direct dependency on Tauri: static import, type-only import, or dynamic. */
const TAURI_IMPORT = /(?:from\s*|import\s*\(\s*)['"]@tauri-apps\//

function featureModules(): string[] {
  return readdirSync(FEATURES_DIR)
    .filter((entry) => statSync(join(FEATURES_DIR, entry)).isDirectory())
    .sort()
}

/** Source files a feature owns, excluding its api.ts and all of its tests. */
function featureSourceFiles(module: string): string[] {
  const found: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__' || entry === '__contracts__') continue
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry)) continue
      if (/\.test\.tsx?$/.test(entry)) continue
      if (full === join(FEATURES_DIR, module, 'api.ts')) continue
      found.push(full)
    }
  }

  walk(join(FEATURES_DIR, module))
  return found
}

function hasApiBoundary(module: string): boolean {
  try {
    return statSync(join(FEATURES_DIR, module, 'api.ts')).isFile()
  } catch {
    return false
  }
}

function directTauriImports(module: string): string[] {
  const offenders: string[] = []
  for (const file of featureSourceFiles(module)) {
    if (TAURI_IMPORT.test(readFileSync(file, 'utf8'))) {
      offenders.push(relative(REPO_ROOT, file))
    }
  }
  return offenders
}

describe('feature modules keep their Tauri I/O behind api.ts', () => {
  const modules = featureModules()

  it('finds the feature modules and their source (guards a vacuous pass)', () => {
    // Without this, a broken path would make every assertion below pass by
    // scanning nothing at all.
    expect(modules).toContain('Baker')
    expect(modules).toContain('Upload')
    expect(modules.length).toBeGreaterThanOrEqual(9)
    expect(featureSourceFiles('Baker').length).toBeGreaterThan(10)

    // Proves the pattern still matches a real import. build-project is the only
    // module that has one to find, which is the whole point of #208.
    expect(directTauriImports('build-project').length).toBeGreaterThan(0)
  })

  it('every feature module has an api.ts', () => {
    const missing = modules
      .filter((module) => !WITHOUT_API_BOUNDARY.has(module))
      .filter((module) => !hasApiBoundary(module))

    expect(
      missing,
      'A feature module needs an api.ts as its single I/O boundary. See CLAUDE.md.'
    ).toEqual([])
  })

  it('the api.ts exception list names only modules that still lack one', () => {
    const nowCompliant = [...WITHOUT_API_BOUNDARY].filter(hasApiBoundary)

    expect(
      nowCompliant,
      'These modules now have an api.ts. Delete them from WITHOUT_API_BOUNDARY.'
    ).toEqual([])
  })

  it('no file outside api.ts imports @tauri-apps directly', () => {
    const violations = modules
      .filter((module) => !WITH_DIRECT_TAURI_IMPORTS.has(module))
      .flatMap(directTauriImports)

    expect(
      violations,
      'Route Tauri calls through the feature api.ts rather than importing @tauri-apps here.'
    ).toEqual([])
  })

  it('the import exception list names only modules that still have strays', () => {
    const nowClean = [...WITH_DIRECT_TAURI_IMPORTS].filter(
      (module) => directTauriImports(module).length === 0
    )

    expect(
      nowClean,
      'These modules no longer import @tauri-apps outside api.ts. Delete them from WITH_DIRECT_TAURI_IMPORTS.'
    ).toEqual([])
  })
})
