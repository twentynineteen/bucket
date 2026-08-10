/**
 * saveApiKeys failure propagation (issue #155, P5-b)
 *
 * The function used to catch, log, and return normally. Every caller therefore
 * saw a resolved promise whether or not anything reached disk -- so the user was
 * told a setting saved, and it was gone at next launch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { writeTextFileMock, readTextFileMock, existsMock } = vi.hoisted(() => ({
  writeTextFileMock: vi.fn(),
  readTextFileMock: vi.fn(),
  existsMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  readTextFile: readTextFileMock,
  exists: existsMock,
  BaseDirectory: {}
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/tmp/bucket/')
}))

import { saveApiKeys } from './storage'

beforeEach(() => {
  writeTextFileMock.mockReset().mockResolvedValue(undefined)
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
