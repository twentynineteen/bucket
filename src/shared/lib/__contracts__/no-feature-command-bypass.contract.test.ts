/**
 * Shared code must not invoke feature-owned Tauri commands (issue #155 §6)
 *
 * `prefetch-strategies.ts` called `invoke('get_folders', ...)` directly from
 * `src/shared/`, which both bypassed the Upload feature's api.ts boundary and
 * inverted the dependency direction. It also cached a different shape under the
 * same query key the feature's own hook uses.
 *
 * The rule is narrow on purpose. A blanket "no @tauri-apps imports under
 * src/shared" would red-line eleven files that legitimately use Tauri, so
 * ownership is derived from the Rust module a command is DEFINED in:
 *
 *   commands/system.rs      -> shared-permitted (e.g. get_username)
 *   commands/sprout_upload.rs, poster_frame.rs, ... -> feature-owned
 *
 * `main.rs`'s `generate_handler![...]` is a flat list with no ownership
 * information, so it cannot answer this on its own.
 *
 * `auth.rs` was also permitted here until #206. It was deleted from the crate by
 * #199, so the entry named a module that no longer existed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../../..')
const SHARED_DIR = join(REPO_ROOT, 'src/shared')
const RUST_COMMANDS_DIR = join(REPO_ROOT, 'src-tauri/src/commands')

/** Rust modules whose commands shared code may call directly. */
const SHARED_PERMITTED_MODULES = new Set(['system.rs'])

function walk(dir: string, match: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, match))
    } else if (match.test(entry)) {
      found.push(full)
    }
  }
  return found
}

/** Maps each `#[command]` fn to the Rust file that defines it. */
function buildCommandOwnership(): Map<string, string> {
  const ownership = new Map<string, string>()

  for (const file of walk(RUST_COMMANDS_DIR, /\.rs$/)) {
    const moduleName = relative(RUST_COMMANDS_DIR, file)
    const source = readFileSync(file, 'utf8')

    // `#[command]` or `#[tauri::command]`, then the fn on a following line
    // (there may be attributes or `pub async` in between).
    const pattern = /#\[(?:tauri::)?command\][\s\S]{0,200}?\bfn\s+([a-z_][a-z0-9_]*)/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      ownership.set(match[1], moduleName)
    }
  }

  return ownership
}

/** Every `invoke('cmd')` form used in this tree: bare, namespaced, generic. */
const INVOKE_PATTERN =
  /(?:^|[^\w.])(?:core\.)?invoke\s*(?:<[^>]*>)?\s*\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g

describe('shared code does not invoke feature-owned Tauri commands', () => {
  const ownership = buildCommandOwnership()

  it('finds the Rust command surface (guards against a silently empty rule)', () => {
    // If the parse breaks, every assertion below would vacuously pass.
    expect(ownership.size).toBeGreaterThan(10)
    expect(ownership.get('get_folders')).toBe('sprout_upload.rs')
    expect(ownership.get('get_username')).toBe('system.rs')
  })

  it('no file under src/shared invokes a feature-owned command', () => {
    const violations: string[] = []
    const seen: string[] = []

    for (const file of walk(SHARED_DIR, /\.tsx?$/)) {
      if (/\.test\.tsx?$|__contracts__/.test(file)) continue

      const source = readFileSync(file, 'utf8')
      INVOKE_PATTERN.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = INVOKE_PATTERN.exec(source)) !== null) {
        const command = match[1]
        seen.push(command)
        const owner = ownership.get(command)
        if (!owner) continue // unknown command name -- not this test's business
        if (SHARED_PERMITTED_MODULES.has(owner)) continue

        violations.push(
          `${relative(REPO_ROOT, file)} invokes '${command}' (owned by commands/${owner})`
        )
      }
    }

    // Proves the scanner actually reads these files. Without this the rule
    // would pass silently if the invoke pattern ever stopped matching.
    expect(seen).toContain('get_username')
    expect(violations).toEqual([])
  })

  it('still allows shared code to call system commands', () => {
    // The rule must not be so broad that it red-lines get_username, which three
    // shared files call legitimately.
    expect(SHARED_PERMITTED_MODULES.has(ownership.get('get_username') as string)).toBe(
      true
    )
  })
})
