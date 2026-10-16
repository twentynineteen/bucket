/**
 * Built-in template loader (issue #327)
 *
 * Loads every JSON file in `internal/templates/` at build time via
 * `import.meta.glob({ eager: true })`, parses each through the schema, and
 * returns the valid ones. Returns [] while the folder is empty.
 *
 * Ownership passes to #332 once starter templates are added.
 */
import type { MotionTemplate } from '../types'
import { parseTemplate } from './schema'

const modules: Record<string, unknown> = import.meta.glob('./templates/*.json', {
  eager: true
})

/**
 * Load all valid built-in templates from the bundled JSON files.
 * Invalid files are silently skipped (the catalogue hooks report issues).
 */
export function loadBuiltins(): MotionTemplate[] {
  const templates: MotionTemplate[] = []

  for (const [, mod] of Object.entries(modules)) {
    // Vite eager JSON imports expose the parsed object as `default`
    const json =
      mod && typeof mod === 'object' && 'default' in mod
        ? (mod as Record<string, unknown>).default
        : mod
    const result = parseTemplate(json)
    if (result.success) {
      templates.push(result.data)
    }
  }

  return templates
}
