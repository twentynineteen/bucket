/**
 * Breadcrumbs contract tests (issue #303)
 *
 * Thin by design, per CODING_STANDARDS.md: these guard the module boundary that
 * Baker, Trello and BuildProject will import, not the file rules behind it
 * (those are tested in Rust, in `src-tauri/src/breadcrumbs/tests.rs`).
 */

import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it } from 'vitest'

describe('Breadcrumbs barrel shape', () => {
  it('exports the three operations other modules call', async () => {
    const barrel = await import('../index')

    expect(typeof barrel.readBreadcrumbs).toBe('function')
    expect(typeof barrel.applyBreadcrumbsChange).toBe('function')
    expect(typeof barrel.previewBreadcrumbsChange).toBe('function')
  })

  it('exports the limits the Rust module enforces, so the UI holds no copy', async () => {
    const barrel = await import('../index')

    expect(barrel.MAX_VIDEO_LINKS).toBe(20)
    expect(barrel.MAX_TRELLO_CARDS).toBe(50)
  })
})

describe('Breadcrumbs I/O boundary', () => {
  afterEach(() => clearMocks())

  /** Records what api.ts sends over the IPC boundary. */
  function captureInvokes(reply: unknown) {
    const calls: Array<{ cmd: string; args: unknown }> = []
    mockIPC((cmd, args) => {
      calls.push({ cmd, args })
      return reply
    })
    return calls
  }

  it('reads a project by its folder path', async () => {
    const calls = captureInvokes({ kind: 'missing' })
    const { readBreadcrumbs } = await import('../index')

    await expect(readBreadcrumbs('/Volumes/X/Proj')).resolves.toEqual({ kind: 'missing' })
    expect(calls).toEqual([
      { cmd: 'breadcrumbs_read', args: { projectPath: '/Volumes/X/Proj' } }
    ])
  })

  it('applies a named change to a list of project folders', async () => {
    const calls = captureInvokes([])
    const { applyBreadcrumbsChange } = await import('../index')

    await applyBreadcrumbsChange(['/a', '/b'], { kind: 'rescan' })

    expect(calls).toEqual([
      {
        cmd: 'breadcrumbs_apply',
        args: { projectPaths: ['/a', '/b'], change: { kind: 'rescan' } }
      }
    ])
  })

  it('previews a named change without a separate write path', async () => {
    const calls = captureInvokes([])
    const { previewBreadcrumbsChange } = await import('../index')

    await previewBreadcrumbsChange(['/a'], { kind: 'refreshSizes' })

    expect(calls).toEqual([
      {
        cmd: 'breadcrumbs_preview',
        args: { projectPaths: ['/a'], change: { kind: 'refreshSizes' } }
      }
    ])
  })
})
