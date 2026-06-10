/**
 * BuildProject Contract Tests
 *
 * Verifies the shape and behavior of the (legacy) BuildProject feature
 * module's barrel exports. After the @features/build-project migration this
 * module exists only to host:
 *   - the page component still wired at /build (`BuildProjectPage.tsx`),
 *   - page-state helper hooks (`useProjectState`, `useCameraAutoRemap`,
 *     `useFileSelector`, `useVideoInfoBlock`) the page composes against the
 *     new module's hook,
 *   - data types still imported by Trello + Baker (`FootageFile`, `VideoInfoData`),
 *   - the I/O wrappers that the page (and some siblings) still call
 *     (`copyPremiereProject`, `showConfirmationDialog`, dialogs, plugin-fs
 *     helpers — minus the deleted `move_files` / `copy_progress` event
 *     plumbing).
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
    // Hook (consumed by Trello module)
    'useVideoInfoBlock'
  ].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    // Filter out type-only exports (not visible at runtime)
    const exportNames = Object.keys(buildProjectBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('exports exactly 2 runtime members', () => {
    expect(Object.keys(buildProjectBarrel)).toHaveLength(2)
  })

  it('exports BuildProjectPage as a function (React component)', () => {
    expect(typeof buildProjectBarrel.BuildProjectPage).toBe('function')
  })

  it('exports useVideoInfoBlock as a function', () => {
    expect(typeof buildProjectBarrel.useVideoInfoBlock).toBe('function')
  })

  it('does NOT export internal hooks', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('useProjectState')
    expect(exportNames).not.toContain('useFileSelector')
    expect(exportNames).not.toContain('useCameraAutoRemap')
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
    // Tauri Commands (3)
    'getFolderSize',
    'copyPremiereProject',
    'showConfirmationDialog',
    // Dialog (3)
    'openFileDialog',
    'openFolderDialog',
    'confirmDialog',
    // File System (3)
    'createDirectory',
    'pathExists',
    'writeTextFileContents'
  ].sort()

  it('exports exactly the expected I/O wrapper functions', () => {
    const exportNames = Object.keys(buildProjectApi).sort()
    expect(exportNames).toEqual(expectedApiExports)
  })

  it('exports exactly 9 members', () => {
    expect(Object.keys(buildProjectApi)).toHaveLength(9)
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

  it('hooks/ directory has zero direct @tauri-apps imports', () => {
    const hooksDir = path.join(modulePath, 'hooks')
    const files = getFilesRecursive(hooksDir, ['.ts', '.tsx'])
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
      expect(tauriImports).toEqual([])
    }
  })

  it('components/ directory has zero direct @tauri-apps imports', () => {
    const componentsDir = path.join(modulePath, 'components')
    const files = getFilesRecursive(componentsDir, ['.ts', '.tsx'])
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
      expect(tauriImports).toEqual([])
    }
  })

  it('BuildProjectPage has zero direct @tauri-apps imports', () => {
    const pageFile = path.join(modulePath, 'BuildProjectPage.tsx')
    const content = fs.readFileSync(pageFile, 'utf-8')
    const lines = content.split('\n')
    const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
    expect(tauriImports).toEqual([])
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
