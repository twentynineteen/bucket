/**
 * Upload api.ts wire contract (issue #155)
 *
 * These tests exist because of a bug class that fails *silently*. Tauri
 * camelCases command arguments and does a single `v.get(key)` with no
 * snake_case fallback, so a mistyped argument key does not error -- it binds an
 * `Option<T>` to `None`. `get_folders` sent `parent_id` where the command
 * expected `folderId`, so every folder request returned the account root, for
 * every user, undetected, because the only consumer was dead code.
 *
 * Object equality (not `objectContaining`) is deliberate: an extra or renamed
 * key must fail here rather than degrade to root at runtime.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above module-level consts, so the spy has to be too.
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  stat: vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, isSymlink: false }),
  rename: vi.fn(),
  remove: vi.fn(),
  mkdir: vi.fn()
}))
vi.mock('@tauri-apps/api/path', () => ({
  fontDir: vi.fn(),
  // No trailing separator, and join must exist: api.ts now joins paths rather
  // than concatenating them (issue #167). Plain functions, so `mockReset` in
  // vitest.config.ts cannot wipe them between tests.
  appDataDir: async () => '/appdata',
  join: async (...parts: string[]) => parts.join('/').replace(/\/{2,}/g, '/')
}))

import { getFolders, uploadVideo } from '../api'
import { __resetBudget } from '../internal/sproutRateBudget'

const emptyPage = {
  folders: [],
  total: 0,
  truncated: false,
  rate_limit_remaining: 180,
  rate_limit_reset: null
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockResolvedValue(emptyPage)
  __resetBudget()
})

describe('getFolders wire contract', () => {
  it('sends exactly { apiKey, parentId } -- camelCase, no extra keys', async () => {
    await getFolders('key-123', 'folder-abc')

    expect(invokeMock).toHaveBeenCalledWith('get_folders', {
      apiKey: 'key-123',
      parentId: 'folder-abc'
    })
  })

  it('never sends a snake_case parent_id', async () => {
    // The original bug. A snake_case key binds the Rust Option to None without
    // erroring, so every level silently returns the account root.
    await getFolders('key-123', 'folder-abc')

    const [, args] = invokeMock.mock.calls[0]
    expect(args).not.toHaveProperty('parent_id')
    expect(args).not.toHaveProperty('folder_id')
    expect(args).not.toHaveProperty('folderId')
  })

  it('passes null through for the root level rather than omitting it', async () => {
    await getFolders('key-123', null)

    expect(invokeMock).toHaveBeenCalledWith('get_folders', {
      apiKey: 'key-123',
      parentId: null
    })
  })

  it('invokes the get_folders command by name', async () => {
    await getFolders('key-123', null)
    expect(invokeMock.mock.calls[0][0]).toBe('get_folders')
  })
})

describe('uploadVideo wire contract', () => {
  it('sends the selected folder id under folderId', async () => {
    // The other half of the feature: a folder chosen in the picker has to reach
    // the upload command, or the video lands in the root regardless.
    await uploadVideo('/tmp/video.mp4', 'key-123', 'folder-abc', 'A title')

    expect(invokeMock).toHaveBeenCalledWith('upload_video', {
      filePath: '/tmp/video.mp4',
      apiKey: 'key-123',
      folderId: 'folder-abc',
      title: 'A title'
    })
  })

  it('sends null for the root folder', async () => {
    await uploadVideo('/tmp/video.mp4', 'key-123', null)

    expect(invokeMock).toHaveBeenCalledWith('upload_video', {
      filePath: '/tmp/video.mp4',
      apiKey: 'key-123',
      folderId: null,
      title: null
    })
  })
})
