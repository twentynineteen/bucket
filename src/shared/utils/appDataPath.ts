/**
 * Resolving files inside the app data directory, and relocating the ones an
 * earlier build put beside it (issue #167).
 *
 * `appDataDir()` returns no trailing separator, so `${dir}${file}` produced
 * `…/com.bucket-app.devapi_keys.json` -- a sibling of the app data directory
 * rather than a child. Reads and writes shared that expression, so the app
 * worked and the fault stayed invisible; correcting the join without moving
 * the files would have orphaned every user's settings.
 *
 * Resolution is lazy and per file: whoever asks for the path first performs
 * the move. That keeps the migration in the modules that own these files, and
 * means it always precedes the startup prefetch that reads api_keys.json.
 */
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, remove, rename, stat } from '@tauri-apps/plugin-fs'

import { logger } from './logger'

/**
 * Resolved paths, memoised for the session so the probe runs once.
 *
 * Holds the in-flight promise as well as the settled value, so concurrent
 * callers -- the startup prefetch racing an open Settings page -- share one
 * migration rather than each attempting the move.
 *
 * A failed migration is deliberately evicted rather than cached: a disk busy
 * for a moment at boot must not pin the whole session to the old location.
 */
const resolved = new Map<string, Promise<string>>()
const sweptResidue = new Map<string, Promise<void>>()

/** Whether the path is a regular file we may move or delete. */
async function isRegularFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isFile
  } catch (error) {
    // Unreadable metadata is not permission to touch it.
    logger.error(`Could not stat ${path}:`, error)
    return false
  }
}

/**
 * The path the buggy expression produced. Computing it means reproducing the
 * bug on purpose, which is safe only alongside the identity check in
 * resolveAppDataFile: were appDataDir to gain a trailing separator, this would
 * *be* the correct path.
 */
function misplacedSibling(dir: string, filename: string): string {
  return `${dir}${filename}`
}

async function migrateAndResolve(filename: string): Promise<string> {
  const dir = await appDataDir()
  const correct = await join(dir, filename)
  const misplaced = misplacedSibling(dir, filename)

  // Nothing to migrate, and moving it would destroy the real file.
  if (misplaced === correct) return correct

  let strayExists: boolean
  try {
    strayExists = await exists(misplaced)
  } catch (error) {
    // A probe that cannot run is not evidence that a stray file exists.
    logger.error(`Could not probe ${misplaced}:`, error)
    return correct
  }
  if (!strayExists) return correct

  // A directory here belongs to something else -- an app whose identifier
  // extends ours would create one -- so only regular files are ours to move.
  if (!(await isRegularFile(misplaced))) return correct

  // rename replaces its destination, so the destination is checked first.
  try {
    if (await exists(correct)) {
      await remove(misplaced)
      logger.info(`Removed superseded ${misplaced}; ${correct} already exists`)
      return correct
    }
  } catch (error) {
    logger.error(`Could not resolve ${misplaced} against ${correct}:`, error)
    return correct
  }

  try {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true })
    await rename(misplaced, correct)
    logger.info(`Moved ${misplaced} to ${correct}`)
    return correct
  } catch (error) {
    // Keep working against the old location so reads and writes agree. The
    // next call retries.
    logger.error(`Could not move ${misplaced} to ${correct}:`, error)
    throw error
  }
}

/**
 * Path to a file inside the app data directory, relocating any copy an earlier
 * build left beside the directory.
 *
 * Never rejects. If the move fails, the misplaced path is returned so the app
 * keeps working exactly as it did before, and the move is retried on the next
 * call.
 */
export async function resolveAppDataFile(filename: string): Promise<string> {
  const cached = resolved.get(filename)
  if (cached) return cached

  const attempt = migrateAndResolve(filename).catch(async (error) => {
    resolved.delete(filename)
    logger.error(`Falling back to the pre-migration path for ${filename}:`, error)
    return misplacedSibling(await appDataDir(), filename)
  })

  resolved.set(filename, attempt)
  return attempt
}

/**
 * Deletes a misplaced file nothing reads any more (api_key.txt, superseded by
 * api_keys.json). Runs once per session whether or not its live counterpart
 * needed moving, since otherwise it would survive on every machine past its
 * first upgrade.
 *
 * Never rejects: this is housekeeping, and it must not fail the caller's own
 * migration.
 */
export async function removeMisplacedResidue(filename: string): Promise<void> {
  const cached = sweptResidue.get(filename)
  if (cached) return cached

  const attempt = (async () => {
    try {
      const dir = await appDataDir()
      const misplaced = misplacedSibling(dir, filename)
      if (misplaced === (await join(dir, filename))) return
      if (!(await exists(misplaced))) return
      if (!(await isRegularFile(misplaced))) return

      await remove(misplaced)
      logger.info(`Removed orphaned ${misplaced}`)
    } catch (error) {
      logger.error(`Could not remove orphaned ${filename}:`, error)
    }
  })()

  sweptResidue.set(filename, attempt)
  return attempt
}
