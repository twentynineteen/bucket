/**
 * Export bundle tests (issue #337)
 *
 * M5.1: Atomic folder creation under Graphics/Motion.
 * M5.2: Collision suffix when folder already exists.
 * M5.3: Temp folder is removed on error.
 * M5.4: Folder contents are correct for selected targets.
 * M2.6 (export part): Image param copies source.png, params.json has relative path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beginBundle,
  commitBundle,
  exportBundle,
  type ExportBundleApi,
  type ExportBundleInput
} from './exportBundle'

function mockApi(overrides?: Partial<ExportBundleApi>): ExportBundleApi {
  return {
    joinPath: vi.fn(async (...parts: string[]) => parts.join('/')),
    makeDir: vi.fn(async () => {}),
    writeText: vi.fn(async () => {}),
    writeBytes: vi.fn(async () => {}),
    renamePath: vi.fn(async () => {}),
    removeDirRecursive: vi.fn(async () => {}),
    pathExists: vi.fn(async () => false),
    copyFileTo: vi.fn(async () => {}),
    ...overrides
  }
}

function baseInput(overrides?: Partial<ExportBundleInput>): ExportBundleInput {
  return {
    projectFolder: '/p',
    templateId: 'lower-third-glide',
    slug: 'jane-doe',
    files: [
      { name: 'lower-third-glide.jsx', kind: 'text', contents: '// ae script' },
      {
        name: 'lower-third-glide-prompt.md',
        kind: 'text',
        contents: '# Prompt'
      },
      { name: 'README.md', kind: 'text', contents: '# README' }
    ],
    values: { name: 'Jane Doe' },
    format: { width: 1920, height: 1080, fps: 25 },
    targets: ['ae', 'prompt'],
    templateVersion: '1.0.0',
    ...overrides
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportBundle', () => {
  it('M5.1 - creates Graphics/Motion, writes to temp folder, renames to final', async () => {
    const api = mockApi()

    const result = await exportBundle(baseInput(), api)

    // Graphics/Motion should be created
    expect(api.makeDir).toHaveBeenCalledWith('/p/Graphics/Motion')

    // Files should be written to a temp folder
    const writeCalls = (api.writeText as ReturnType<typeof vi.fn>).mock.calls
    expect(writeCalls.length).toBeGreaterThan(0)
    // Every write path should start with the temp folder pattern
    for (const [path] of writeCalls) {
      expect(path).toMatch(/\/p\/Graphics\/Motion\/\.tmp-lower-third-glide-/)
    }

    // Final rename should happen
    expect(api.renamePath).toHaveBeenCalledTimes(1)
    const [from, to] = (api.renamePath as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(from).toMatch(/\.tmp-lower-third-glide-/)
    expect(to).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe')

    expect(result.finalFolder).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe')
  })

  it('M5.2 - adds collision suffix when folder already exists', async () => {
    const api = mockApi({
      pathExists: vi.fn(async (path: string) => {
        if (path === '/p/Graphics/Motion/lower-third-glide-jane-doe') return true
        if (path === '/p/Graphics/Motion/lower-third-glide-jane-doe-2') return true
        return false
      })
    })

    const result = await exportBundle(baseInput(), api)

    expect(result.finalFolder).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe-3')
  })

  it('M5.3 - removes temp folder on write failure', async () => {
    let writeCount = 0
    const api = mockApi({
      writeText: vi.fn(async () => {
        writeCount++
        if (writeCount === 3) throw new Error('disk full')
      })
    })

    await expect(exportBundle(baseInput(), api)).rejects.toThrow('disk full')

    // Temp folder should be removed on error
    expect(api.removeDirRecursive).toHaveBeenCalledTimes(1)
    const removedPath = (api.removeDirRecursive as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(removedPath).toMatch(/\.tmp-lower-third-glide-/)
  })

  it('M5.4 - writes correct file set and params.json with schema version', async () => {
    const api = mockApi()

    await exportBundle(baseInput(), api)

    const writeCalls = (api.writeText as ReturnType<typeof vi.fn>).mock.calls
    const writtenNames = writeCalls.map(([path]: [string]) => path.split('/').pop())

    expect(writtenNames).toContain('lower-third-glide.jsx')
    expect(writtenNames).toContain('lower-third-glide-prompt.md')
    expect(writtenNames).toContain('README.md')
    expect(writtenNames).toContain('params.json')

    // Check params.json content
    const paramsCall = writeCalls.find(([path]: [string]) => path.endsWith('params.json'))
    expect(paramsCall).toBeDefined()
    const paramsJson = JSON.parse(paramsCall![1] as string)
    expect(paramsJson.templateId).toBe('lower-third-glide')
    expect(paramsJson.templateVersion).toBe('1.0.0')
    expect(paramsJson.schemaVersion).toBe(1)
    expect(paramsJson.values).toEqual({ name: 'Jane Doe' })
    expect(paramsJson.format).toEqual({ width: 1920, height: 1080, fps: 25 })
    expect(paramsJson.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('M2.6 export - copies picked image as source.png, params.json has relative path', async () => {
    const api = mockApi()
    const input = baseInput({
      pickedImagePath: '/Users/e/runner.png',
      values: { name: 'Jane Doe', image: { pickedPath: '/Users/e/runner.png' } }
    })

    await exportBundle(input, api)

    // Source image should be copied
    expect(api.copyFileTo).toHaveBeenCalledTimes(1)
    const [from, to] = (api.copyFileTo as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(from).toBe('/Users/e/runner.png')
    expect(to).toMatch(/source\.png$/)

    // params.json should have the image as "source.png" (relative), not absolute
    const writeCalls = (api.writeText as ReturnType<typeof vi.fn>).mock.calls
    const paramsCall = writeCalls.find(([path]: [string]) => path.endsWith('params.json'))
    const paramsJson = JSON.parse(paramsCall![1] as string)
    // The image value in params.json should reference source.png, not an absolute path
    expect(JSON.stringify(paramsJson)).not.toContain('/Users/e/runner.png')
    expect(JSON.stringify(paramsJson.values)).toContain('source.png')
  })

  it('S1 - beginBundle creates temp dir and returns its path', async () => {
    const api = mockApi()

    const { tmpDir } = await beginBundle(baseInput(), api)

    // Graphics/Motion should be created
    expect(api.makeDir).toHaveBeenCalledWith('/p/Graphics/Motion')
    // Temp dir should be inside Graphics/Motion with the template id
    expect(tmpDir).toMatch(/\/p\/Graphics\/Motion\/\.tmp-lower-third-glide-/)
    // Temp dir itself should also be created
    const makeDirCalls = (api.makeDir as ReturnType<typeof vi.fn>).mock.calls
    const tmpDirCreated = makeDirCalls.some(([path]: [string]) => path === tmpDir)
    expect(tmpDirCreated).toBe(true)
  })

  it('S1 - commitBundle writes files and renames from provided tmpDir', async () => {
    const api = mockApi()
    const tmpDir = '/p/Graphics/Motion/.tmp-lower-third-glide-abc123'

    const result = await commitBundle(baseInput(), api, tmpDir)

    // Files should be written to the provided temp dir
    const writeCalls = (api.writeText as ReturnType<typeof vi.fn>).mock.calls
    for (const [path] of writeCalls) {
      expect(path).toContain(tmpDir)
    }

    // Rename from tmpDir to final
    expect(api.renamePath).toHaveBeenCalledTimes(1)
    const [from, to] = (api.renamePath as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(from).toBe(tmpDir)
    expect(to).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe')

    expect(result.finalFolder).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe')
  })

  it('S1 - commitBundle removes tmpDir on error', async () => {
    let writeCount = 0
    const api = mockApi({
      writeText: vi.fn(async () => {
        writeCount++
        if (writeCount === 2) throw new Error('disk full')
      })
    })
    const tmpDir = '/p/Graphics/Motion/.tmp-lower-third-glide-abc123'

    await expect(commitBundle(baseInput(), api, tmpDir)).rejects.toThrow('disk full')

    expect(api.removeDirRecursive).toHaveBeenCalledWith(tmpDir)
  })

  it('M5.4 - writes binary files correctly', async () => {
    const api = mockApi()
    const binaryFile = {
      name: 'lower-third-glide.mov',
      kind: 'binary' as const,
      bytes: new Uint8Array([0, 1, 2, 3])
    }

    await exportBundle(
      baseInput({
        files: [...baseInput().files, binaryFile],
        targets: ['ae', 'prompt', 'video']
      }),
      api
    )

    expect(api.writeBytes).toHaveBeenCalledTimes(1)
    const [path, bytes] = (api.writeBytes as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toMatch(/lower-third-glide\.mov$/)
    expect(bytes).toEqual(new Uint8Array([0, 1, 2, 3]))
  })
})
