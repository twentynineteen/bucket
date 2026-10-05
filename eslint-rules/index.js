/**
 * Repo-local ESLint rules that turn mechanical testing-policy rules
 * (CODING_STANDARDS.md, "Testing") into lint errors.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

// Mirrors the `paths` in tsconfig.json. Keep the two in step.
const ALIASES = {
  '@features/': 'src/features/',
  '@shared/': 'src/shared/',
  '@tests/': 'tests/'
}

const SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.json',
  '/index.ts',
  '/index.tsx',
  '/index.js'
]

function fileExists(base) {
  return SUFFIXES.some(suffix => existsSync(base + suffix))
}

function packageName(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function resolves(specifier, fromFile) {
  if (specifier.startsWith('.')) return fileExists(resolve(dirname(fromFile), specifier))
  const alias = Object.keys(ALIASES).find(prefix => specifier.startsWith(prefix))
  if (alias) return fileExists(join(ROOT, ALIASES[alias] + specifier.slice(alias.length)))
  // Any other `@/` path is the removed alias, not a scoped package.
  if (specifier.startsWith('@/')) return false
  return existsSync(join(ROOT, 'node_modules', packageName(specifier)))
}

const MOCK_METHODS = new Set(['mock', 'doMock', 'unmock', 'doUnmock'])

const viMockResolves = {
  meta: {
    type: 'problem',
    docs: { description: 'vi.mock() must target a module that exists' },
    messages: {
      unresolved:
        "vi.{{method}}('{{specifier}}') does not resolve. A mock of a missing module is silently ignored and the test passes without it."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'vi' ||
          callee.property.type !== 'Identifier' ||
          !MOCK_METHODS.has(callee.property.name)
        ) {
          return
        }
        const [first] = node.arguments
        if (first?.type !== 'Literal' || typeof first.value !== 'string') return
        if (resolves(first.value, context.filename)) return
        context.report({
          node: first,
          messageId: 'unresolved',
          data: { method: callee.property.name, specifier: first.value }
        })
      }
    }
  }
}

function isObjectKeysOfImport(node, context) {
  if (
    node?.type !== 'CallExpression' ||
    node.callee.type !== 'MemberExpression' ||
    node.callee.object.name !== 'Object' ||
    node.callee.property.name !== 'keys' ||
    node.arguments[0]?.type !== 'Identifier'
  ) {
    return false
  }
  const name = node.arguments[0].name
  for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(name)
    if (variable) return variable.defs.some(def => def.type === 'ImportBinding')
  }
  return false
}

const noExportCount = {
  meta: {
    type: 'problem',
    docs: { description: 'Assert named exports, not how many a module has' },
    messages: {
      exportCount:
        'Counting the keys of an imported module breaks on every legitimate new export. Assert the named exports callers use instead.'
    },
    schema: []
  },
  create(context) {
    return {
      // expect(Object.keys(api)).toHaveLength(n)
      // expect(Object.keys(api).length).toBe(n)
      'CallExpression[callee.name="expect"]'(node) {
        const [arg] = node.arguments
        const keysCall =
          arg?.type === 'MemberExpression' && arg.property.name === 'length'
            ? arg.object
            : arg
        if (isObjectKeysOfImport(keysCall, context)) {
          context.report({ node, messageId: 'exportCount' })
        }
      }
    }
  }
}

export default {
  rules: {
    'vi-mock-resolves': viMockResolves,
    'no-export-count': noExportCount
  }
}
