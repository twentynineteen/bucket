/**
 * Trello api.ts (issue #282, B8.4)
 *
 * `addCardComment` used to log a warning and resolve on a non-2xx response.
 * That made a failed comment indistinguishable from a posted one to every
 * caller, so a replace could never tell the user which cards missed the
 * comment. It now rejects, like the other card writes in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn()
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  open: vi.fn()
}))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))

import { addCardComment } from './api'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('addCardComment', () => {
  it('posts the text to the card comments endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    await addCardComment('card-1', 'Replaced the video.', 'key', 'token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.trello.com/1/cards/card-1/actions/comments?key=key&token=token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Replaced the video.' })
      })
    )
  })

  it('b8_4_rejects_on_a_non_2xx_response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })

    await expect(addCardComment('card-1', 'Replaced.', 'key', 'token')).rejects.toThrow(
      /401|Unauthorized/
    )
  })
})
