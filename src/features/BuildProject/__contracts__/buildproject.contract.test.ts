/**
 * BuildProject Contract Tests
 *
 * Verifies the shape and behavior of the BuildProject feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
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
    expect(exportNames).not.toContain('useBuildProjectMachine')
    expect(exportNames).not.toContain('useProjectState')
    expect(exportNames).not.toContain('useCreateProjectWithMachine')
    expect(exportNames).not.toContain('useFileSelector')
    expect(exportNames).not.toContain('useCameraAutoRemap')
    expect(exportNames).not.toContain('useFileOperations')
    expect(exportNames).not.toContain('useProjectValidation')
    expect(exportNames).not.toContain('useProjectFolders')
    expect(exportNames).not.toContain('usePostProjectCompletion')
  })

  it('does NOT export the state machine directly', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('buildProjectMachine')
  })

  it('does NOT export api layer functions directly', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('moveFiles')
    expect(exportNames).not.toContain('getFolderSize')
    expect(exportNames).not.toContain('openFileDialog')
    expect(exportNames).not.toContain('listenCopyProgress')
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
  const expectedApiExports = [
    // Tauri Commands (4)
    'moveFiles',
    'getFolderSize',
    'copyPremiereProject',
    'showConfirmationDialog',
    // Event Listeners (4)
    'listenCopyProgress',
    'listenCopyComplete',
    'listenCopyFileError',
    'listenCopyCompleteWithErrors',
    // Dialog (3)
    'openFileDialog',
    'openFolderDialog',
    'confirmDialog',
    // File System (4)
    'createDirectory',
    'pathExists',
    'removePath',
    'writeTextFileContents'
  ].sort()

  it('exports exactly 15 I/O wrapper functions', () => {
    const exportNames = Object.keys(buildProjectApi).sort()
    expect(exportNames).toEqual(expectedApiExports)
  })

  it('exports exactly 15 members', () => {
    expect(Object.keys(buildProjectApi)).toHaveLength(15)
  })

  for (const name of expectedApiExports) {
    it(`exports ${name} as a function`, () => {
      expect(typeof (buildProjectApi as Record<string, unknown>)[name]).toBe('function')
    })
  }
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

  it('buildProjectMachine has zero direct @tauri-apps imports', () => {
    const machineFile = path.join(modulePath, 'buildProjectMachine.ts')
    const content = fs.readFileSync(machineFile, 'utf-8')
    const lines = content.split('\n')
    const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
    expect(tauriImports).toEqual([])
  })
})

// --- XState Colocation Test ---

describe('BuildProject Module - XState Machine Colocation', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')

  it('buildProjectMachine.ts exists at module root (not in hooks/ or components/)', () => {
    const moduleMachinePath = path.resolve(
      projectRoot,
      'src/features/BuildProject/buildProjectMachine.ts'
    )
    expect(fs.existsSync(moduleMachinePath)).toBe(true)
  })

  it('buildProjectMachine.ts does NOT exist at old src/machines/ location', () => {
    const oldMachinePath = path.resolve(
      projectRoot,
      'src/machines/buildProjectMachine.ts'
    )
    expect(fs.existsSync(oldMachinePath)).toBe(false)
  })

  it('src/machines/ directory does not exist', () => {
    const machinesDir = path.resolve(projectRoot, 'src/machines')
    expect(fs.existsSync(machinesDir)).toBe(false)
  })
})
