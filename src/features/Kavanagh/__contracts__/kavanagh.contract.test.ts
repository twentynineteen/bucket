/**
 * Kavanagh contract tests (issue #180)
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

describe('Kavanagh barrel shape', () => {
  it('exports the page other modules route to', async () => {
    const barrel = await import('../index')

    expect(barrel.KavanaghPage).toBeDefined()
  })

  it('exports the availability hook the page and Settings both consume', async () => {
    const barrel = await import('../index')

    expect(typeof barrel.useKavanaghAvailability).toBe('function')
  })

  it('exports the run hook the upload flow will consume in stage 4', async () => {
    const barrel = await import('../index')

    expect(typeof barrel.useKavanaghCheck).toBe('function')
  })

  it('does not leak internal helpers through the barrel', async () => {
    const barrel = (await import('../index')) as Record<string, unknown>

    // These are implementation detail. Exporting them would invite other modules
    // to depend on the matching internals rather than the module's API.
    expect(barrel.resolveKavanaghAvailability).toBeUndefined()
    expect(barrel.resolveReferencePoolState).toBeUndefined()
    expect(barrel.filterReferenceImages).toBeUndefined()
  })
})

describe('Kavanagh I/O boundary', () => {
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

  it('routes ffmpeg discovery through the kavanagh_detect_ffmpeg command', async () => {
    const calls = captureInvokes()
    const { detectFfmpeg } = await import('../api')

    await detectFfmpeg('/custom/tools')

    expect(calls).toHaveLength(1)
    expect(calls[0].cmd).toBe('kavanagh_detect_ffmpeg')
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

  it('routes a run through the kavanagh_run_check command, with both pools', async () => {
    const calls = captureInvokes()
    const { runKavanaghCheck } = await import('../api')

    await runKavanaghCheck({
      videoPath: '/Volumes/Renders/module.mp4',
      referenceFiles: ['/refs/Watermarks/right.png'],
      stingReferenceFiles: ['/refs/Stings/current.jpg'],
      ffmpegDirectory: null,
      matchThreshold: 0.92
    })

    expect(calls[0].cmd).toBe('kavanagh_run_check')
    // Both pools travel in one request: the tail has to run before the watermark
    // pass to tell it where to stop, so they cannot be two calls (D9).
    expect(calls[0].args).toMatchObject({
      request: {
        videoPath: '/Volumes/Renders/module.mp4',
        referenceFiles: ['/refs/Watermarks/right.png'],
        stingReferenceFiles: ['/refs/Stings/current.jpg'],
        ffmpegDirectory: null,
        matchThreshold: 0.92
      }
    })
  })

  it('sends a null threshold rather than omitting it, so the default applies', async () => {
    const calls = captureInvokes()
    const { runKavanaghCheck } = await import('../api')

    await runKavanaghCheck({
      videoPath: '/a.mp4',
      referenceFiles: ['/refs/right.png'],
      stingReferenceFiles: []
    })

    // An omitted key would arrive as a missing argument rather than an explicit
    // "no override", which is a different thing on the Rust side.
    expect(calls[0].args).toMatchObject({ request: { matchThreshold: null } })
  })

  it('routes cancellation through the kavanagh_cancel_run command', async () => {
    const calls = captureInvokes()
    const { cancelKavanaghRun } = await import('../api')

    await cancelKavanaghRun()

    expect(calls[0].cmd).toBe('kavanagh_cancel_run')
  })

  it('routes evidence saving through the kavanagh_save_evidence command', async () => {
    const calls = captureInvokes()
    const { saveKavanaghEvidence } = await import('../api')

    await saveKavanaghEvidence('/Volumes/Evidence', 'kavanagh-module', [
      { label: 'watermark-missing-12.0s', atSeconds: 12, jpeg: [255, 216] }
    ])

    expect(calls[0].cmd).toBe('kavanagh_save_evidence')
    expect(calls[0].args).toMatchObject({
      folder: '/Volumes/Evidence',
      prefix: 'kavanagh-module',
      items: [{ label: 'watermark-missing-12.0s', jpeg: [255, 216] }]
    })
  })
})

describe('Kavanagh no-bypass', () => {
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
