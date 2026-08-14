/**
 * BuildProject Contract Tests
 *
 * Verifies the shape and behaviour of the BuildProject feature module's barrel
 * exports. The module holds the whole feature: the page wired at /build, its
 * page-state helper hooks, the XState machine and its stage functions, the
 * workflow types, and the `api.ts` every one of them reaches Tauri through.
 *
 * `src/features/build-project` was a second top-level module holding the
 * machine, stages and types. It was merged in here (#208); the invariants its
 * own contract test carried are folded in below.
 *
 * These tests lock down the public API and the no-direct-Tauri-import
 * boundary so downstream callers can rely on a stable surface.
 */

import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

import * as buildProjectBarrel from '../index'
import * as buildProjectApi from '../api'

// --- Shape Tests (Barrel Exports) ---

describe('BuildProject Barrel Exports - Shape', () => {
  const expectedExports = [
    // Page component
    'BuildProjectPage',
    // Workflow hook (the page's entry point into the machine)
    'useBuildProject',
    // Hook (consumed by Trello module)
    'useVideoInfoBlock',
    // Error surface consumers branch on
    'BuildProjectError',
    'ErrorKind',
    'getErrorKindDisplayName',
    'getUserFriendlyErrorMessage'
  ].sort()

  // Presence, not exhaustiveness: a caller breaks when a name it imports
  // disappears, never when a new one is added beside it.
  it('exports every documented named export', () => {
    // Filter out type-only exports (not visible at runtime)
    const exportNames = Object.keys(buildProjectBarrel).sort()
    expect(exportNames).toEqual(expect.arrayContaining(expectedExports))
  })

  it('exports BuildProjectPage as a function (React component)', () => {
    expect(typeof buildProjectBarrel.BuildProjectPage).toBe('function')
  })

  it('exports useVideoInfoBlock as a function', () => {
    expect(typeof buildProjectBarrel.useVideoInfoBlock).toBe('function')
  })

  it('exports useBuildProject as a function (React hook)', () => {
    expect(typeof buildProjectBarrel.useBuildProject).toBe('function')
  })

  it('BuildProjectError is a constructable class', () => {
    expect(typeof buildProjectBarrel.BuildProjectError).toBe('function')
    const err = new buildProjectBarrel.BuildProjectError(
      buildProjectBarrel.ErrorKind.IO,
      'validation',
      'msg',
      true
    )
    expect(err).toBeInstanceOf(buildProjectBarrel.BuildProjectError)
  })

  it('ErrorKind enum contains the categories consumers branch on', () => {
    // These specific kinds appear in error-mapping logic and the UI should be
    // able to distinguish them. Catching renames in this enum is the point.
    expect(buildProjectBarrel.ErrorKind.Validation).toBeDefined()
    expect(buildProjectBarrel.ErrorKind.IO).toBeDefined()
    expect(buildProjectBarrel.ErrorKind.Permission).toBeDefined()
    expect(buildProjectBarrel.ErrorKind.Timeout).toBeDefined()
    expect(buildProjectBarrel.ErrorKind.Cancelled).toBeDefined()
    expect(buildProjectBarrel.ErrorKind.NotFound).toBeDefined()
  })

  it('does NOT export internal hooks', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('useProjectState')
    expect(exportNames).not.toContain('useFileSelector')
    expect(exportNames).not.toContain('useCameraAutoRemap')
    expect(exportNames).not.toContain('useStageExecution')
  })

  it('does NOT leak the machine, the transfer actor or the stage functions', () => {
    // The machine owns the workflow; consumers drive it through
    // useBuildProject. Exporting these would let a caller bypass it.
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('buildProjectMachine')
    expect(exportNames).not.toContain('fileTransferActor')
    expect(exportNames).not.toContain('transferFiles')
    expect(exportNames).not.toContain('startTransfer')
    expect(exportNames).not.toContain('cancelTransfer')
    expect(exportNames).not.toContain('createTransferItems')
    expect(exportNames).not.toContain('validateInput')
    expect(exportNames).not.toContain('createFolders')
    expect(exportNames).not.toContain('copyTemplate')
    expect(exportNames).not.toContain('saveBreadcrumbs')
  })

  it('does NOT export api layer functions directly', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('getFolderSize')
    expect(exportNames).not.toContain('openFileDialog')
    expect(exportNames).not.toContain('copyPremiereProject')
    expect(exportNames).not.toContain('showConfirmationDialog')
  })

  it('does NOT export internal components', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('AddFootageStep')
    expect(exportNames).not.toContain('CreateProjectStep')
    expect(exportNames).not.toContain('ProjectConfigurationStep')
    expect(exportNames).not.toContain('ProjectFileList')
    expect(exportNames).not.toContain('ProgressBar')
    expect(exportNames).not.toContain('SuccessSection')
  })
})

// --- Shape Tests (api.ts Exports) ---

describe('BuildProject api.ts Exports - Shape', () => {
  // After Phase 5 cleanup: the legacy `move_files` Rust command and its
  // `copy_*` event listeners (`listenCopyProgress`, `listenCopyComplete`,
  // `listenCopyFileError`, `listenCopyCompleteWithErrors`) and the `moveFiles`
  // wrapper were all deleted. The path/remove helper was orphaned by the
  // simultaneous deletion of `useProjectValidation` and `useProjectFolders`.
  const expectedApiExports = [
    // Tauri Commands
    'getFolderSize',
    'copyPremiereProject',
    'showConfirmationDialog',
    'transferFilesWithProgress',
    'cancelFileTransfer',
    // Event Listeners
    'listenFileTransferProgress',
    'listenFileTransferComplete',
    // Dialog
    'openFileDialog',
    'openFolderDialog',
    'confirmDialog',
    // File System
    'createDirectory',
    'pathExists',
    'writeTextFileContents',
    'removePath'
  ].sort()

  it('exports every documented I/O wrapper function', () => {
    const exportNames = Object.keys(buildProjectApi).sort()
    expect(exportNames).toEqual(expect.arrayContaining(expectedApiExports))
  })

  for (const name of expectedApiExports) {
    it(`exports ${name} as a function`, () => {
      expect(typeof (buildProjectApi as Record<string, unknown>)[name]).toBe('function')
    })
  }

  it('does NOT re-introduce the deleted legacy IPC wrappers', () => {
    // The whole point of Phase 5 was to remove these; if a future change
    // reintroduces them, this test fails loudly. The `moveFiles` wrapper
    // invoked the broken un-throttled Rust command that hung on large
    // transfers; the `listenCopy*` helpers listened to its events.
    const exportNames = Object.keys(buildProjectApi)
    expect(exportNames).not.toContain('moveFiles')
    expect(exportNames).not.toContain('listenCopyProgress')
    expect(exportNames).not.toContain('listenCopyComplete')
    expect(exportNames).not.toContain('listenCopyFileError')
    expect(exportNames).not.toContain('listenCopyCompleteWithErrors')
  })
})

// --- No-Bypass Tests ---

describe('BuildProject Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/BuildProject')

  function getFilesRecursive(dir: string, extensions: string[]): string[] {
    const files: string[] = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
        files.push(...getFilesRecursive(fullPath, extensions))
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
    return files
  }

  /**
   * Walks the whole module rather than a hand-listed set of directories. The
   * previous version named hooks/, components/ and the page, which is why the
   * machine/ and stages/ directories that #208 merged in here could import
   * Tauri directly for their whole life without a test noticing. A new
   * subdirectory is covered the moment it exists.
   */
  it('no file outside api.ts imports @tauri-apps directly', () => {
    const offenders: string[] = []
    for (const file of getFilesRecursive(modulePath, ['.ts', '.tsx'])) {
      if (file === path.join(modulePath, 'api.ts')) continue
      if (/\.test\.tsx?$/.test(file)) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (/(?:from\s*|import\s*\(\s*)['"]@tauri-apps\//.test(content)) {
        offenders.push(path.relative(projectRoot, file))
      }
    }
    expect(
      offenders,
      'Route Tauri calls through BuildProject/api.ts rather than importing @tauri-apps here.'
    ).toEqual([])
  })

  it('finds the module source (guards a vacuous pass)', () => {
    // Without this, a wrong modulePath would make the assertion above pass by
    // scanning nothing at all.
    const files = getFilesRecursive(modulePath, ['.ts', '.tsx'])
    expect(files.length).toBeGreaterThan(15)
    expect(files).toContain(path.join(modulePath, 'machine/buildProjectMachine.ts'))
    expect(files).toContain(path.join(modulePath, 'stages/fileTransfer.ts'))
  })
})

// --- No-Bypass: Legacy IPC Names Must Not Reappear ---

describe('BuildProject Module - no legacy IPC names', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/BuildProject')

  /** Walk .ts/.tsx files in the module, skipping tests and contract dirs. */
  function getProductionFiles(): string[] {
    const collected: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
          walk(full)
          continue
        }
        if (/\.test\.tsx?$/.test(entry.name)) continue
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          collected.push(full)
        }
      }
    }
    walk(modulePath)
    return collected
  }

  // `move_files` and its `copy_progress` / `copy_complete` events were the
  // un-throttled IPC path that hung on large transfers (#112). The Rust command
  // is gone, so a reference here means the transfer is wired to nothing.
  for (const legacyName of ['move_files', 'copy_progress', 'copy_complete']) {
    it(`contains no references to the deleted \`${legacyName}\``, () => {
      const offenders = getProductionFiles()
        .filter((file) => fs.readFileSync(file, 'utf-8').includes(legacyName))
        .map((file) => path.relative(projectRoot, file))
      expect(offenders).toEqual([])
    })
  }
})

// --- Module Layout: Load-Bearing File Locations ---

describe('BuildProject Module - file layout invariants', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/BuildProject')

  it('has the XState machine at machine/buildProjectMachine.ts', () => {
    expect(fs.existsSync(path.join(modulePath, 'machine/buildProjectMachine.ts'))).toBe(
      true
    )
  })

  it('has the throttled transfer stage at stages/fileTransfer.ts', () => {
    expect(fs.existsSync(path.join(modulePath, 'stages/fileTransfer.ts'))).toBe(true)
  })

  it('has its single I/O boundary at api.ts', () => {
    expect(fs.existsSync(path.join(modulePath, 'api.ts'))).toBe(true)
  })

  it('is the only BuildProject feature module', () => {
    // src/features/build-project held the machine, stages and types under a
    // second top-level module with different casing (#208). Recreating it would
    // put the feature back beyond the reach of this module's own guards.
    expect(fs.existsSync(path.resolve(projectRoot, 'src/features/build-project'))).toBe(
      false
    )
  })

  it('does NOT contain the deleted useFileTransfer hook', () => {
    // useFileTransfer.ts was a redundant pre-migration hook that still invoked
    // the broken move_files command. It is intentionally removed; if anything
    // re-creates this file, that is almost certainly a mistake.
    expect(fs.existsSync(path.join(modulePath, 'hooks/useFileTransfer.ts'))).toBe(false)
  })
})

// --- Phase 5 Cleanup Invariants ---

describe('BuildProject Module - Legacy Files Removed', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/BuildProject')

  // These files were the engine of the legacy un-throttled IPC path that
  // hung on large file transfers. They are intentionally deleted; if any
  // future change recreates them under the legacy module, that almost
  // certainly means the new path has been bypassed.
  const deletedLegacyFiles = [
    'buildProjectMachine.ts',
    'hooks/useBuildProjectMachine.ts',
    'hooks/useCreateProjectWithMachine.ts',
    'hooks/usePostProjectCompletion.ts',
    'hooks/useFileOperations.ts',
    'hooks/useProjectValidation.ts',
    'hooks/useProjectFolders.ts'
  ]

  for (const relPath of deletedLegacyFiles) {
    it(`legacy file is removed: ${relPath}`, () => {
      const fullPath = path.join(modulePath, relPath)
      expect(fs.existsSync(fullPath)).toBe(false)
    })
  }

  it('src/machines/ directory does not exist', () => {
    const machinesDir = path.resolve(projectRoot, 'src/machines')
    expect(fs.existsSync(machinesDir)).toBe(false)
  })
})
