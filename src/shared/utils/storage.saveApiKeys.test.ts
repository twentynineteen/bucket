/**
 * saveApiKeys failure propagation (issue #155, P5-b)
 *
 * The function used to catch, log, and return normally. Every caller therefore
 * saw a resolved promise whether or not anything reached disk -- so the user was
 * told a setting saved, and it was gone at next launch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { writeTextFileMock, readTextFileMock, existsMock, appDataDirMock, joinMock } =
  vi.hoisted(() => ({
    writeTextFileMock: vi.fn(),
    readTextFileMock: vi.fn(),
    existsMock: vi.fn(),
    appDataDirMock: vi.fn(),
    joinMock: vi.fn()
  }))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  readTextFile: readTextFileMock,
  exists: existsMock,
  stat: vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, isSymlink: false }),
  rename: vi.fn(),
  remove: vi.fn(),
  mkdir: vi.fn(),
  BaseDirectory: {}
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: appDataDirMock,
  join: joinMock
}))

import { saveApiKeys } from './storage'

beforeEach(() => {
  writeTextFileMock.mockReset().mockResolvedValue(undefined)
  // vitest.config.ts sets mockReset, so implementations declared in the mock
  // factory are wiped between tests and must be restored here.
  // No trailing separator, matching the real API (issue #167).
  appDataDirMock.mockResolvedValue('/tmp/bucket')
  joinMock.mockImplementation((...parts: string[]) =>
    Promise.resolve(parts.join('/').replace(/\/{2,}/g, '/'))
  )
  existsMock.mockResolvedValue(false)
})

describe('saveApiKeys', () => {
  it('resolves when the write succeeds', async () => {
    await expect(saveApiKeys({ sproutVideo: 'key' })).resolves.toBeUndefined()
    expect(writeTextFileMock).toHaveBeenCalledOnce()
  })

  it('rejects when the write fails, rather than reporting a false success', async () => {
    writeTextFileMock.mockRejectedValue(new Error('EACCES: permission denied'))

    await expect(saveApiKeys({ sproutVideo: 'key' })).rejects.toThrow(/EACCES/)
  })

  it('persists the new Sprout default folder fields', async () => {
    await saveApiKeys({
      sproutVideo: 'key',
      sproutDefaultFolderId: 'f1',
      sproutDefaultFolderName: 'Marketing / Q2'
    })

    const [, written] = writeTextFileMock.mock.calls[0]
    const parsed = JSON.parse(written as string)

    expect(parsed.sproutDefaultFolderId).toBe('f1')
    expect(parsed.sproutDefaultFolderName).toBe('Marketing / Q2')
  })
})
