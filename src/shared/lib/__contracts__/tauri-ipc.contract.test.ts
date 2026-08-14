/**
 * TS <-> Rust Tauri IPC argument contract (issue #155)
 *
 * This exists because of a bug class that cannot fail loudly at runtime.
 *
 * `tauri-macros` rewrites every command argument name with `to_lower_camel_case`
 * and bakes it into the command's `CommandItem { key }`. Resolution is a single
 * `v.get(self.key)` with **no snake_case fallback**. So a mistyped or
 * wrong-cased key does not error -- for an `Option<T>` parameter it calls
 * `visit_none()` and binds `None`, and the command runs with a silently missing
 * argument.
 *
 * That is exactly what happened to `get_folders`: the frontend sent `parent_id`
 * where the command expected `folderId`, so every folder listing returned the
 * account root for every user, undetected, for as long as the code existed.
 *
 * Unit tests cannot catch this -- they mock `invoke`, so they only ever pin one
 * side of the contract. This test reads both sides off disk and compares them.
 *
 * It says nothing about whether an invoked command EXISTS: a name it cannot find
 * in `commands/` is skipped as somebody else's business. That skip is why it was
 * blind to a whole class of runtime failure, which `invoked-commands-exist`
 * (#222) now covers. The tree walk and the invoke scanner are shared with it via
 * `internal/tauri-command-surface`.
 */
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  REPO_ROOT,
  RUST_COMMANDS_DIR,
  invokeSites as scanInvokeSites,
  walkFiles
} from './internal/tauri-command-surface'

/**
 * Parameter types Tauri injects itself -- they never appear in the JS payload.
 * Matched against the parameter's TYPE, not its name.
 */
const INJECTED_TYPE =
  /^(?:tauri::)?(?:AppHandle|Window|WebviewWindow|State\s*<|Channel\s*<|ipc::)/

function toLowerCamelCase(snake: string): string {
  // Mirrors heck's to_lower_camel_case, which is what tauri-macros applies.
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/** Splits a Rust parameter list on top-level commas (generics contain commas). */
function splitParams(params: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const char of params) {
    if (char === '<' || char === '(' || char === '[') depth++
    if (char === '>' || char === ')' || char === ']') depth--
    if (char === ',' && depth === 0) {
      out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) out.push(current)
  return out
}

interface RustCommand {
  name: string
  /** Argument keys the JS side must use, already camelCased. */
  expectedKeys: Set<string>
  /** Keys whose Rust type is not Option<...>, so omitting them is an error. */
  requiredKeys: Set<string>
  file: string
}

function parseRustCommands(): Map<string, RustCommand> {
  const commands = new Map<string, RustCommand>()

  for (const file of walkFiles(RUST_COMMANDS_DIR, /\.rs$/)) {
    const source = readFileSync(file, 'utf8')
    const pattern =
      /#\[(?:tauri::)?command\][\s\S]{0,200}?\bfn\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?:->|\{)/g

    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      const [, name, rawParams] = match
      const expectedKeys = new Set<string>()
      const requiredKeys = new Set<string>()

      for (const param of splitParams(rawParams)) {
        const colon = param.indexOf(':')
        if (colon === -1) continue

        const paramName = param
          .slice(0, colon)
          .trim()
          .replace(/^mut\s+/, '')
        const paramType = param.slice(colon + 1).trim()
        if (!paramName || INJECTED_TYPE.test(paramType)) continue

        const key = toLowerCamelCase(paramName)
        expectedKeys.add(key)
        if (!/^Option\s*</.test(paramType)) requiredKeys.add(key)
      }

      commands.set(name, {
        name,
        expectedKeys,
        requiredKeys,
        file: relative(REPO_ROOT, file)
      })
    }
  }

  return commands
}

interface InvokeSite {
  command: string
  keys: string[]
  /** True when the payload is a variable/spread we cannot read statically. */
  opaque: boolean
  file: string
}

/**
 * Reads the top-level keys of the object literal starting at `start`.
 *
 * Only positions where a key may legally appear are inspected -- the start of
 * the literal and just after a top-level comma. Scanning every depth-1 token
 * instead would read VALUES as keys: `{ title: title ?? null }` would yield
 * `null`, and `{ newTitle: projectName }` would yield `projectName`.
 *
 * Returns null when the payload cannot be read statically (a spread, a
 * computed key), so the caller can skip rather than guess.
 */
function readObjectKeys(source: string, start: number): string[] | null {
  const keys: string[] = []
  let depth = 0
  let expectingKey = true

  for (let i = start; i < source.length; i++) {
    const char = source[i]

    // Skip string and template literals wholesale -- their contents are never
    // keys, and an apostrophe inside one would otherwise desynchronise us.
    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      i++
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++
        i++
      }
      continue
    }

    if (char === '{' || char === '[' || char === '(') {
      depth++
      continue
    }
    if (char === '}' || char === ']' || char === ')') {
      depth--
      if (depth === 0) return keys
      continue
    }

    if (depth !== 1 || /\s/.test(char)) continue

    if (char === ',') {
      expectingKey = true
      continue
    }
    if (!expectingKey) continue

    if (source.startsWith('...', i)) return null

    const rest = source.slice(i)
    const explicit = /^([A-Za-z_$][\w$]*)\s*:/.exec(rest)
    if (explicit) {
      keys.push(explicit[1])
      expectingKey = false
      i += explicit[0].length - 1
      continue
    }

    const shorthand = /^([A-Za-z_$][\w$]*)\s*(?=[,}])/.exec(rest)
    if (shorthand) {
      keys.push(shorthand[1])
      expectingKey = false
      i += shorthand[1].length - 1
      continue
    }

    // Anything else in key position (a computed key, a call) is unreadable.
    return null
  }
  return null
}

function parseInvokeSites(): InvokeSite[] {
  const sites: InvokeSite[] = []

  for (const site of scanInvokeSites()) {
    // A plugin-routed name has no signature in `commands/`, and a runtime-built
    // one has no name to look up. `invoked-commands-exist` fails on the latter,
    // so dropping it here does not leave it unwatched.
    if (site.kind !== 'static') continue

    const { command, file, payloadStart, source } = site

    if (payloadStart === null) {
      sites.push({ command, keys: [], opaque: false, file })
      continue
    }

    if (source[payloadStart] !== '{') {
      sites.push({ command, keys: [], opaque: true, file })
      continue
    }

    const keys = readObjectKeys(source, payloadStart)
    if (keys === null) sites.push({ command, keys: [], opaque: true, file })
    else sites.push({ command, keys, opaque: false, file })
  }

  return sites
}

describe('Tauri IPC argument contract', () => {
  const commands = parseRustCommands()
  const sites = parseInvokeSites()

  it('parses both sides (guards against a vacuously passing rule)', () => {
    // If either parser breaks, every assertion below would silently pass.
    expect(commands.size).toBeGreaterThan(20)
    expect(sites.length).toBeGreaterThan(20)

    const getFolders = commands.get('get_folders')
    expect(getFolders?.expectedKeys).toEqual(new Set(['apiKey', 'parentId']))
    // app_handle is injected by Tauri and must never appear in the payload.
    expect(commands.get('upload_video')?.expectedKeys.has('appHandle')).toBe(false)
  })

  it('every invoked argument key matches a real command parameter', () => {
    const violations: string[] = []

    for (const site of sites) {
      if (site.opaque) continue
      const command = commands.get(site.command)
      if (!command) continue // command defined outside commands/ -- not our business

      for (const key of site.keys) {
        if (command.expectedKeys.has(key)) continue

        const snakeGuess = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
        const hint = command.expectedKeys.has(toLowerCamelCase(snakeGuess))
          ? ` -- did you mean '${toLowerCamelCase(snakeGuess)}'? Tauri camelCases arguments and has no snake_case fallback.`
          : ` -- '${site.command}' accepts [${[...command.expectedKeys].join(', ')}]`

        violations.push(`${site.file}: invoke('${site.command}', { ${key} })${hint}`)
      }
    }

    expect(violations).toEqual([])
  })

  it('every required (non-Option) command parameter is supplied', () => {
    // A missing Option binds to None silently; a missing required parameter is
    // at least an error, but catching it here beats catching it at runtime.
    const violations: string[] = []

    for (const site of sites) {
      if (site.opaque) continue
      const command = commands.get(site.command)
      if (!command) continue

      for (const required of command.requiredKeys) {
        if (!site.keys.includes(required)) {
          violations.push(
            `${site.file}: invoke('${site.command}') omits required '${required}'`
          )
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('pins the exact regression from #155', () => {
    // get_folders took `folder_id` and the frontend sent `parent_id`; neither
    // matched the expected `folderId`, so the argument bound to None.
    const getFolders = commands.get('get_folders')

    expect(getFolders?.expectedKeys.has('parentId')).toBe(true)
    expect(getFolders?.expectedKeys.has('folderId')).toBe(false)

    const callSites = sites.filter((site) => site.command === 'get_folders')
    expect(callSites.length).toBeGreaterThan(0)
    for (const site of callSites) {
      expect(site.keys).toContain('parentId')
      expect(site.keys).not.toContain('parent_id')
    }
  })
})
