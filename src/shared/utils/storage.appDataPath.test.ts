/**
 * api_keys.json reaches the migrated path (issue #167).
 *
 * appDataPath.test.ts covers the resolver in isolation. These tests drive it
 * through the exported functions users actually reach, since getFilePath is
 * module-private, and cover the residue sweep that storage.ts triggers.
 *
 * Behaviour IDs refer to issue #167.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { appDataDirMock, joinMock, existsMock, statMock, renameMock, removeMock, mkdirMock, readTextFileMock, writeTextFileMock } =
  vi.hoisted(() => ({
    appDataDirMock: vi.fn(),
    joinMock: vi.fn(),
    existsMock: vi.fn(),
    statMock: vi.fn(),
    renameMock: vi.fn(),
    removeMock: vi.fn(),
    mkdirMock: vi.fn(),
    readTextFileMock: vi.fn(),
    writeTextFileMock: vi.fn()
  }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: appDataDirMock,
  join: joinMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: existsMock,
  stat: statMock,
  rename: renameMock,
  remove: removeMock,
  mkdir: mkdirMock,
  readTextFile: readTextFileMock,
  writeTextFile: writeTextFileMock,
  BaseDirectory: {}
}))

vi.mock('@shared/store/useAppStore', () => ({
  appStore: {
    getState: vi.fn(() => ({
      setSproutVideoApiKey: vi.fn(),
      setTrelloApiKey: vi.fn(),
      setTrelloApiToken: vi.fn(),
      setTrelloBoardId: vi.fn(),
      setDefaultBackgroundFolder: vi.fn(),
      setOllamaUrl: vi.fn()
    }))
  }
}))

const DIR = '/mock/app/data'
const CORRECT = '/mock/app/data/api_keys.json'
const MISPLACED = '/mock/app/dataapi_keys.json'
const MISPLACED_LEGACY = '/mock/app/dataapi_key.txt'

const STORED = JSON.stringify({ sproutVideo: 'stored-key', trello: 'stored-trello' })

function present(...paths: string[]) {
  existsMock.mockImplementation((p: string) => Promise.resolve(paths.includes(p)))
}

async function freshSession() {
  vi.resetModules()
  return import('./storage')
}

beforeEach(() => {
  vi.clearAllMocks()
  appDataDirMock.mockResolvedValue(DIR)
  joinMock.mockImplementation((...parts: string[]) =>
    Promise.resolve(parts.join('/').replace(/\/{2,}/g, '/'))
  )
  statMock.mockResolvedValue({ isFile: true, isDirectory: false, isSymlink: false })
  renameMock.mockResolvedValue(undefined)
  removeMock.mockResolvedValue(undefined)
  mkdirMock.mockResolvedValue(undefined)
  writeTextFileMock.mockResolvedValue(undefined)
  readTextFileMock.mockResolvedValue(STORED)
})

describe('loadApiKeys after migration (#167 B2)', () => {
  it('b2_1_returns_the_migrated_files_contents_rather_than_an_empty_object', async () => {
    present(DIR, MISPLACED)
    const { loadApiKeys } = await freshSession()

    const keys = await loadApiKeys()

    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
    expect(keys).toEqual({ sproutVideo: 'stored-key', trello: 'stored-trello' })
  })

  it('b2_1_reads_from_the_correct_path_once_migrated', async () => {
    present(DIR, MISPLACED)
    const { loadApiKeys } = await freshSession()

    await loadApiKeys()

    expect(readTextFileMock).toHaveBeenCalledWith(CORRECT)
  })
})

describe('saveApiKeys path targeting (#167 B2, B5)', () => {
  it('b2_4_writes_to_the_correct_path_after_a_migration', async () => {
    present(DIR, MISPLACED)
    const { saveApiKeys } = await freshSession()

    await saveApiKeys({ sproutVideo: 'new-key' })

    const [target] = writeTextFileMock.mock.calls[0]
    expect(target).toBe(CORRECT)
  })

  it('b2_4_writes_inside_the_directory_when_nothing_needs_migrating', async () => {
    present(DIR)
    const { saveApiKeys } = await freshSession()

    await saveApiKeys({ sproutVideo: 'new-key' })

    const [target] = writeTextFileMock.mock.calls[0]
    expect(target).toBe(CORRECT)
    // The bug this issue fixes: the file landing beside the directory.
    expect(target).not.toBe(MISPLACED)
  })

  it('b5_2_writes_to_the_misplaced_path_when_the_move_failed_so_read_and_write_agree', async () => {
    present(DIR, MISPLACED)
    renameMock.mockRejectedValue(new Error('EACCES'))
    const { saveApiKeys, loadApiKeys } = await freshSession()

    await saveApiKeys({ sproutVideo: 'new-key' })
    await loadApiKeys()

    // The fallback must be a fallback: the move is attempted first, and only
    // its failure sends the write back to the old location. Without this the
    // test would pass against the unfixed code, which never tries to move.
    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
    expect(writeTextFileMock.mock.calls[0][0]).toBe(MISPLACED)
    expect(readTextFileMock).toHaveBeenCalledWith(MISPLACED)
  })
})

describe('legacy api_key.txt sweep (#167 B6)', () => {
  it('b6_1_deletes_it_even_when_api_keys_json_needed_no_migration', async () => {
    present(DIR, CORRECT, MISPLACED_LEGACY)
    const { loadApiKeys } = await freshSession()

    await loadApiKeys()

    expect(removeMock).toHaveBeenCalledWith(MISPLACED_LEGACY)
  })

  it('b6_2_still_completes_the_api_keys_migration_when_the_sweep_fails', async () => {
    present(DIR, MISPLACED, MISPLACED_LEGACY)
    removeMock.mockRejectedValue(new Error('EPERM'))
    const { loadApiKeys } = await freshSession()

    await expect(loadApiKeys()).resolves.toEqual({
      sproutVideo: 'stored-key',
      trello: 'stored-trello'
    })
    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
  })
})
