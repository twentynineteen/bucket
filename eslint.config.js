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
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
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
  }
)
