/**
 * Auth Contract Tests
 *
 * Verifies the shape and behavior of the Auth feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as authBarrel from '../index'

const projectRoot = path.resolve(__dirname, '../../../../')

function getFilesRecursive(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
      files.push(...getFilesRecursive(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

// --- Shape Tests ---

describe('Auth Barrel Exports - Shape', () => {
  it('exports AuthProvider as a function', () => {
    expect(typeof authBarrel.AuthProvider).toBe('function')
  })

  it('exports useAuth as a function', () => {
    expect(typeof authBarrel.useAuth).toBe('function')
  })
})

// --- Behavioral Tests ---

describe('useAuth - Behavior', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => authBarrel.useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })
})

// --- No-Bypass Tests ---

describe('Auth Module - No Direct Plugin Imports', () => {
  const modulePath = path.resolve(projectRoot, 'src/features/Auth')

  it('all non-api.ts files have zero direct @tauri-apps imports', () => {
    const allFiles = getFilesRecursive(modulePath, ['.ts', '.tsx'])
    const nonApiFiles = allFiles.filter((f) => !f.endsWith('/api.ts'))
    for (const file of nonApiFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
      expect(tauriImports).toEqual([])
    }
  })
})

// --- No Calls To Removed Backend Commands ---

// `add_token` and `check_auth` were removed from the Rust crate (issue #199).
// An invoke of a command the backend does not register throws at runtime, so
// re-introducing a call site would break the app for a user, not just a test.
describe('Auth Module - Removed Backend Commands', () => {
  const removedCommands = ['add_token', 'check_auth']

  it('no source file references the removed auth commands', () => {
    const sourceFiles = getFilesRecursive(path.resolve(projectRoot, 'src'), [
      '.ts',
      '.tsx'
    ])

    const offenders = sourceFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8')
      return removedCommands.some((command) => content.includes(command))
    })

    expect(offenders).toEqual([])
  })
})
