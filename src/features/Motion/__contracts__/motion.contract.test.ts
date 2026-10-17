/**
 * Motion contract tests (F4.1-F4.4)
 *
 * Guards the module boundary: barrel shape, no-bypass, IPC contracts and
 * file-write targets. Each test fails only if another module would break.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const FEATURE_DIR = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// F4.1 - barrel exports
// ---------------------------------------------------------------------------

describe('Motion barrel shape', () => {
  it('F4.1 exports loadMotionMarketplacePage (lazy loader)', async () => {
    const barrel = await import('../index')
    expect(barrel.loadMotionMarketplacePage).toBeDefined()
    expect(typeof barrel.loadMotionMarketplacePage).toBe('function')
  })

  it('F4.1 exports MotionSection', async () => {
    const barrel = await import('../index')
    expect(barrel.MotionSection).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// F4.2 - no-bypass
// ---------------------------------------------------------------------------

describe('Motion no-bypass', () => {
  it('F4.2 no source file except api.ts imports @tauri-apps or navigator.clipboard', () => {
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.tsx?$/.test(entry.name)) continue
        // Skip test files
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          continue
        }
        // The I/O boundary itself is allowed
        if (entry.name === 'api.ts') continue

        const source = fs.readFileSync(full, 'utf8')
        if (
          /(?:from|import\s*\()\s*["']@tauri-apps\//.test(source) ||
          /navigator\.clipboard/.test(source)
        ) {
          offenders.push(path.relative(FEATURE_DIR, full))
        }
      }
    }

    walk(FEATURE_DIR)
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// F4.3 - render IPC contracts
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('render-1')
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn())
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/mock/data'),
  join: vi.fn(async (...parts: string[]) => parts.join('/'))
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  readTextFile: vi.fn().mockResolvedValue('{}'),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readDir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ mtime: new Date(1_700_000_000_000) })
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn()
}))

vi.mock('@features/Upload', () => ({
  posterFrameFontPath: vi.fn(async () => '/mock/fonts/Cabrito.otf')
}))

describe('Motion IPC contracts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('F4.3 startRender invokes motion_render_start with { request }', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const api = await import('../api')
    const request = {
      outputPath: '/out/test.mov',
      width: 1920,
      height: 1080,
      fps: 25,
      totalFrames: 50,
      ffmpegDirectory: null
    }
    await api.startRender(request)
    expect(invoke).toHaveBeenCalledWith('motion_render_start', { request })
  })

  it('F4.3 finishRender invokes motion_render_finish with { renderId }', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const api = await import('../api')
    await api.finishRender('r1')
    expect(invoke).toHaveBeenCalledWith('motion_render_finish', {
      renderId: 'r1'
    })
  })

  it('F4.3 cancelRender invokes motion_render_cancel with { renderId }', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const api = await import('../api')
    await api.cancelRender('r1')
    expect(invoke).toHaveBeenCalledWith('motion_render_cancel', {
      renderId: 'r1'
    })
  })

  it('F4.3 sendRenderFrame passes bytes as second arg and render id in headers', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const api = await import('../api')
    const bytes = new Uint8Array([1, 2, 3])
    await api.sendRenderFrame('r1', bytes)
    expect(invoke).toHaveBeenCalledWith('motion_render_frame', bytes, {
      headers: { 'motion-render-id': 'r1' }
    })
  })
})

// ---------------------------------------------------------------------------
// F4.4 - writeMotionPrefsText targets motion_prefs.json, never api_keys.json
// ---------------------------------------------------------------------------

describe('Motion prefs file target', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('modifiedTimeMs reads the modified time through plugin-fs stat', async () => {
    const { stat } = await import('@tauri-apps/plugin-fs')
    vi.mocked(stat).mockResolvedValueOnce({
      mtime: new Date(1_700_000_000_000)
    } as Awaited<ReturnType<typeof stat>>)
    const api = await import('../api')
    await expect(api.modifiedTimeMs('/p/Graphics/Motion/.tmp-x')).resolves.toBe(
      1_700_000_000_000
    )
    expect(stat).toHaveBeenCalledWith('/p/Graphics/Motion/.tmp-x')
  })

  it('F4.4 writeMotionPrefsText writes to motion_prefs.json, not api_keys.json', async () => {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const api = await import('../api')
    await api.writeMotionPrefsText('{"test": true}')
    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const [writtenPath] = vi.mocked(writeTextFile).mock.calls[0]
    expect(writtenPath).toMatch(/motion_prefs\.json$/)
    expect(writtenPath).not.toMatch(/api_keys\.json/)
  })
})
