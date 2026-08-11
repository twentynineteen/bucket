/**
 * App data path resolution and the misplaced-file migration (issue #167).
 *
 * `appDataDir()` returns no trailing separator, so `${dir}${file}` put
 * api_keys.json and sprout-folder-index.json *beside* the app data directory
 * rather than inside it. These tests cover the corrected join and the migration
 * that relocates what the old expression already wrote.
 *
 * Behaviour IDs refer to issue #167.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { appDataDirMock, joinMock, existsMock, statMock, renameMock, removeMock, mkdirMock } =
  vi.hoisted(() => ({
    appDataDirMock: vi.fn(),
    joinMock: vi.fn(),
    existsMock: vi.fn(),
    statMock: vi.fn(),
    renameMock: vi.fn(),
    removeMock: vi.fn(),
    mkdirMock: vi.fn()
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
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: {}
}))

const DIR = '/mock/app/data'
const KEYS = 'api_keys.json'
const CORRECT = '/mock/app/data/api_keys.json'
const MISPLACED = '/mock/app/dataapi_keys.json'
const LEGACY_TXT = 'api_key.txt'
const MISPLACED_LEGACY = '/mock/app/dataapi_key.txt'

/** Stands in for the real join: concatenates segments, collapsing separators. */
function realisticJoin(...parts: string[]) {
  return Promise.resolve(parts.join('/').replace(/\/{2,}/g, '/'))
}

/** Makes exists() answer true only for the listed paths. */
function present(...paths: string[]) {
  existsMock.mockImplementation((p: string) => Promise.resolve(paths.includes(p)))
}

/** Re-imports the module so its per-session memo starts empty. */
async function freshSession() {
  vi.resetModules()
  return import('./appDataPath')
}

beforeEach(() => {
  vi.clearAllMocks()
  appDataDirMock.mockResolvedValue(DIR)
  joinMock.mockImplementation(realisticJoin)
  statMock.mockResolvedValue({ isFile: true, isDirectory: false, isSymlink: false })
  renameMock.mockResolvedValue(undefined)
  removeMock.mockResolvedValue(undefined)
  mkdirMock.mockResolvedValue(undefined)
  present(DIR)
})

describe('resolveAppDataFile - path construction (#167 B1)', () => {
  it('b1_1_joins_the_directory_and_filename_as_separate_arguments', async () => {
    const { resolveAppDataFile } = await freshSession()

    const result = await resolveAppDataFile(KEYS)

    expect(joinMock).toHaveBeenCalledWith(DIR, KEYS)
    expect(result).toBe(CORRECT)
  })

  it('b1_1_returns_joins_value_verbatim_rather_than_building_the_path_itself', async () => {
    // If the code concatenated instead of using join's answer, this sentinel
    // would not survive.
    joinMock.mockResolvedValue('/sentinel/from/join')
    present(DIR)
    const { resolveAppDataFile } = await freshSession()

    await expect(resolveAppDataFile(KEYS)).resolves.toBe('/sentinel/from/join')
  })
})

describe('resolveAppDataFile - migration happy path (#167 B2)', () => {
  it('b2_1_moves_a_misplaced_file_into_the_directory_and_returns_the_correct_path', async () => {
    present(DIR, MISPLACED)
    const { resolveAppDataFile } = await freshSession()

    const result = await resolveAppDataFile(KEYS)

    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
    expect(result).toBe(CORRECT)
  })

  it('b2_3_creates_the_app_data_directory_before_moving_when_it_does_not_exist', async () => {
    present(MISPLACED) // directory itself absent
    const { resolveAppDataFile } = await freshSession()

    await resolveAppDataFile(KEYS)

    expect(mkdirMock).toHaveBeenCalledWith(DIR, { recursive: true })
    const mkdirOrder = mkdirMock.mock.invocationCallOrder[0]
    const renameOrder = renameMock.mock.invocationCallOrder[0]
    expect(mkdirOrder).toBeLessThan(renameOrder)
  })
})

describe('resolveAppDataFile - guards on what is migrated (#167 B3)', () => {
  it('b3_1_does_nothing_when_appDataDir_returns_a_trailing_separator', async () => {
    // The misplaced path can only be computed by reproducing the bug. With a
    // trailing separator that expression IS the correct path, so migrating it
    // would delete the user's real file.
    appDataDirMock.mockResolvedValue('/mock/app/data/')
    present('/mock/app/data/', CORRECT)
    const { resolveAppDataFile } = await freshSession()

    const result = await resolveAppDataFile(KEYS)

    expect(result).toBe(CORRECT)
    expect(renameMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('b3_2_leaves_a_directory_at_the_misplaced_path_untouched', async () => {
    present(DIR, MISPLACED)
    statMock.mockResolvedValue({ isFile: false, isDirectory: true, isSymlink: false })
    const { resolveAppDataFile } = await freshSession()

    const result = await resolveAppDataFile(KEYS)

    expect(result).toBe(CORRECT)
    expect(renameMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('b3_3_deletes_the_misplaced_copy_and_never_writes_over_the_correct_one', async () => {
    present(DIR, MISPLACED, CORRECT)
    const { resolveAppDataFile } = await freshSession()

    const result = await resolveAppDataFile(KEYS)

    expect(renameMock).not.toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith(MISPLACED)
    expect(result).toBe(CORRECT)
  })
})

describe('resolveAppDataFile - idempotence and concurrency (#167 B4)', () => {
  it('b4_1_attempts_no_move_or_delete_when_nothing_is_misplaced', async () => {
    present(DIR, CORRECT)
    const { resolveAppDataFile } = await freshSession()

    await resolveAppDataFile(KEYS)

    expect(renameMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('b4_2_does_not_probe_again_once_the_migration_has_run_this_session', async () => {
    present(DIR, MISPLACED)
    const { resolveAppDataFile } = await freshSession()

    await resolveAppDataFile(KEYS)
    const probesAfterFirst = existsMock.mock.calls.length
    await resolveAppDataFile(KEYS)

    expect(existsMock.mock.calls.length).toBe(probesAfterFirst)
  })

  it('b4_3_moves_once_when_two_callers_resolve_concurrently', async () => {
    present(DIR, MISPLACED)
    const { resolveAppDataFile } = await freshSession()

    const [a, b] = await Promise.all([resolveAppDataFile(KEYS), resolveAppDataFile(KEYS)])

    expect(renameMock).toHaveBeenCalledTimes(1)
    expect(a).toBe(CORRECT)
    expect(b).toBe(CORRECT)
  })

  it('b4_4_a_second_session_leaves_the_same_state_as_the_first', async () => {
    present(DIR, MISPLACED)
    const first = await freshSession()
    await first.resolveAppDataFile(KEYS)
    expect(renameMock).toHaveBeenCalledTimes(1)

    // Second launch: the file is now where it belongs.
    present(DIR, CORRECT)
    const second = await freshSession()
    const result = await second.resolveAppDataFile(KEYS)

    expect(renameMock).toHaveBeenCalledTimes(1)
    expect(result).toBe(CORRECT)
  })
})

describe('resolveAppDataFile - failure (#167 B5)', () => {
  it('b5_1_falls_back_to_the_misplaced_path_when_the_move_rejects', async () => {
    present(DIR, MISPLACED)
    renameMock.mockRejectedValue(new Error('EACCES: permission denied'))
    const { resolveAppDataFile } = await freshSession()

    await expect(resolveAppDataFile(KEYS)).resolves.toBe(MISPLACED)
  })

  it('b5_3_retries_the_move_on_a_later_call_in_the_same_session', async () => {
    present(DIR, MISPLACED)
    renameMock.mockRejectedValueOnce(new Error('device busy'))
    const { resolveAppDataFile } = await freshSession()

    await expect(resolveAppDataFile(KEYS)).resolves.toBe(MISPLACED)
    await expect(resolveAppDataFile(KEYS)).resolves.toBe(CORRECT)
    expect(renameMock).toHaveBeenCalledTimes(2)
  })

  it('b5_4_uses_the_correct_path_when_the_existence_probe_itself_rejects', async () => {
    existsMock.mockRejectedValue(new Error('probe denied'))
    const { resolveAppDataFile } = await freshSession()

    // An unanswerable probe is not evidence that a misplaced file exists.
    await expect(resolveAppDataFile(KEYS)).resolves.toBe(CORRECT)
    expect(renameMock).not.toHaveBeenCalled()
  })

  it('b5_1_never_throws_when_the_filesystem_is_uncooperative', async () => {
    present(DIR, MISPLACED)
    statMock.mockRejectedValue(new Error('stat failed'))
    renameMock.mockRejectedValue(new Error('rename failed'))
    removeMock.mockRejectedValue(new Error('remove failed'))
    const { resolveAppDataFile } = await freshSession()

    await expect(resolveAppDataFile(KEYS)).resolves.toEqual(expect.any(String))
  })
})

describe('removeMisplacedResidue - api_key.txt (#167 B6)', () => {
  it('b6_1_deletes_the_misplaced_legacy_file', async () => {
    present(DIR, MISPLACED_LEGACY)
    const { removeMisplacedResidue } = await freshSession()

    await removeMisplacedResidue(LEGACY_TXT)

    expect(removeMock).toHaveBeenCalledWith(MISPLACED_LEGACY)
  })

  it('b6_2_does_not_throw_when_the_deletion_rejects', async () => {
    present(DIR, MISPLACED_LEGACY)
    removeMock.mockRejectedValue(new Error('EPERM'))
    const { removeMisplacedResidue } = await freshSession()

    await expect(removeMisplacedResidue(LEGACY_TXT)).resolves.toBeUndefined()
  })

  it('b6_3_deletes_nothing_when_the_legacy_file_is_absent', async () => {
    present(DIR)
    const { removeMisplacedResidue } = await freshSession()

    await removeMisplacedResidue(LEGACY_TXT)

    expect(removeMock).not.toHaveBeenCalled()
  })

  it('b6_4_leaves_the_path_alone_when_it_is_not_a_regular_file', async () => {
    present(DIR, MISPLACED_LEGACY)
    statMock.mockResolvedValue({ isFile: false, isDirectory: true, isSymlink: false })
    const { removeMisplacedResidue } = await freshSession()

    await removeMisplacedResidue(LEGACY_TXT)

    expect(removeMock).not.toHaveBeenCalled()
  })
})
