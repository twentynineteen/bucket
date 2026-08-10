/**
 * Updater relaunch wiring contract (issue #164)
 *
 * "Restart Now" after an update never restarted the app: the frontend's
 * `relaunch()` call needs the process plugin registered on the Rust side AND
 * a `process:` permission granted in the window capability, and neither
 * existed. The call rejected silently into the manual-restart fallback for as
 * long as the updater has shipped, because a missing plugin/permission is a
 * runtime rejection, not a build error.
 *
 * These scans pin the wiring so it cannot silently disappear again:
 *
 * - B1.1 -- main.rs registers `tauri_plugin_process::init()`
 * - B1.2 -- the main window capability grants `process:allow-restart`
 * - B1.4 -- the legacy `graceful_restart` command stays deleted (it spawned
 *   the bare Mach-O binary via `current_exe`, the wrong mechanism for
 *   relaunching a macOS .app bundle after an update, and had no callers)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../../..')
const MAIN_RS = join(REPO_ROOT, 'src-tauri/src/main.rs')
const CAPABILITY_FILE = join(REPO_ROOT, 'src-tauri/capabilities/default.json')
const RUST_SRC_DIR = join(REPO_ROOT, 'src-tauri/src')

function walk(dir: string, match: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full, match))
    else if (match.test(entry)) found.push(full)
  }
  return found
}

describe('updater relaunch wiring -- B1.1 process plugin registration', () => {
  it('main.rs registers tauri_plugin_process::init()', () => {
    const mainSource = readFileSync(MAIN_RS, 'utf-8')
    expect(
      /tauri_plugin_process::init\(\)/.test(mainSource),
      'src-tauri/src/main.rs does not register tauri_plugin_process::init() -- ' +
        'without it plugin:process|restart does not exist at runtime and ' +
        'relaunch() after an update rejects into the manual-restart fallback'
    ).toBe(true)
  })
})

describe('updater relaunch wiring -- B1.2 capability permission', () => {
  it('the main window capability grants process:allow-restart', () => {
    const capability = JSON.parse(readFileSync(CAPABILITY_FILE, 'utf-8')) as {
      permissions: Array<string | { identifier: string }>
    }
    const identifiers = capability.permissions.map((p) =>
      typeof p === 'string' ? p : p.identifier
    )
    // allow-restart is the narrowest grant covering relaunch();
    // process:default would also grant allow-exit, which nothing uses.
    expect(
      identifiers.includes('process:allow-restart') ||
        identifiers.includes('process:default'),
      'src-tauri/capabilities/default.json grants no process permission -- ' +
        'the capability system denies relaunch() even with the plugin registered'
    ).toBe(true)
  })
})

describe('updater relaunch wiring -- B1.4 legacy graceful_restart stays deleted', () => {
  it('no Rust source references graceful_restart', () => {
    const offenders = walk(RUST_SRC_DIR, /\.rs$/)
      .filter((file) => readFileSync(file, 'utf-8').includes('graceful_restart'))
      .map((file) => file.slice(REPO_ROOT.length + 1))
    expect(
      offenders,
      `graceful_restart still referenced in: ${offenders.join(', ')} -- ` +
        'it spawns the bare binary instead of reopening the .app bundle; ' +
        'post-update restarts must go through the process plugin relaunch()'
    ).toEqual([])
  })

  it('no frontend source invokes graceful_restart', () => {
    const offenders = walk(join(REPO_ROOT, 'src'), /\.(ts|tsx)$/)
      .filter((file) => file !== __filename)
      .filter((file) => readFileSync(file, 'utf-8').includes('graceful_restart'))
      .map((file) => file.slice(REPO_ROOT.length + 1))
    expect(offenders, `graceful_restart invoked from: ${offenders.join(', ')}`).toEqual(
      []
    )
  })
})
