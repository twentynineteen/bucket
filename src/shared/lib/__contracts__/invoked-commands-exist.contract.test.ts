/**
 * Every invoked Tauri command exists in `generate_handler![...]` (issue #222)
 *
 * A command name is a string on both sides of the IPC boundary with no shared
 * type. `tsc` sees a string literal, eslint sees a string literal, and rustc
 * sees at most a function nobody calls. With typecheck gated in CI since #178,
 * a misspelled or removed command name is one of the very few ways left to write
 * a guaranteed runtime failure that passes every check in the repo - it fails in
 * the user's hands, as a rejected promise.
 *
 * Two existing contract tests look like they cover this and do not.
 * `no-feature-command-bypass` asserts an ownership rule: nothing under
 * `src/shared` invokes a feature-owned command. `tauri-ipc` checks argument
 * shapes but does `if (!command) continue` on any name it cannot locate, so the
 * case this file is about is precisely the case it skips.
 *
 * Both sides are read off disk through `internal/tauri-command-surface`, shared
 * with those two tests, because a hand-maintained list of command names would be
 * the fifth registry in this repo that only works while somebody remembers to
 * update it (#171, #200, #202, #208).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  REPO_ROOT,
  handledCommandsIn,
  invokeSites,
  invokeSitesIn,
  registeredCommands,
  walkFiles,
  type InvokeSite
} from './internal/tauri-command-surface'

/**
 * Commands registered in `generate_handler![...]` that no TypeScript file
 * invokes. Unreachable from the app: dead weight in the binary, and a name a
 * reader will assume is live.
 *
 * Asserted in BOTH directions below, which is what makes it an inventory rather
 * than an exemption list. A one-directional skip rots into a permanent hole -
 * the lesson of `feature-api-boundary.contract.test.ts`.
 *
 * The docx trio is not a path not yet built, it is a superseded one:
 * `ScriptFormatter/hooks/useDocxParser.ts` parses .docx with mammoth.js in the
 * frontend and never calls Rust. Deleting these from the crate is Rust work and
 * wants its own issue; naming them here stops the list growing in the meantime.
 */
const UNINVOKED_COMMANDS = new Set([
  'open_resource_file',
  'parse_docx_file',
  'generate_docx_file',
  'validate_docx_file',
  'validate_provider_connection',
  'validate_provider_with_auth',
  'get_example_by_id',
  'get_all_examples',
  'check_plugin_installed',
  'get_cep_directory',
  'enable_cep_debug_mode'
])

/** The rule itself, over any set of call sites. Shared with the fixture below. */
function unregisteredCommands(sites: InvokeSite[], registered: string[]): string[] {
  const known = new Set(registered)

  return sites
    .filter((site) => site.kind === 'static' && !known.has(site.command))
    .map(
      (site) =>
        `${site.file}:${site.line} invokes '${site.command}', which is not in ` +
        'generate_handler![...] in src-tauri/src/main.rs'
    )
}

describe('every invoked Tauri command is registered in the Rust handler list', () => {
  const registered = registeredCommands()
  const sites = invokeSites()
  const invoked = new Set(
    sites.filter((site) => site.kind === 'static').map((site) => site.command)
  )

  it('reads both sides of the boundary (guards a vacuous pass)', () => {
    // Without this, a wrong REPO_ROOT or a broken extractor would make every
    // assertion below pass by comparing two empty sets.
    //
    // Floors and named anchors, not a census. A hardcoded total is the
    // export-count antipattern: it would fail on every command legitimately
    // added, and the counts move whenever a feature lands.
    expect(registered.length).toBeGreaterThan(40)
    expect(registered).toContain('get_username')
    expect(registered).toContain('kavanagh_run_check')

    expect(invoked.size).toBeGreaterThan(30)
    expect(invoked).toContain('get_username')
    expect(invoked).toContain('get_folders')
  })

  it('every invoked command name appears in generate_handler!', () => {
    expect(
      unregisteredCommands(sites, registered),
      'Tauri resolves an invoke against generate_handler![...] alone. A name missing ' +
        'from it fails at runtime as a rejected promise, with nothing in the toolchain ' +
        'to catch it first. Register the command, or fix the name.'
    ).toEqual([])
  })

  it('no command name is built at runtime, where no static check could reach it', () => {
    // The point is that an unreadable invoke is a hole in this guard, so it is
    // reported rather than skipped. `tauri-ipc.contract.test.ts` skipping the
    // names it could not resolve is how it went blind to this whole bug class.
    const unreadable = sites
      .filter((site) => site.kind === 'dynamic')
      .map((site) => `${site.file}:${site.line} invokes ${site.expression}`)

    expect(
      unreadable,
      'This guard cannot verify a command name it cannot read. Pass a literal, or ' +
        'narrow the call site to a union of literals it can enumerate.'
    ).toEqual([])
  })

  it('reads every invoke form in this tree, and reports the ones it cannot (fixture)', () => {
    // Proved against a fixture rather than against a real module. A guard whose
    // proof is a real defect stops working the moment the defect is fixed, which
    // is what happened to the boundary test in #207/#208.
    const dir = mkdtempSync(join(tmpdir(), 'invoked-commands-exist-'))
    const write = (name: string, source: string) => {
      const file = join(dir, name)
      writeFileSync(file, source)
      return file
    }

    try {
      const forms = write(
        'forms.ts',
        [
          "await invoke('bare_form')",
          "await core.invoke<string>('qualified_generic_form', { apiKey })",
          'await invoke(`template_form`)',
          "await invoke('plugin:fs|exists', { path })",
          'await invoke(commandFromAVariable)',
          'await invoke(`kavanagh_${suffix}`)',
          "import { invoke } from '@tauri-apps/api/core'",
          'const spy = vi.mocked(invoke)'
        ].join('\n')
      )

      const found = invokeSitesIn([forms])

      expect(found.map((site) => [site.kind, site.expression])).toEqual([
        ['static', 'bare_form'],
        ['static', 'qualified_generic_form'],
        ['static', 'template_form'],
        ['plugin', 'plugin:fs|exists'],
        ['dynamic', 'commandFromAVariable'],
        ['dynamic', '`kavanagh_${suffix}`']
      ])

      // A payload offset only where a payload was actually passed.
      expect(found.map((site) => site.payloadStart !== null)).toEqual([
        false,
        true,
        false,
        true,
        false,
        false
      ])

      // The rule flags the unregistered name and leaves the plugin name alone.
      const violations = unregisteredCommands(found, ['bare_form', 'template_form'])
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('qualified_generic_form')
      expect(violations.join('\n')).not.toContain('plugin:fs')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('every registered command has a caller, or is listed as unreachable', () => {
    const unreachable = registered
      .filter((command) => !invoked.has(command))
      .filter((command) => !UNINVOKED_COMMANDS.has(command))

    expect(
      unreachable,
      'These commands are registered but nothing invokes them. Wire them up, delete ' +
        'them from the crate, or add them to UNINVOKED_COMMANDS with a reason.'
    ).toEqual([])
  })

  it('the unreachable list names only commands that are still unreachable', () => {
    const nowInvoked = [...UNINVOKED_COMMANDS].filter((command) => invoked.has(command))

    expect(
      nowInvoked,
      'These commands now have a caller. Delete them from UNINVOKED_COMMANDS.'
    ).toEqual([])
  })

  it('the unreachable list names only commands that are actually registered', () => {
    // #200 found the E2E fixture answering `check_authentication`, a command that
    // has never existed. A list naming a command the crate no longer registers is
    // the same lie in a different place.
    const notRegistered = [...UNINVOKED_COMMANDS].filter(
      (command) => !registered.includes(command)
    )

    expect(
      notRegistered,
      'These are not in generate_handler![...] at all. Delete them from UNINVOKED_COMMANDS.'
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// E2E fixture guard: every handled command exists (issue #241)
// ---------------------------------------------------------------------------

/**
 * Commands the IPC envelope uses. `case 'tauri':` in a fixture routes into a
 * nested dispatch for `plugin:path|...` etc. - it is the IPC wrapper itself,
 * not a command registered in `generate_handler!`.
 */
const ENVELOPE_COMMANDS = new Set(['tauri'])

describe('E2E fixtures handle only commands that exist in the Rust handler list', () => {
  const registered = registeredCommands()
  const fixtureDir = join(REPO_ROOT, 'tests/e2e/fixtures')
  const fixtureFiles = walkFiles(fixtureDir, /\.tsx?$/)
  const handled = handledCommandsIn(fixtureFiles)

  it('reads the fixture surface (guards a vacuous pass)', () => {
    // Without this, a wrong path or a broken extractor makes every assertion
    // below pass by comparing against an empty list.
    expect(fixtureFiles.length).toBeGreaterThan(2)
    expect(handled.length).toBeGreaterThan(10)
    expect(handled.map((h) => h.command)).toContain('get_username')
  })

  it('every static command a fixture handles is registered in generate_handler!', () => {
    const known = new Set(registered)

    const phantoms = handled
      .filter((h) => h.kind === 'static')
      .filter((h) => !ENVELOPE_COMMANDS.has(h.command))
      .filter((h) => !known.has(h.command))
      .map(
        (h) =>
          `${h.file}:${h.line} handles '${h.command}', which is not in ` +
          'generate_handler![...] in src-tauri/src/main.rs'
      )

    expect(
      phantoms,
      'A mock that answers a command the backend does not have implies a contract ' +
        'that does not exist. Any test relying on it is testing nothing. Remove the ' +
        'handler, or register the command in the crate.'
    ).toEqual([])
  })

  it('reads case labels and cmd comparisons from fixture source (extractor fixture)', () => {
    // Proves the extractor reads both patterns the E2E fixtures use:
    // `case 'label':` from switch statements and `cmd === 'literal'` from if chains.
    const dir = mkdtempSync(join(tmpdir(), 'handled-commands-'))
    const file = join(dir, 'mock.ts')

    try {
      writeFileSync(
        file,
        [
          'switch (cmd) {',
          "  case 'baker_start_scan':",
          "    return 'scan-1'",
          "  case 'plugin:fs|exists':",
          '    return true',
          "  case 'tauri':",
          '    return null',
          '}',
          "if (cmd === 'get_username') return 'test'",
          "if (cmd === 'plugin:path|join') return '/'",
          // Should NOT match: different variable, not cmd
          "if (windowCmd === 'outer_position') return { x: 0, y: 0 }"
        ].join('\n')
      )

      const found = handledCommandsIn([file])

      expect(found.map((h) => [h.kind, h.command])).toEqual([
        ['static', 'baker_start_scan'],
        ['plugin', 'plugin:fs|exists'],
        ['static', 'tauri'],
        ['static', 'get_username'],
        ['plugin', 'plugin:path|join']
      ])

      // windowCmd comparisons are not extracted.
      expect(found.map((h) => h.command)).not.toContain('outer_position')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
