/**
 * Built-in template loader (issue #327, updated #332)
 *
 * Loads every JSON file in `internal/templates/` at build time via
 * `import.meta.glob({ eager: true })`, parses each through the schema, and
 * returns the valid ones alongside any parse failures so the catalogue can
 * surface them in `CatalogueIssuesBanner`.
 */
import type { CatalogueIssue, MotionTemplate } from '../types'
import { parseTemplate } from './schema'

const modules: Record<string, unknown> = import.meta.glob('./templates/*.json', {
  eager: true
})

export interface BuiltinLoadResult {
  templates: MotionTemplate[]
  issues: CatalogueIssue[]
}

/**
 * Load all built-in templates from the bundled JSON files.
 *
 * A template that fails to parse is reported as a `CatalogueIssue` rather
 * than silently dropped. The caller (useMotionCatalogue) surfaces these
 * through `CatalogueIssuesBanner`.
 */
export function loadBuiltins(): BuiltinLoadResult {
  const templates: MotionTemplate[] = []
  const issues: CatalogueIssue[] = []

  for (const [path, mod] of Object.entries(modules)) {
    // Vite eager JSON imports expose the parsed object as `default`
    const json =
      mod && typeof mod === 'object' && 'default' in mod
        ? (mod as Record<string, unknown>).default
        : mod
    const result = parseTemplate(json)
    if (result.success) {
      templates.push(result.data)
    } else {
      issues.push({ path, message: `built-in failed to parse: ${result.error}` })
    }
  }

  return { templates, issues }
}
