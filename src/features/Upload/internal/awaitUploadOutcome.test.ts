/**
 * awaitUploadOutcome (issues #282, #307)
 *
 * Events arriving before start() resolves the operation id are always
 * buffered and replayed once the id is known -- there is no permissive window
 * (the 'accept' mode was deleted by #307). The orderings the hook tests
 * cannot pin directly are pinned here: replay in order, discard on start
 * failure, and zombie rejection before the id is known.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress
} from '../api'
import type { SproutUploadResponse } from '../types'
import { awaitUploadOutcome } from './awaitUploadOutcome'

vi.mock('../api', () => ({
  listenUploadComplete: vi.fn(),
  listenUploadError: vi.fn(),
  listenUploadProgress: vi.fn(),
  listenUploadCancelled: vi.fn()
}))

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
    vi.mocked(listener).mockImplementation(async cb => {
      handlers[channel] = cb as Handler
      return unlisten
    })
  }
})

describe('awaitUploadOutcome - zombie rejection before id is known', () => {
  it('does not resolve the add when a foreign terminal event arrives before the id', async () => {
    // Issue #307: under the old 'accept' mode, a zombie operation's terminal
    // event arriving in the few milliseconds before start() resolved would be
    // mistaken for this upload's completion. With the accept path deleted,
    // the zombie event is buffered, found to belong to someone else on replay,
    // and discarded. The add must stay unresolved until its own event arrives.
    const registered = deferred<string>()
    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      onProgress: vi.fn()
    })

    // Zombie completes before start() tells us our id.
    await emit('complete', { operationId: 'op-zombie', video })
    // The promise must NOT have settled yet.
    const raceResult = await Promise.race([
      outcome.then(() => 'settled'),
      Promise.resolve('pending')
    ])
    expect(raceResult).toBe('pending')

    // Now the backend tells us our real id.
    registered.resolve('op-real')
    // The zombie's completion was discarded; our own event arrives and settles.
    await emit('complete', { operationId: 'op-real', video })
    await expect(outcome).resolves.toEqual({ kind: 'complete', video })
  })

  it('replays our own buffered progress once the id arrives, so progress starts promptly', async () => {
    // Issue #307: the add flow now buffers progress events that arrive before
    // the id is known. Once the id resolves, our events replay in order and
    // the progress callback fires immediately rather than being lost.
    const registered = deferred<string>()
    const onProgress = vi.fn()
    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      onProgress
    })

    // Progress arrives before the id.
    await emit('progress', {
      operationId: 'op-mine',
      bytesSent: 50,
      totalBytes: 100,
      percentage: 50
    })
    expect(onProgress).not.toHaveBeenCalled()

    // Id resolves - our buffered progress replays.
    registered.resolve('op-mine')
    await Promise.resolve()
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'op-mine', percentage: 50 })
    )

    // Complete normally.
    await emit('complete', { operationId: 'op-mine', video })
    await expect(outcome).resolves.toEqual({ kind: 'complete', video })
  })
})

describe('awaitUploadOutcome - buffering', () => {
  it('replays buffered progress then completion in order once the id is known', async () => {
    const registered = deferred<string>()
    const onProgress = vi.fn()
    const order: string[] = []

    const outcome = awaitUploadOutcome({
      start: () => registered.promise,
      onProgress: event => {
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
      start: () => registered.promise
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
