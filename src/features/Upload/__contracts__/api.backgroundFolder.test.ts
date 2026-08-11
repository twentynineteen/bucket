/**
 * Tests for listDirectory's background-folder classification.
 * Issue #166 (B1.1-B1.5)
 *
 * listDirectory no longer throws on an unusable folder. It returns a tagged
 * result so callers can tell "not there" from "there but unreadable" from
 * "there, readable, no images" without matching on Tauri's error strings.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as tauriFs from '@tauri-apps/plugin-fs'

import { listDirectory } from '../api'

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/appdata/'),
  fontDir: vi.fn().mockResolvedValue('/fonts')
}))

const FOLDER = '/backgrounds'

function entry(name: string) {
  return { name, isFile: true, isDirectory: false, isSymlink: false }
}

describe('listDirectory - background folder classification (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('b1_1_returns_ok_with_sorted_image_paths_for_a_readable_folder', async () => {
    vi.mocked(tauriFs.exists).mockResolvedValue(true)
    vi.mocked(tauriFs.readDir).mockResolvedValue([
      entry('wbs-red.png'),
      entry('notes.txt'),
      entry('wbs-blue.jpg')
    ] as never)

    const result = await listDirectory(FOLDER)

    expect(result).toEqual({
      status: 'ok',
      files: ['/backgrounds/wbs-blue.jpg', '/backgrounds/wbs-red.png']
    })
  })

  it('b1_2_returns_missing_without_throwing_when_the_path_does_not_exist', async () => {
    vi.mocked(tauriFs.exists).mockResolvedValue(false)

    const result = await listDirectory(FOLDER)

    expect(result).toEqual({ status: 'missing' })
    // The listing must not even be attempted for a path that isn't there.
    expect(tauriFs.readDir).not.toHaveBeenCalled()
  })

  it('b1_3_returns_unreadable_with_detail_when_the_listing_rejects', async () => {
    vi.mocked(tauriFs.exists).mockResolvedValue(true)
    vi.mocked(tauriFs.readDir).mockRejectedValue(new Error('forbidden (os error 13)'))

    const result = await listDirectory(FOLDER)

    expect(result.status).toBe('unreadable')
    expect(result).toHaveProperty('detail')
    expect((result as { detail: string }).detail).toContain('os error 13')
  })

  it('b1_4_returns_unreadable_when_the_existence_probe_itself_rejects', async () => {
    vi.mocked(tauriFs.exists).mockRejectedValue(new Error('probe denied'))

    const result = await listDirectory(FOLDER)

    expect(result.status).toBe('unreadable')
    expect((result as { detail: string }).detail).toContain('probe denied')
  })

  it('b1_5_returns_ok_with_no_files_for_a_readable_folder_holding_no_images', async () => {
    vi.mocked(tauriFs.exists).mockResolvedValue(true)
    vi.mocked(tauriFs.readDir).mockResolvedValue([
      entry('notes.txt'),
      entry('script.md')
    ] as never)

    const result = await listDirectory(FOLDER)

    expect(result).toEqual({ status: 'ok', files: [] })
  })
})
