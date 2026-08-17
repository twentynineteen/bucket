/**
 * E2E Mock Protocol Contract Tests (#161)
 *
 * The Playwright mock layer must speak the same IPC protocol as the real
 * Rust backend (src-tauri/src/build_project/commands.rs). In March the app
 * moved from the legacy `move_files` / `copy_*` protocol to
 * `transfer_files_with_progress` + `file-transfer-progress` /
 * `file-transfer-complete` (#112), but the e2e mocks were never updated, so
 * every mocked transfer stalled at 0% until the stall watchdog aborted it.
 *
 * These tests lock the mock (and the e2e specs that drive it) to the current
 * protocol so the two can never silently diverge again:
 *
 * - B2.1 — the mock contains no legacy command/event names
 * - B2.2 — the mock handles the current commands and event names
 * - B2.3 — no e2e spec references the legacy names
 */

import * as fs from 'fs'
import * as path from 'path'

import { describe, expect, it } from 'vitest'

const E2E_DIR = path.resolve(__dirname, '../e2e')
const MOCK_FILE = path.join(E2E_DIR, 'fixtures/tauri-e2e-mocks.ts')

/** Names from the protocol deleted in #112 — must never reappear */
const LEGACY_NAMES = [
  'move_files',
  'cancel_copy',
  'copy_progress',
  'copy_complete',
  'copy_error',
  'copy_cancelled'
]

/** The protocol the app and Rust backend actually speak */
const CURRENT_COMMANDS = ['transfer_files_with_progress', 'cancel_file_transfer']
const CURRENT_EVENTS = ['file-transfer-progress', 'file-transfer-complete']

/** Recursively collect .ts files under a directory */
function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectTsFiles(full)
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

describe('e2e mock protocol — B2.1 no legacy residue in the mock', () => {
  const mockSource = fs.readFileSync(MOCK_FILE, 'utf-8')

  it.each(LEGACY_NAMES)('tauri-e2e-mocks.ts does not reference `%s`', (name) => {
    expect(
      mockSource.includes(name),
      `tests/e2e/fixtures/tauri-e2e-mocks.ts still references legacy name "${name}" — ` +
        'the app no longer speaks this protocol (#112), simulate ' +
        'transfer_files_with_progress / file-transfer-* instead'
    ).toBe(false)
  })
})

describe('e2e mock protocol — B2.2 mock speaks the current protocol', () => {
  const mockSource = fs.readFileSync(MOCK_FILE, 'utf-8')

  it.each(CURRENT_COMMANDS)('tauri-e2e-mocks.ts handles the `%s` command', (cmd) => {
    expect(
      mockSource.includes(cmd),
      `tests/e2e/fixtures/tauri-e2e-mocks.ts has no handler for "${cmd}" — ` +
        'unknown commands fall through to undefined and the transfer stalls'
    ).toBe(true)
  })

  it.each(CURRENT_EVENTS)('tauri-e2e-mocks.ts emits the `%s` event', (eventName) => {
    expect(
      mockSource.includes(eventName),
      `tests/e2e/fixtures/tauri-e2e-mocks.ts never emits "${eventName}" — ` +
        'the app listens for this event (src/features/BuildProject/api.ts)'
    ).toBe(true)
  })
})

describe('e2e mock protocol — #167 every fixture joins paths for real', () => {
  /**
   * A source grep would pass against `return null` or a constant. Three of
   * these fixtures answered every `plugin:path|*` command with one hardcoded
   * directory, which would have collapsed api_keys.json and the folder index
   * onto a single path -- so each fixture's init script is executed against a
   * fake window and its handler actually invoked. That also proves the handler
   * is reachable given the fixture's if-ordering, not merely present.
   */
  type Invoke = (cmd: string, args?: unknown) => Promise<unknown>

  /** Runs a fixture's setup, capturing the invoke it installs on window. */
  async function captureInvoke(
    setup: (page: never) => Promise<void>
  ): Promise<Invoke> {
    const win: Record<string, unknown> = {}
    const page = {
      addInitScript: async (fn: (arg?: unknown) => void, arg?: unknown) => {
        const originalWindow = globalThis.window
        // The init script closes over `window`, so stand one in for it.
        Object.defineProperty(globalThis, 'window', {
          value: win,
          configurable: true,
          writable: true
        })
        try {
          fn(arg)
        } finally {
          Object.defineProperty(globalThis, 'window', {
            value: originalWindow,
            configurable: true,
            writable: true
          })
        }
      },
      route: async () => {},
      on: () => {},
      goto: async () => {},
      evaluate: async () => {},
      waitForLoadState: async () => {}
    }

    await setup(page as never)

    const internals = win.__TAURI_INTERNALS__ as { invoke?: Invoke } | undefined
    if (!internals?.invoke) {
      throw new Error('fixture installed no __TAURI_INTERNALS__.invoke')
    }
    return internals.invoke
  }

  const FIXTURES: Array<[string, () => Promise<(page: never) => Promise<void>>]> = [
    [
      'tauri-e2e-mocks.ts',
      async () => {
        const mod = await import('../e2e/fixtures/tauri-e2e-mocks')
        return (page: never) => mod.createTauriMock(page).setup()
      }
    ],
    [
      'sprout-folders.fixture.ts',
      async () => {
        const mod = await import('../e2e/fixtures/sprout-folders.fixture')
        return (page: never) => mod.setupSproutMocks(page, { folders: [] })
      }
    ],
    [
      'posterframe-backgrounds.fixture.ts',
      async () => {
        const mod = await import('../e2e/fixtures/posterframe-backgrounds.fixture')
        return (page: never) => mod.installBackgroundMocks(page)
      }
    ],
    [
      'mocks.fixture.ts',
      async () => (await import('../e2e/fixtures/mocks.fixture')).setupTauriMocks
    ]
  ]

  it.each(FIXTURES)(
    '%s answers plugin:path|join by concatenating its segments',
    async (file, load) => {
      const invoke = await captureInvoke(await load())

      const joined = await invoke('plugin:path|join', {
        paths: ['/data/dir', 'api_keys.json']
      })

      expect(
        joined,
        `tests/e2e/fixtures/${file} does not join paths — the app joins the ` +
          'app data directory to a filename (#167), and a constant or absent ' +
          'answer silently merges every settings file onto one path'
      ).toBe('/data/dir/api_keys.json')
    }
  )

  it.each(FIXTURES)('%s resolves the app data directory without a trailing separator', async (file, load) => {
    const invoke = await captureInvoke(await load())

    const dir = (await invoke('plugin:path|resolve_directory', { directory: 13 })) as string

    expect(
      typeof dir === 'string' && dir.length > 0,
      `tests/e2e/fixtures/${file} returns no app data directory — appDataDir() ` +
        'resolves through resolve_directory, not a per-directory command'
    ).toBe(true)
    expect(
      dir.endsWith('/'),
      `tests/e2e/fixtures/${file} returns a trailing separator, which the real ` +
        'appDataDir never does — that fiction is what hid #167'
    ).toBe(false)
  })
})

describe('e2e mock protocol — B2.3 no legacy residue in the e2e specs', () => {
  const specFiles = collectTsFiles(E2E_DIR)

  it('scans a plausible number of e2e files', () => {
    expect(specFiles.length).toBeGreaterThan(5)
  })

  it('no e2e file references any legacy command or event name', () => {
    const offenders: string[] = []
    for (const file of specFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      for (const name of LEGACY_NAMES) {
        if (content.includes(name)) {
          offenders.push(`${path.relative(E2E_DIR, file)} → ${name}`)
        }
      }
    }
    expect(
      offenders,
      `Legacy protocol names found in e2e files:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
