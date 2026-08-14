/**
 * The two sides of the Tauri IPC boundary, read off disk (issue #222)
 *
 * A command name is a string in TypeScript and an identifier in Rust, with no
 * shared type between them. `tsc` sees a string literal, eslint sees a string
 * literal, and rustc sees at most a function nobody calls. The only way to
 * connect them is to read both sides from the filesystem, which three contract
 * tests now need to do.
 *
 * This is the single place that does it. Before #222 the tree walk was written
 * out three times and the invoke matcher twice, in two subtly different forms.
 *
 * The invoke scanner is a token scanner rather than a regex, and that is the
 * point of it. A regex over `invoke\(['"]([a-z_]+)['"]` cannot report the call
 * sites it fails to match, so a command name assembled at runtime simply
 * vanishes from its results - which is how `tauri-ipc.contract.test.ts` came to
 * be blind to the whole class of bug #222 is about. Every call site here comes
 * back classified: readable, plugin-routed, or unreadable and named as such.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** Repo root, resolved from this file's location rather than from cwd. */
export const REPO_ROOT = resolve(__dirname, '../../../../..')

/** Everything the frontend ships. */
const SRC_DIR = join(REPO_ROOT, 'src')

/** Where `#[command]` functions live. */
export const RUST_COMMANDS_DIR = join(REPO_ROOT, 'src-tauri/src/commands')

/** The only file holding `generate_handler![...]`. */
const MAIN_RS = join(REPO_ROOT, 'src-tauri/src/main.rs')

/** Every file under `dir` whose name matches, recursively. */
export function walkFiles(dir: string, match: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walkFiles(full, match))
    else if (match.test(entry)) found.push(full)
  }
  return found
}

/**
 * Source files the app actually ships: no tests, no contract tests.
 *
 * Contract tests are excluded because they contain `invoke('...')` inside string
 * literals and regexes describing the rule, which a scanner reads as real call
 * sites.
 */
function sourceFiles(dir: string = SRC_DIR): string[] {
  return walkFiles(dir, /\.tsx?$/).filter(
    (file) => !/\.test\.tsx?$|__contracts__|__mocks__/.test(file)
  )
}

/**
 * Command names registered in `main.rs`'s `generate_handler![...]`.
 *
 * This is the list Tauri resolves an `invoke` against at runtime. A command
 * function can exist in `commands/` and still be unreachable if it is missing
 * here, so the handler list is the authority, not the `#[command]` attributes.
 */
export function registeredCommands(): string[] {
  const source = readFileSync(MAIN_RS, 'utf8')
  const block = /generate_handler!\s*\[([\s\S]*?)\]/.exec(source)

  // Returning [] would let every caller pass vacuously. Each caller also has a
  // floor assertion, but failing here names the actual cause.
  if (!block) {
    throw new Error(
      `No generate_handler![...] found in ${relative(REPO_ROOT, MAIN_RS)}. ` +
        'If the handler list moved, update MAIN_RS in tauri-command-surface.ts.'
    )
  }

  return block[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '')) // the list is heavily commented
    .flatMap((line) => line.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => /^[a-z_][a-z0-9_]*$/.test(entry))
}

/** How readable a call site's command name is. */
export type InvokeKind =
  /** A static string literal naming a command in `generate_handler![...]`. */
  | 'static'
  /** A `plugin:...` name, routed by a Tauri plugin rather than the handler list. */
  | 'plugin'
  /** Built at runtime, so no static check can resolve it. */
  | 'dynamic'

export interface InvokeSite {
  kind: InvokeKind
  /** The command name, for 'static' and 'plugin'. Empty when 'dynamic'. */
  command: string
  /** The source text in command position. Reports what a 'dynamic' site said. */
  expression: string
  /** Repo-relative path, for failure messages. */
  file: string
  /** 1-based line of the `invoke` token, for failure messages. */
  line: number
  /**
   * Offset of the payload argument's first character, or null when the call
   * passes no payload. Lets a caller parse the argument object without
   * re-scanning for the call site.
   */
  payloadStart: number | null
  /** The whole file, so callers reading the payload need not re-read it. */
  source: string
}

/** Consumes a balanced `<...>` type argument list starting at `start`. */
function skipTypeArguments(source: string, start: number): number {
  let depth = 0
  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (char === '<') depth++
    else if (char === '>') {
      depth--
      if (depth === 0) return i + 1
    } else if (char === ';' || char === '\n') {
      // A type argument list never spans a statement boundary. Bailing keeps a
      // stray `<` from swallowing the rest of the file.
      return start
    }
  }
  return start
}

/** Consumes whitespace and comments from `start`. */
function skipTrivia(source: string, start: number): number {
  let i = start
  for (;;) {
    while (i < source.length && /\s/.test(source[i])) i++
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i)
      i = end === -1 ? source.length : end + 2
      continue
    }
    return i
  }
}

/** Reads the string or template literal at `start`, or null if there is none. */
function readLiteral(
  source: string,
  start: number
): { text: string; interpolated: boolean; end: number } | null {
  const quote = source[start]
  if (quote !== "'" && quote !== '"' && quote !== '`') return null

  let text = ''
  let interpolated = false
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i]
    if (char === '\\') {
      text += source[i + 1] ?? ''
      i++
      continue
    }
    if (char === quote) return { text, interpolated, end: i + 1 }
    if (quote === '`' && char === '$' && source[i + 1] === '{') interpolated = true
    text += char
  }
  return null
}

/** Reads the expression in command position far enough to report it. */
function readOpaqueExpression(source: string, start: number): string {
  let depth = 0
  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (char === '(' || char === '[' || char === '{') depth++
    else if (char === ')' || char === ']' || char === '}') {
      if (depth === 0) return source.slice(start, i).trim()
      depth--
    } else if (char === ',' && depth === 0) return source.slice(start, i).trim()
  }
  return source.slice(start, start + 60).trim()
}

/**
 * The `invoke` token in every form this tree uses: bare, `core.`-qualified, and
 * with or without a type argument. Deliberately does not match `foo.invoke` for
 * some other `foo` - that is a different function.
 */
const INVOKE_TOKEN = /(?:^|[^\w.$])(?:core\.)?invoke\b/g

/** Every `invoke(...)` call site in `files`, each one classified. */
export function invokeSitesIn(files: string[]): InvokeSite[] {
  const sites: InvokeSite[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const rel = relative(REPO_ROOT, file)
    INVOKE_TOKEN.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = INVOKE_TOKEN.exec(source)) !== null) {
      const tokenEnd = match.index + match[0].length

      let cursor = skipTrivia(source, tokenEnd)
      if (source[cursor] === '<') {
        const afterTypes = skipTypeArguments(source, cursor)
        if (afterTypes === cursor) continue // not a call after all
        cursor = skipTrivia(source, afterTypes)
      }

      // `invoke` mentioned but not called: an import, a mock, a re-export.
      if (source[cursor] !== '(') continue
      cursor = skipTrivia(source, cursor + 1)

      const line = source.slice(0, match.index).split('\n').length
      const literal = readLiteral(source, cursor)

      if (!literal || literal.interpolated) {
        sites.push({
          kind: 'dynamic',
          command: '',
          expression: literal
            ? `\`${literal.text}\``
            : readOpaqueExpression(source, cursor),
          file: rel,
          line,
          payloadStart: null,
          source
        })
        continue
      }

      const afterName = skipTrivia(source, literal.end)
      const payloadStart =
        source[afterName] === ',' ? skipTrivia(source, afterName + 1) : null

      sites.push({
        // `plugin:fs|exists` is resolved by the plugin, not generate_handler!.
        kind: literal.text.includes(':') ? 'plugin' : 'static',
        command: literal.text,
        expression: literal.text,
        file: rel,
        line,
        payloadStart,
        source
      })
    }
  }

  return sites
}

/** Every `invoke(...)` call site in the shipped source under `dir`. */
export function invokeSites(dir: string = SRC_DIR): InvokeSite[] {
  return invokeSitesIn(sourceFiles(dir))
}

// ---------------------------------------------------------------------------
// Fixture-side: commands an E2E mock HANDLES
// ---------------------------------------------------------------------------

/**
 * A command name that an E2E mock fixture answers, read from a `case` label in
 * a `switch` statement or a `cmd === '...'` comparison in an `if` chain.
 *
 * The direction is inverted from `InvokeSite`: in `src/`, invoking a command
 * that does not exist is the bug. In a mock fixture, *handling* a command that
 * does not exist is the bug (issue #241). So the extraction looks at the
 * fixture's response table rather than at `invoke()` call sites.
 */
export interface HandledCommand {
  /** 'static' for commands that should be in `generate_handler!`, 'plugin' for plugin-routed. */
  kind: 'static' | 'plugin'
  /** The command name as it appears in the fixture. */
  command: string
  /** Repo-relative path. */
  file: string
  /** 1-based line number. */
  line: number
}

/**
 * Every command name that files in `files` answer via a `case '...':` label
 * or a `cmd === '...'` comparison.
 *
 * `case` labels are matched unconditionally because every fixture's switch is
 * on `cmd`. `===` comparisons are matched only when the left-hand side is the
 * identifier `cmd`, which excludes sub-variables like `windowCmd` or `inner`
 * that compare against fragments rather than full Tauri command names.
 *
 * Classification reuses the same rule as the invoke scanner: a name containing
 * `:` is plugin-routed and exempt from the `generate_handler!` check.
 */
export function handledCommandsIn(files: string[]): HandledCommand[] {
  const commands: HandledCommand[] = []

  /** Two patterns that denote a command name this fixture handles. */
  const CASE_LABEL = /case\s+['"]([^'"]+)['"]\s*:/g
  const CMD_EQUALS = /\bcmd\s*===\s*['"]([^'"]+)['"]/g

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const rel = relative(REPO_ROOT, file)

    const extract = (pattern: RegExp) => {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(source)) !== null) {
        const command = match[1]
        const line = source.slice(0, match.index).split('\n').length
        commands.push({
          kind: command.includes(':') ? 'plugin' : 'static',
          command,
          file: rel,
          line
        })
      }
    }

    extract(CASE_LABEL)
    extract(CMD_EQUALS)
  }

  return commands
}
