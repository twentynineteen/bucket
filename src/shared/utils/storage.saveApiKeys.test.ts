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

import { useAppStore } from '@shared/store'

import { loadApiKeys, saveApiKeys } from './storage'

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

  it('b2_1_persists_and_hydrates_the_rebrand_background_folder', async () => {
    // Issue #189: the rebrand folder must sync into the store on save, or the
    // value shows as not-configured until the next app launch.
    useAppStore.setState({ rebrandBackgroundFolder: null })

    await saveApiKeys({
      sproutVideo: 'key',
      rebrandBackgroundFolder: '/backgrounds/rebrand'
    })

    const [, written] = writeTextFileMock.mock.calls[0]
    expect(JSON.parse(written as string).rebrandBackgroundFolder).toBe(
      '/backgrounds/rebrand'
    )
    expect(useAppStore.getState().rebrandBackgroundFolder).toBe('/backgrounds/rebrand')
  })
})

describe('loadApiKeys', () => {
  it('b2_1_hydrates_both_background_folders_into_the_store_on_launch', async () => {
    // Issue #189: loadApiKeys hand-syncs each field; a key missing from this
    // list silently never hydrates, and the folder reports not-configured
    // forever despite being saved on disk.
    useAppStore.setState({
      defaultBackgroundFolder: null,
      rebrandBackgroundFolder: null
    })
    existsMock.mockResolvedValue(true)
    readTextFileMock.mockResolvedValue(
      JSON.stringify({
        sproutVideo: 'key',
        defaultBackgroundFolder: '/backgrounds/classic',
        rebrandBackgroundFolder: '/backgrounds/rebrand'
      })
    )

    await loadApiKeys()

    expect(useAppStore.getState().defaultBackgroundFolder).toBe('/backgrounds/classic')
    expect(useAppStore.getState().rebrandBackgroundFolder).toBe('/backgrounds/rebrand')
  })
})
