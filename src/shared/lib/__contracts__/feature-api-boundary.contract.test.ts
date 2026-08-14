/**
 * Every feature module has an api.ts, and nothing else in it touches Tauri
 * (issues #178, #208)
 *
 * The rule that all feature I/O goes through the module's own `api.ts` was
 * enforced by nine hand-written per-module contract tests, one per feature. A
 * registry that has to be updated by hand exempts whatever nobody added to it,
 * and one module was exempt for its whole life: `src/features/build-project` had
 * no api.ts and imported `@tauri-apps` directly from four source files. It has
 * since been merged into `BuildProject/` with its I/O routed through api.ts.
 *
 * So this walks the filesystem instead of a list. A new feature module is
 * covered the moment its directory exists, with no change to this file.
 *
 * The exception sets below are asserted in BOTH directions: the tests fail if a
 * new violator appears, and equally if a listed violator has been fixed but not
 * delisted. A one-directional skip rots into a permanent hole. Both sets are now
 * empty — every feature module has an api.ts and none reaches Tauri around it.
 */
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../../..')
const FEATURES_DIR = join(REPO_ROOT, 'src/features')

/**
 * Modules with no api.ts yet. Empty, and it should stay that way: a new feature
 * module gets its I/O boundary before it gets a second file. If you are about to
 * add an entry here, add the api.ts instead.
 */
const WITHOUT_API_BOUNDARY = new Set<string>([])

/**
 * Modules that still import `@tauri-apps` outside their api.ts. Empty. Adding an
 * entry exempts a whole module from the repo's central architectural rule, which
 * is how `build-project` stayed exempt for its entire life (#208).
 */
const WITH_DIRECT_TAURI_IMPORTS = new Set<string>([])

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

/** The matcher itself, over any list of files. Shared with the fixture below. */
function filesWithTauriImport(files: string[]): string[] {
  return files.filter((file) => TAURI_IMPORT.test(readFileSync(file, 'utf8')))
}

function directTauriImports(module: string): string[] {
  return filesWithTauriImport(featureSourceFiles(module)).map((file) =>
    relative(REPO_ROOT, file)
  )
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
  })

  it('matches a real @tauri-apps import, in every form (guards a vacuous pass)', () => {
    // This used to assert that `build-project` had a stray import, which meant
    // fixing the module broke the guard (#207, #208). The pattern is proved
    // against a fixture instead, so it depends on no module being broken.
    const dir = mkdtempSync(join(tmpdir(), 'feature-api-boundary-'))
    const write = (name: string, source: string) => {
      const file = join(dir, name)
      writeFileSync(file, source)
      return file
    }

    try {
      const staticImport = write(
        'static.ts',
        "import { invoke } from '@tauri-apps/api/core'\n"
      )
      const typeImport = write(
        'type.ts',
        "import type { Event } from '@tauri-apps/api/event'\n"
      )
      const dynamicImport = write('dynamic.ts', "await import('@tauri-apps/plugin-fs')\n")
      const throughApi = write('clean.ts', "import { pathExists } from './api'\n")

      expect(filesWithTauriImport([staticImport, typeImport, dynamicImport])).toEqual([
        staticImport,
        typeImport,
        dynamicImport
      ])
      expect(filesWithTauriImport([throughApi])).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
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
