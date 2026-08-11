/**
 * Folder index and poster-frame font paths are joined, not concatenated
 * (issue #167).
 *
 * folderIndexPath built `${await appDataDir()}${FOLDER_INDEX_FILE}`, so the
 * 122 KB index landed beside the app data directory. The font path hardcoded a
 * separator after fontDir(). Both now go through join, and the index migrates.
 *
 * Behaviour IDs refer to issue #167.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  appDataDirMock,
  fontDirMock,
  joinMock,
  existsMock,
  statMock,
  renameMock,
  removeMock,
  mkdirMock,
  readTextFileMock,
  writeTextFileMock
} = vi.hoisted(() => ({
  appDataDirMock: vi.fn(),
  fontDirMock: vi.fn(),
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
  fontDir: fontDirMock,
  join: joinMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: existsMock,
  stat: statMock,
  rename: renameMock,
  remove: removeMock,
  mkdir: mkdirMock,
  readDir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: readTextFileMock,
  writeFile: vi.fn(),
  writeTextFile: writeTextFileMock
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))

const DIR = '/mock/app/data'
const CORRECT = '/mock/app/data/sprout-folder-index.json'
const MISPLACED = '/mock/app/datasprout-folder-index.json'
const FONTS = '/mock/fonts'
const FONT_PATH = '/mock/fonts/Cabrito.otf'

const INDEX = JSON.stringify({ folders: [{ id: 'f1', name: 'Marketing' }] })

/**
 * A fake filesystem that actually moves things, so a migrated index is
 * readable at its new path rather than vanishing.
 */
const files = new Set<string>()

function present(...paths: string[]) {
  files.clear()
  paths.forEach((p) => files.add(p))
}

async function freshSession() {
  vi.resetModules()
  return import('../api')
}

beforeEach(() => {
  vi.clearAllMocks()
  appDataDirMock.mockResolvedValue(DIR)
  fontDirMock.mockResolvedValue(FONTS)
  joinMock.mockImplementation((...parts: string[]) =>
    Promise.resolve(parts.join('/').replace(/\/{2,}/g, '/'))
  )
  statMock.mockResolvedValue({ isFile: true, isDirectory: false, isSymlink: false })
  existsMock.mockImplementation((p: string) => Promise.resolve(files.has(p)))
  renameMock.mockImplementation((from: string, to: string) => {
    files.delete(from)
    files.add(to)
    return Promise.resolve(undefined)
  })
  removeMock.mockImplementation((p: string) => {
    files.delete(p)
    return Promise.resolve(undefined)
  })
  mkdirMock.mockImplementation((p: string) => {
    files.add(p)
    return Promise.resolve(undefined)
  })
  writeTextFileMock.mockResolvedValue(undefined)
  readTextFileMock.mockResolvedValue(INDEX)
})

describe('folder index path (#167 B1, B2)', () => {
  it('b1_2_joins_the_directory_and_filename_as_separate_arguments', async () => {
    present(DIR, CORRECT)
    const { readFolderIndex } = await freshSession()

    await readFolderIndex()

    expect(joinMock).toHaveBeenCalledWith(DIR, 'sprout-folder-index.json')
  })

  it('b1_2_writes_inside_the_directory_rather_than_beside_it', async () => {
    present(DIR)
    const { writeFolderIndex } = await freshSession()

    await writeFolderIndex({ folders: [] })

    const [target] = writeTextFileMock.mock.calls[0]
    expect(target).toBe(CORRECT)
    expect(target).not.toBe(MISPLACED)
  })

  it('b2_2_migrates_a_misplaced_index_and_returns_it_rather_than_null', async () => {
    present(DIR, MISPLACED)
    const { readFolderIndex } = await freshSession()

    const index = await readFolderIndex()

    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
    expect(index).toEqual({ folders: [{ id: 'f1', name: 'Marketing' }] })
  })
})

describe('folder index failure handling (#167 B5)', () => {
  it('b5_5_returns_null_rather_than_throwing_when_the_migration_fails', async () => {
    present(DIR, MISPLACED)
    renameMock.mockRejectedValue(new Error('EACCES'))
    readTextFileMock.mockRejectedValue(new Error('unreadable'))
    const { readFolderIndex } = await freshSession()

    await expect(readFolderIndex()).resolves.toBeNull()
    // Asserted so this cannot pass against the unfixed code, which never
    // attempts a move and returns null for unrelated reasons.
    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
  })

  it('b5_5_writeFolderIndex_still_rejects_when_the_write_fails_after_a_failed_move', async () => {
    // The clause that matters: the migration failed, so the write targets the
    // misplaced path -- and a failure there must still reach the caller.
    present(DIR, MISPLACED)
    renameMock.mockRejectedValue(new Error('EACCES'))
    writeTextFileMock.mockRejectedValue(new Error('disk full'))
    const { writeFolderIndex } = await freshSession()

    await expect(writeFolderIndex({ folders: [] })).rejects.toThrow(/disk full/)
    expect(renameMock).toHaveBeenCalledWith(MISPLACED, CORRECT)
  })

  it('b5_2_writes_to_the_misplaced_path_when_the_move_failed', async () => {
    present(DIR, MISPLACED)
    renameMock.mockRejectedValue(new Error('EACCES'))
    const { writeFolderIndex } = await freshSession()

    await writeFolderIndex({ folders: [] })

    expect(writeTextFileMock.mock.calls[0][0]).toBe(MISPLACED)
  })

  it('b5_5_writeFolderIndex_still_rejects_on_a_genuine_write_failure', async () => {
    present(DIR)
    writeTextFileMock.mockRejectedValue(new Error('disk full'))
    const { writeFolderIndex } = await freshSession()

    await expect(writeFolderIndex({ folders: [] })).rejects.toThrow(/disk full/)
  })
})

describe('poster frame font path (#167 B1)', () => {
  it('b1_3_joins_the_font_directory_and_filename_as_separate_arguments', async () => {
    present(FONT_PATH)
    const { posterFrameFontAvailable } = await freshSession()

    const available = await posterFrameFontAvailable()

    expect(joinMock).toHaveBeenCalledWith(FONTS, 'Cabrito.otf')
    expect(existsMock).toHaveBeenCalledWith(FONT_PATH)
    expect(available).toBe(true)
  })

  it('b1_4_exposes_one_font_path_helper_so_loadFont_cannot_diverge', async () => {
    const api = await freshSession()

    // loadFont lives in internal/ and cannot import @tauri-apps itself
    // (upload.contract.test.ts), so it must consume this export.
    await expect(api.posterFrameFontPath()).resolves.toBe(FONT_PATH)
  })

  it('b1_4_loadFont_probes_and_reads_exactly_the_path_the_helper_returns', async () => {
    vi.resetModules()
    const fileExists = vi.fn().mockResolvedValue(false)
    const posterFrameFontPath = vi.fn().mockResolvedValue(FONT_PATH)
    vi.doMock('../api', () => ({
      fileExists,
      posterFrameFontPath,
      readFileAsBytes: vi.fn()
    }))

    const { loadFont } = await import('../internal/loadFont')
    await loadFont()

    // Asserting the same value flows through is what stops the two paths
    // drifting apart, which is how they diverged before (#167).
    expect(posterFrameFontPath).toHaveBeenCalled()
    expect(fileExists).toHaveBeenCalledWith(FONT_PATH)
  })
})
