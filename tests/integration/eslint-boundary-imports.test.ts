/**
 * Integration test: ESLint boundary rules catch cross-feature deep imports
 *
 * Uses the ESLint Node API to lint synthetic code against the real config.
 * Every case uses a filePath that maps to a real file's location (features,
 * shared) so the boundaries plugin resolves element types correctly.
 *
 * Issue #352 - a relative path into another feature's internals passed lint.
 */
import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const CONFIG = resolve(ROOT, 'eslint.config.js')

/**
 * Lint a snippet as if it lived at the given filePath.
 * Returns only the rule IDs that fired, deduplicated.
 */
async function lintRules(code: string, filePath: string): Promise<string[]> {
  const eslint = new ESLint({ overrideConfigFile: CONFIG, cwd: ROOT })
  const [result] = await eslint.lintText(code, { filePath })
  return [...new Set(result.messages.map(m => m.ruleId).filter(Boolean))] as string[]
}

/** True when at least one boundary-related rule fired. */
async function boundaryError(code: string, filePath: string): Promise<boolean> {
  const rules = await lintRules(code, filePath)
  return rules.some(
    r =>
      r === 'no-restricted-imports' ||
      r === 'boundaries/dependencies' ||
      r === 'boundaries/no-unknown'
  )
}

describe('cross-feature import boundary (#352)', () => {
  // ------------------------------------------------------------------
  // Cases that MUST error
  // ------------------------------------------------------------------

  it('relative ../Other/internal/x: error', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { formatField } from '../Baker/internal/fieldUtils'\n`
    expect(await boundaryError(code, 'src/features/Upload/probe.ts')).toBe(true)
  })

  it('relative ../Other/components/Y: error', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { AddVideoDialog } from '../Baker/components/AddVideoDialog'\n`
    expect(await boundaryError(code, 'src/features/Upload/probe.ts')).toBe(true)
  })

  it('alias @features/Other/internal/x: error', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { formatField } from '@features/Baker/internal/fieldUtils'\n`
    expect(await boundaryError(code, 'src/features/Upload/probe.ts')).toBe(true)
  })

  it('shared importing a feature: error', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { BakerPage } from '@features/Baker'\n`
    expect(await boundaryError(code, 'src/shared/utils/probe.ts')).toBe(true)
  })

  // ------------------------------------------------------------------
  // Cases that MUST pass
  // ------------------------------------------------------------------

  it('same-feature relative import: ok', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { awaitUploadOutcome } from '../internal/awaitUploadOutcome'\n`
    expect(await boundaryError(code, 'src/features/Upload/hooks/probe.ts')).toBe(false)
  })

  it('@features/Other barrel: ok', async () => {
    const code = `// eslint-disable-next-line @typescript-eslint/no-unused-vars\nimport { BakerPage } from '@features/Baker'\n`
    expect(await boundaryError(code, 'src/features/Upload/probe.ts')).toBe(false)
  })
})
