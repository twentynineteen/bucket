#!/usr/bin/env node

/**
 * Version Bump Script
 *
 * Updates version across all project files:
 * - package.json
 * - src-tauri/Cargo.toml
 * - src-tauri/tauri.conf.json
 *
 * Usage:
 *   bun run version:patch  # 0.9.7 → 0.9.8
 *   bun run version:minor  # 0.9.7 → 0.10.0
 *   bun run version:major  # 0.9.7 → 1.0.0
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const bumpType = process.argv[2]

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Error: Invalid bump type')
  console.error('Usage: node bump-version.js [patch|minor|major]')
  process.exit(1)
}

// Read current version from package.json
const packageJsonPath = join(process.cwd(), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const currentVersion = packageJson.version

// Parse semantic version
const [major, minor, patch] = currentVersion.split('.').map(Number)

// Calculate new version
let newVersion
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`
    break
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`
    break
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`
    break
}

console.log(`Bumping version: ${currentVersion} → ${newVersion} (${bumpType})`)

// Update package.json
packageJson.version = newVersion
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
console.log('Updated package.json')

// Update src-tauri/Cargo.toml
const cargoTomlPath = join(process.cwd(), 'src-tauri', 'Cargo.toml')
let cargoToml = readFileSync(cargoTomlPath, 'utf8')
cargoToml = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${newVersion}"`
)
writeFileSync(cargoTomlPath, cargoToml)
console.log('Updated src-tauri/Cargo.toml')

// Update src-tauri/tauri.conf.json
const tauriConfPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json')
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))
tauriConf.version = newVersion
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')
console.log('Updated src-tauri/tauri.conf.json')

// Update Cargo.lock by running cargo check
try {
  console.log('Updating Cargo.lock...')
  execSync('cargo check --manifest-path src-tauri/Cargo.toml', {
    stdio: 'pipe',
    cwd: process.cwd()
  })
  console.log('Updated Cargo.lock')
} catch (error) {
  console.warn('Warning: Failed to update Cargo.lock automatically')
  console.warn('   Run `cargo check` manually in src-tauri/')
}

// Git commit
try {
  execSync('git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json', {
    stdio: 'pipe'
  })

  const commitMessage = `chore: bump version to ${newVersion}`
  execSync(`git commit -m "${commitMessage}"`, {
    stdio: 'pipe'
  })

  console.log(`Committed version bump: "${commitMessage}"`)
  console.log('')
  console.log('Next steps:')
  console.log('   1. Push to master: git push origin master')
  console.log('   2. Create release PR: gh pr create --base release --head master')
} catch (error) {
  console.log('Note: No git commit created (changes may already be staged)')
  console.log('   Review changes and commit manually if needed')
}

console.log('')
console.log(`Version bumped successfully: ${currentVersion} → ${newVersion}`)
