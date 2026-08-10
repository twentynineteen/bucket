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
        'the app listens for this event (src/features/build-project/stages/fileTransfer.ts)'
    ).toBe(true)
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
