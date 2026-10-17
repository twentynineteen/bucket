/**
 * Export bundle tests (issue #337)
 *
 * Covers atomic folder creation, collision suffixes, temp-folder cleanup
 * on error, file-set correctness, image-param export and the stale
 * .tmp-* sweep in beginBundle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beginBundle,
  commitBundle,
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
    listFolder: vi.fn(async () => []),
    modifiedTimeMs: vi.fn(async () => Date.now()),
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
  it('creates Graphics/Motion, writes to temp folder, renames to final', async () => {
    const api = mockApi()

    const { tmpDir, motionDir } = await beginBundle(baseInput(), api)
    const result = await commitBundle(baseInput(), api, tmpDir, motionDir)

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

  it('adds collision suffix when folder already exists', async () => {
    const api = mockApi({
      pathExists: vi.fn(async (path: string) => {
        if (path === '/p/Graphics/Motion/lower-third-glide-jane-doe') return true
        if (path === '/p/Graphics/Motion/lower-third-glide-jane-doe-2') return true
        return false
      })
    })

    const { tmpDir, motionDir } = await beginBundle(baseInput(), api)
    const result = await commitBundle(baseInput(), api, tmpDir, motionDir)

    expect(result.finalFolder).toBe('/p/Graphics/Motion/lower-third-glide-jane-doe-3')
  })

  it('removes temp folder on write failure', async () => {
    let writeCount = 0
    const api = mockApi({
      writeText: vi.fn(async () => {
        writeCount++
        if (writeCount === 3) throw new Error('disk full')
      })
    })

    const { tmpDir, motionDir } = await beginBundle(baseInput(), api)
    await expect(commitBundle(baseInput(), api, tmpDir, motionDir)).rejects.toThrow(
      'disk full'
    )

    // Temp folder should be removed on error
    expect(api.removeDirRecursive).toHaveBeenCalledTimes(1)
    const removedPath = (api.removeDirRecursive as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(removedPath).toMatch(/\.tmp-lower-third-glide-/)
  })

  it('writes correct file set and params.json with schema version', async () => {
    const api = mockApi()

    const { tmpDir, motionDir } = await beginBundle(baseInput(), api)
    await commitBundle(baseInput(), api, tmpDir, motionDir)

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

  it('copies picked image as source.png, params.json has relative path', async () => {
    const api = mockApi()
    const input = baseInput({
      pickedImagePath: '/Users/e/runner.png',
      values: { name: 'Jane Doe', image: { pickedPath: '/Users/e/runner.png' } }
    })

    const { tmpDir, motionDir } = await beginBundle(input, api)
    await commitBundle(input, api, tmpDir, motionDir)

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

  it('beginBundle creates temp dir and returns its path and motionDir', async () => {
    const api = mockApi()

    const { tmpDir, motionDir } = await beginBundle(baseInput(), api)

    // Graphics/Motion should be created
    expect(api.makeDir).toHaveBeenCalledWith('/p/Graphics/Motion')
    // Temp dir should be inside Graphics/Motion with the template id
    expect(tmpDir).toMatch(/\/p\/Graphics\/Motion\/\.tmp-lower-third-glide-/)
    // motionDir should be the parent
    expect(motionDir).toBe('/p/Graphics/Motion')
    // Temp dir itself should also be created
    const makeDirCalls = (api.makeDir as ReturnType<typeof vi.fn>).mock.calls
    const tmpDirCreated = makeDirCalls.some(([path]: [string]) => path === tmpDir)
    expect(tmpDirCreated).toBe(true)
  })

  it('commitBundle writes files and renames from provided tmpDir', async () => {
    const api = mockApi()
    const tmpDir = '/p/Graphics/Motion/.tmp-lower-third-glide-abc123'
    const motionDir = '/p/Graphics/Motion'

    const result = await commitBundle(baseInput(), api, tmpDir, motionDir)

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

  it('commitBundle removes tmpDir on error', async () => {
    let writeCount = 0
    const api = mockApi({
      writeText: vi.fn(async () => {
        writeCount++
        if (writeCount === 2) throw new Error('disk full')
      })
    })
    const tmpDir = '/p/Graphics/Motion/.tmp-lower-third-glide-abc123'
    const motionDir = '/p/Graphics/Motion'

    await expect(commitBundle(baseInput(), api, tmpDir, motionDir)).rejects.toThrow(
      'disk full'
    )

    expect(api.removeDirRecursive).toHaveBeenCalledWith(tmpDir)
  })

  it('writes binary files correctly', async () => {
    const api = mockApi()
    const binaryFile = {
      name: 'lower-third-glide.mov',
      kind: 'binary' as const,
      bytes: new Uint8Array([0, 1, 2, 3])
    }

    const { tmpDir, motionDir } = await beginBundle(
      baseInput({
        files: [...baseInput().files, binaryFile],
        targets: ['ae', 'prompt', 'video']
      }),
      api
    )
    await commitBundle(
      baseInput({
        files: [...baseInput().files, binaryFile],
        targets: ['ae', 'prompt', 'video']
      }),
      api,
      tmpDir,
      motionDir
    )

    expect(api.writeBytes).toHaveBeenCalledTimes(1)
    const [path, bytes] = (api.writeBytes as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toMatch(/lower-third-glide\.mov$/)
    expect(bytes).toEqual(new Uint8Array([0, 1, 2, 3]))
  })
})

describe('stale .tmp-* sweep', () => {
  it('removes .tmp-* folders older than 24 hours', async () => {
    const now = Date.now()
    const TWO_DAYS_AGO = now - 2 * 24 * 60 * 60 * 1000

    const api = mockApi({
      listFolder: vi.fn(async () => [
        { name: '.tmp-old-render-abc', isFile: false },
        { name: 'glide-jane-doe', isFile: false },
        { name: 'README.md', isFile: true }
      ]),
      modifiedTimeMs: vi.fn(async () => TWO_DAYS_AGO)
    })

    await beginBundle(baseInput(), api)

    // Only the stale .tmp-* folder should be removed, not the real folder
    expect(api.removeDirRecursive).toHaveBeenCalledWith(
      '/p/Graphics/Motion/.tmp-old-render-abc'
    )
    expect(api.removeDirRecursive).toHaveBeenCalledTimes(1)
  })

  it('does not remove .tmp-* folders younger than 24 hours', async () => {
    const now = Date.now()
    const ONE_HOUR_AGO = now - 60 * 60 * 1000

    const api = mockApi({
      listFolder: vi.fn(async () => [{ name: '.tmp-recent-render-xyz', isFile: false }]),
      modifiedTimeMs: vi.fn(async () => ONE_HOUR_AGO)
    })

    await beginBundle(baseInput(), api)

    // removeDirRecursive should NOT have been called (no stale folders)
    expect(api.removeDirRecursive).not.toHaveBeenCalled()
  })

  it('never touches folders that do not start with .tmp-', async () => {
    const now = Date.now()
    const TWO_DAYS_AGO = now - 2 * 24 * 60 * 60 * 1000

    const api = mockApi({
      listFolder: vi.fn(async () => [
        { name: 'glide-jane-doe', isFile: false },
        { name: '.hidden-folder', isFile: false },
        { name: 'tmp-no-dot-prefix', isFile: false }
      ]),
      modifiedTimeMs: vi.fn(async () => TWO_DAYS_AGO)
    })

    await beginBundle(baseInput(), api)

    // Nothing should be removed
    expect(api.removeDirRecursive).not.toHaveBeenCalled()
  })

  it('does not remove .tmp-* files (only folders)', async () => {
    const now = Date.now()
    const TWO_DAYS_AGO = now - 2 * 24 * 60 * 60 * 1000

    const api = mockApi({
      listFolder: vi.fn(async () => [{ name: '.tmp-old-file', isFile: true }]),
      modifiedTimeMs: vi.fn(async () => TWO_DAYS_AGO)
    })

    await beginBundle(baseInput(), api)

    expect(api.removeDirRecursive).not.toHaveBeenCalled()
  })

  it('one failing stat does not prevent removal of other stale folders', async () => {
    const now = Date.now()
    const TWO_DAYS_AGO = now - 2 * 24 * 60 * 60 * 1000

    const api = mockApi({
      listFolder: vi.fn(async () => [
        { name: '.tmp-broken-aaa', isFile: false },
        { name: '.tmp-stale-bbb', isFile: false }
      ]),
      modifiedTimeMs: vi.fn(async (path: string) => {
        if (path.includes('.tmp-broken-aaa')) throw new Error('permission denied')
        return TWO_DAYS_AGO
      })
    })

    await beginBundle(baseInput(), api)

    // The second folder should still be removed even though the first stat failed
    expect(api.removeDirRecursive).toHaveBeenCalledWith(
      '/p/Graphics/Motion/.tmp-stale-bbb'
    )
  })
})
