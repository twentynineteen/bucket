// // @ts-check
// // Docs: https://eslint.org/docs/user-guide/configuring

// import eslint from '@eslint/js'
// import prettierConfig from 'eslint-config-prettier'
// import tseslint from 'typescript-eslint'

// export default tseslint.config(
//   eslint.configs.recommended,
//   ...tseslint.configs.recommendedTypeChecked,
//   {
//     languageOptions: {
//       parserOptions: {
//         ecmaVersion: 2022,
//         sourceType: 'module',
//         project: ['./tsconfig.json', './vite.config.ts'],
//         tsconfigRootDir: import.meta.dirname
//       }
//     }
//   },
//   prettierConfig
// )

import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import bucket from './eslint-rules/index.js'

const FEATURE_DEEP_IMPORT = {
  group: ['@features/*/**'],
  message: 'Import other features through their barrel: @features/<Name>.'
}

const LIB_SUBPATH_IMPORT = {
  group: ['@shared/lib/*'],
  message: 'Import shared/lib through its barrel: @shared/lib.'
}

const NEW_QUERY_CLIENT = {
  selector: 'NewExpression[callee.name="QueryClient"]',
  message:
    'Use createQueryClient() from @shared/lib, so the app runs the client its tests cover (#300).'
}

export default tseslint.config(
  // Generated bindings are checked for freshness by a Rust test, not styled.
  { ignores: ['dist', '**/*.generated.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // DEBT-005: Prevent console statements - use logger utility instead
      'no-console': 'error',
      // Code quality rules to prevent technical debt accumulation
      // Set to 'warn' initially to identify issues without blocking development
      // Can be changed to 'error' once existing issues are resolved
      complexity: ['warn', { max: 15 }], // Target: 10, current max: 40
      'max-depth': ['warn', { max: 5 }], // Target: 4, current max: 8
      'max-params': ['warn', { max: 6 }] // Target: 5, current max: 13
    }
  },
  // Module boundary enforcement (eslint-plugin-boundaries)
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      },
      'boundaries/elements': [
        {
          type: 'app',
          pattern: [
            'src/App.tsx',
            'src/AppRouter.tsx',
            'src/index.tsx',
            'src/app/dashboard/page.tsx'
          ],
          mode: 'file'
        },
        {
          type: 'feature',
          pattern: ['src/features/*'],
          capture: ['featureName']
        },
        {
          type: 'shared',
          pattern: ['src/shared/*'],
          capture: ['sharedModule']
        },
        {
          type: 'legacy',
          pattern: [
            'src/pages/**',
            'src/hooks/**',
            'src/components/**',
            'src/store/**',
            'src/utils/**',
            'src/constants/**',
            'src/services/**',
            'src/machines/**',
            'src/context/**',
            'src/lib/**',
            'src/types/**'
          ]
        }
      ],
      'boundaries/ignore': ['**/*.test.*', '**/*.spec.*', '**/*.d.ts', '**/*.css']
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['feature'],
              allow: ['shared']
            },
            {
              // Features can import other features -- barrel-only restriction
              from: ['feature'],
              allow: [['feature', { featureName: '!${featureName}' }]]
            },
            {
              from: ['shared'],
              disallow: ['feature'],
              importKind: 'value'
            }
          ]
        }
      ],
      // All boundary rules at error severity -- violations fail lint
      'boundaries/no-unknown-files': ['error'],
      'boundaries/no-unknown': ['error']
    }
  },
  // Module conventions (CLAUDE.md, "Module rules"). A later block replaces an
  // earlier block's options for the same rule, so each file group below lists
  // every pattern or selector that applies to it.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*', '**/__contracts__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [FEATURE_DEEP_IMPORT, LIB_SUBPATH_IMPORT] }
      ],
      'no-restricted-syntax': ['error', NEW_QUERY_CLIENT]
    }
  },
  {
    // shared/lib's own modules and tests may reach its sub-modules directly.
    files: ['src/shared/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [FEATURE_DEEP_IMPORT] }]
    }
  },
  {
    // The one place a QueryClient is constructed (#300).
    files: ['src/shared/lib/query-client-config.ts'],
    rules: { 'no-restricted-syntax': 'off' }
  },
  {
    // Tests may deep-import features (e.g. internals under test), but consume
    // shared/lib through its barrel like everyone else.
    files: [
      'tests/**/*.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'src/**/__contracts__/**/*.{ts,tsx}'
    ],
    ignores: ['src/shared/lib/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [LIB_SUBPATH_IMPORT] }]
    }
  },
  {
    files: ['src/**/index.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NEW_QUERY_CLIENT,
        {
          selector: 'ExportAllDeclaration',
          message: 'Barrels use named re-exports, each with a JSDoc line, not export *.'
        }
      ]
    }
  },
  {
    files: ['src/shared/ui/**/index.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message:
            'shared/ui has no barrel files. Import each component directly, e.g. @shared/ui/button.'
        }
      ]
    }
  },
  // tests/ is linted only for the rules below, so its disable comments for the
  // full rule set would all report as unused.
  {
    files: ['tests/**'],
    linterOptions: { reportUnusedDisableDirectives: 'off' }
  },
  // Mechanical rules from the testing policy (CODING_STANDARDS.md, "Testing")
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/__contracts__/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}'
    ],
    languageOptions: { parser: tseslint.parser },
    plugins: { bucket, '@typescript-eslint': tseslint.plugin },
    rules: {
      'bucket/vi-mock-resolves': 'error',
      'bucket/no-export-count': 'error'
    }
  }
)
