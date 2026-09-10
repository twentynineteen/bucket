/**
 * awaitUploadOutcome (issue #282)
 *
 * The buffer path is only reachable through hooks, so the two orderings the
 * hook tests cannot pin directly are pinned here: events that arrive before
 * the backend has named the operation are replayed in order once it has, and
 * are discarded if the start itself fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  listenUploadComplete: vi.fn(),
  listenUploadError: vi.fn(),
  listenUploadProgress: vi.fn(),
  listenUploadCancelled: vi.fn()
}))

import {
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress
} from '../api'
import type { SproutUploadResponse } from '../types'
import { awaitUploadOutcome } from './awaitUploadOutcome'

type Payload = { operationId: string; [key: string]: unknown }
type Handler = (event: { event: string; id: number; payload: Payload }) => unknown

const handlers: Record<'progress' | 'complete' | 'error' | 'cancelled', Handler | null> =
  {
    progress: null,
    complete: null,
    error: null,
    cancelled: null
  }
const unlisten = vi.fn()

const emit = async (channel: keyof typeof handlers, payload: Payload) => {
  await handlers[channel]?.({ event: channel, id: 1, payload })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const video = { id: 'vid-1', state: 'deployed' } as unknown as SproutUploadResponse

beforeEach(() => {
  unlisten.mockClear()
  for (const [channel, listener] of [
    ['progress', listenUploadProgress],
    ['complete', listenUploadComplete],
    ['error', listenUploadError],
    ['cancelled', listenUploadCancelled]
  ] as const) {
    vi.mocked(listener).mockImplementation(async (cb) => {
      handlers[channel] = cb as Handler
      return unlisten
    })
  }
})

describe('awaitUploadOutcome - buffer mode', () => {
  it('replays buffered progress then completion in order once the id is known', async () => {
    const registered = deferred<string>()
    const onProgress = vi.fn()
    const order: string[] = []

    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      beforeIdKnown: 'buffer',
      onProgress: (event) => {
        onProgress(event)
        order.push('progress')
      }
    })
    void outcome.then(() => order.push('resolved'))

    await emit('progress', {
      operationId: 'op-1',
      bytesSent: 5,
      totalBytes: 10,
      percentage: 50
    })
    await emit('complete', { operationId: 'op-1', video })
    expect(onProgress).not.toHaveBeenCalled()

    registered.resolve('op-1')

    await expect(outcome).resolves.toEqual({ kind: 'complete', video })
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['progress', 'resolved'])
  })

  it('discards a buffered terminal event when the start itself fails', async () => {
    const registered = deferred<string>()
    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      beforeIdKnown: 'buffer'
    })

    await emit('complete', { operationId: 'op-1', video })
    registered.reject('No such video')

    await expect(outcome).rejects.toBe('No such video')
    // Every channel detached exactly once, and nothing fires after settling.
    expect(unlisten).toHaveBeenCalledTimes(4)
  })

  it('drops buffered events from other operations', async () => {
    const registered = deferred<string>()
    const onProgress = vi.fn()
    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      beforeIdKnown: 'buffer',
      onProgress
    })

    await emit('progress', {
      operationId: 'op-zombie',
      bytesSent: 1,
      totalBytes: 2,
      percentage: 50
    })
    await emit('complete', { operationId: 'op-zombie', video })
    registered.resolve('op-1')
    await Promise.resolve()

    expect(onProgress).not.toHaveBeenCalled()
    await emit('complete', { operationId: 'op-1', video })
    await expect(outcome).resolves.toEqual({ kind: 'complete', video })
  })
})
