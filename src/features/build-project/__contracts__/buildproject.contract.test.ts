/**
 * build-project Contract Tests
 *
 * Locks down the public API surface of the @features/build-project module and
 * enforces the invariants this migration was designed to deliver:
 *
 * 1. Shape — the root barrel exports exactly the documented runtime API,
 *    no more, no less. Internal pieces (machine, actor, stages) stay private.
 *
 * 2. No-bypass — no production file in the module references the broken
 *    legacy commands (`move_files`) or legacy events (`copy_progress`,
 *    `copy_complete`). These names are the historical IPC-storm path; if any
 *    file ever re-introduces them, this test fails.
 *
 * 3. Module layout — the XState machine lives at machine/buildProjectMachine.ts
 *    and the throttled transfer logic lives in stages/fileTransfer.ts. These
 *    locations are load-bearing for the rest of the module.
 */

import * as fs from 'fs'
import * as path from 'path'

import { describe, expect, it } from 'vitest'

import * as buildProjectBarrel from '../index'

// ============================================================================
// Shape Tests — Root Barrel
// ============================================================================

describe('build-project barrel — runtime exports', () => {
  const expectedRuntimeExports = [
    'BuildProjectError',
    'ErrorKind',
    'getErrorKindDisplayName',
    'getUserFriendlyErrorMessage',
    'useBuildProject'
  ].sort()

  it('exports exactly the expected runtime members', () => {
    const actual = Object.keys(buildProjectBarrel).sort()
    expect(actual).toEqual(expectedRuntimeExports)
  })

  it('useBuildProject is a function (React hook)', () => {
    expect(typeof buildProjectBarrel.useBuildProject).toBe('function')
  })

  it('BuildProjectError is a class constructor', () => {
    expect(typeof buildProjectBarrel.BuildProjectError).toBe('function')
    // Constructable check
    const err = new buildProjectBarrel.BuildProjectError(
      buildProjectBarrel.ErrorKind.IO,
      'test',
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

  it('does NOT leak the XState machine to consumers', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    expect(exportNames).not.toContain('buildProjectMachine')
  })

  it('does NOT leak the file-transfer actor or stage functions to consumers', () => {
    const exportNames = Object.keys(buildProjectBarrel)
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

  it('does NOT leak internal helper hooks to consumers', () => {
    const exportNames = Object.keys(buildProjectBarrel)
    // useStageExecution is an implementation detail of stage orchestration.
    expect(exportNames).not.toContain('useStageExecution')
  })
})

// ============================================================================
// No-Bypass — Legacy IPC Names Must Not Appear in Production Code
// ============================================================================

describe('build-project module — no legacy IPC names', () => {
  const projectRoot = path.resolve(__dirname, '../../../..')
  const modulePath = path.resolve(projectRoot, 'src/features/build-project')

  /** Walk .ts/.tsx files in the module, skipping tests and contract dirs. */
  function getProductionFiles(): string[] {
    const collected: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (
            entry.name === '__tests__' ||
            entry.name === '__contracts__' ||
            entry.name === 'node_modules'
          ) {
            continue
          }
          walk(full)
          continue
        }
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          collected.push(full)
        }
      }
    }
    walk(modulePath)
    return collected
  }

  it('contains no references to the broken legacy `move_files` command', () => {
    const offenders: string[] = []
    for (const file of getProductionFiles()) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('move_files')) {
        offenders.push(path.relative(projectRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('contains no references to the unthrottled legacy `copy_progress` event', () => {
    const offenders: string[] = []
    for (const file of getProductionFiles()) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('copy_progress')) {
        offenders.push(path.relative(projectRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('contains no references to the legacy `copy_complete` event', () => {
    const offenders: string[] = []
    for (const file of getProductionFiles()) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('copy_complete')) {
        offenders.push(path.relative(projectRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

// ============================================================================
// Module Layout — Load-Bearing File Locations
// ============================================================================

describe('build-project module — file layout invariants', () => {
  const projectRoot = path.resolve(__dirname, '../../../..')
  const modulePath = path.resolve(projectRoot, 'src/features/build-project')

  it('has a root barrel at index.ts', () => {
    expect(fs.existsSync(path.join(modulePath, 'index.ts'))).toBe(true)
  })

  it('has the XState machine at machine/buildProjectMachine.ts', () => {
    expect(
      fs.existsSync(path.join(modulePath, 'machine/buildProjectMachine.ts'))
    ).toBe(true)
  })

  it('has the throttled transfer stage at stages/fileTransfer.ts', () => {
    expect(fs.existsSync(path.join(modulePath, 'stages/fileTransfer.ts'))).toBe(true)
  })

  it('does NOT contain the deleted useFileTransfer hook', () => {
    // useFileTransfer.ts was a redundant pre-migration hook that still invoked
    // the broken move_files command. It is intentionally removed; if anything
    // re-creates this file, that is almost certainly a mistake.
    expect(
      fs.existsSync(path.join(modulePath, 'hooks/useFileTransfer.ts'))
    ).toBe(false)
  })
})
