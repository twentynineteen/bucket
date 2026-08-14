/**
 * Guards E2E spec discovery (issue #171).
 *
 * The E2E suite used to live under two Playwright configs whose every project
 * declared an explicit `testMatch`. A spec file that matched none of them was
 * not reported, warned about or counted - it simply never ran. Three files were
 * in that state, and adding a fourth was the near-miss in #166.
 *
 * These assertions make that impossible rather than merely unlikely. Discovery
 * has to stay driven by the file layout: a spec dropped anywhere under
 * `tests/e2e/` runs, and a project that matches nothing is a failure rather
 * than a silent pass.
 *
 * Delete this file and a spec can go unexecuted with no signal.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const e2eRoot = path.join(repoRoot, 'tests', 'e2e')

interface ListedTest {
  projectName: string
}
interface ListedSpec {
  file: string
  tests: ListedTest[]
}
interface ListedSuite {
  file?: string
  specs?: ListedSpec[]
  suites?: ListedSuite[]
}
interface ListedProject {
  name: string
}
interface Listing {
  config: { projects: ListedProject[] }
  suites: ListedSuite[]
}

/** Every `*.spec.ts` file under `tests/e2e`, relative to that directory. */
function specFilesOnDisk(dir: string = e2eRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return specFilesOnDisk(full)
    if (!entry.name.endsWith('.spec.ts')) return []
    return [path.relative(e2eRoot, full)]
  })
}

/** Flatten the listing into one entry per resolved test. */
function resolvedTests(listing: Listing): { file: string; project: string }[] {
  const out: { file: string; project: string }[] = []
  const walk = (suites: ListedSuite[] = []) => {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          out.push({ file: spec.file, project: test.projectName })
        }
      }
      walk(suite.suites)
    }
  }
  walk(listing.suites)
  return out
}

/**
 * Resolve the suite the way Playwright will, without launching a browser or the
 * dev server. `--list` reads the config and the spec files and stops there.
 */
function listSuite(): Listing {
  const stdout = execFileSync(
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test', '--list', '--reporter=json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )
  return JSON.parse(stdout) as Listing
}

/** Playwright configs tracked in git, so a second one cannot reappear unseen. */
function trackedConfigs(): string[] {
  return execFileSync('git', ['ls-files', '*playwright.config.*'], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)
}

/** Every workflow file's text, so the CI invocations can be read back. */
function workflowSources(): string[] {
  const dir = path.join(repoRoot, '.github', 'workflows')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
}

/** Distinct `--project=<name>` arguments across every workflow. */
function invokedProjects(): string[] {
  const names = new Set<string>()
  for (const source of workflowSources()) {
    for (const match of source.matchAll(/--project[= ]([\w-]+)/g)) names.add(match[1])
  }
  return [...names]
}

/** Any `--config <path>` a workflow names that is not on disk. */
function missingWorkflowConfigs(): string[] {
  const missing = new Set<string>()
  for (const source of workflowSources()) {
    for (const match of source.matchAll(/--config[= ]([\w./-]+)/g)) {
      if (!existsSync(path.join(repoRoot, match[1]))) missing.add(match[1])
    }
  }
  return [...missing]
}

describe('E2E spec discovery', () => {
  let listing: Listing
  let tests: { file: string; project: string }[]

  beforeAll(() => {
    listing = listSuite()
    tests = resolvedTests(listing)
  }, 120000)

  it('is governed by exactly one Playwright config', () => {
    expect(trackedConfigs()).toEqual(['playwright.config.ts'])
  })

  it('runs every spec file under tests/e2e, with no config entry per file', () => {
    const discovered = new Set(tests.map((test) => test.file))
    const missing = specFilesOnDisk()
      .filter((file) => !discovered.has(file))
      .sort()

    expect(missing).toEqual([])
  })

  it('has no project that resolves to zero tests', () => {
    const empty = listing.config.projects
      .map((project) => project.name)
      .filter((name) => !tests.some((test) => test.project === name))

    expect(empty).toEqual([])
  })

  it('runs every configured project from a workflow, and names only real ones', () => {
    const configured = listing.config.projects.map((project) => project.name).sort()

    expect(invokedProjects().sort()).toEqual(configured)
  })

  it('points every workflow --config at a config that exists', () => {
    expect(missingWorkflowConfigs()).toEqual([])
  })
})
