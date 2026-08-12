/**
 * Quality Control contract tests (issue #180)
 *
 * Thin by design, per CLAUDE.md: these guard the module boundary, not the
 * feature. Each one fails only if another module would break.
 *
 * Named exports are asserted individually and no total export count is asserted,
 * so adding a legitimate export never fails a test.
 */

import fs from 'node:fs'
import path from 'node:path'

import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it } from 'vitest'

const FEATURE_DIR = path.resolve(__dirname, '..')

describe('QualityControl barrel shape', () => {
  it('exports the page other modules route to', async () => {
    const barrel = await import('../index')

    expect(barrel.QualityControlPage).toBeDefined()
  })

  it('exports the availability hook the page and Settings both consume', async () => {
    const barrel = await import('../index')

    expect(typeof barrel.useQcAvailability).toBe('function')
  })

  it('does not leak internal helpers through the barrel', async () => {
    const barrel = (await import('../index')) as Record<string, unknown>

    // These are implementation detail. Exporting them would invite other modules
    // to depend on the matching internals rather than the module's API.
    expect(barrel.resolveQcAvailability).toBeUndefined()
    expect(barrel.resolveReferencePoolState).toBeUndefined()
    expect(barrel.filterReferenceImages).toBeUndefined()
  })
})

describe('QualityControl I/O boundary', () => {
  afterEach(() => clearMocks())

  /** Records what api.ts actually sends over the IPC boundary. */
  function captureInvokes() {
    const calls: Array<{ cmd: string; args: unknown }> = []
    mockIPC((cmd, args) => {
      calls.push({ cmd, args })
      return { status: 'ready', ffmpeg: 'a', ffprobe: 'b' }
    })
    return calls
  }

  it('routes ffmpeg discovery through the qc_detect_ffmpeg command', async () => {
    const calls = captureInvokes()
    const { detectFfmpeg } = await import('../api')

    await detectFfmpeg('/custom/tools')

    expect(calls).toHaveLength(1)
    expect(calls[0].cmd).toBe('qc_detect_ffmpeg')
    expect(calls[0].args).toMatchObject({ customDir: '/custom/tools' })
  })

  it('passes null rather than undefined when no directory is configured', async () => {
    const calls = captureInvokes()
    const { detectFfmpeg } = await import('../api')

    await detectFfmpeg()

    // An undefined value would be dropped from the payload entirely, and the
    // Rust side would see a missing argument rather than an explicit "no
    // custom directory".
    expect(calls[0].args).toMatchObject({ customDir: null })
  })
})

describe('QualityControl no-bypass', () => {
  it('imports Tauri only in api.ts', () => {
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.tsx?$/.test(entry.name)) continue
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
        // By basename, so renaming the I/O module cannot silently turn it into
        // a false positive against itself.
        if (entry.name === 'api.ts') continue

        // Both quote styles and dynamic imports: a static-import-only regex
        // would wave through `await import("@tauri-apps/...")`, which bypasses
        // the boundary just as completely.
        if (
          /(?:from|import\s*\()\s*["']@tauri-apps\//.test(fs.readFileSync(full, 'utf8'))
        ) {
          offenders.push(path.relative(FEATURE_DIR, full))
        }
      }
    }

    walk(FEATURE_DIR)

    expect(offenders).toEqual([])
  })
})
