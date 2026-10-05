# Coding Standards

Read during review. Each rule here needs judgement; the fixed-pattern rules are lint errors
and are listed at the end only so a reviewer does not re-check them by hand.

## Modules

- Every barrel export carries a one-line JSDoc describing its purpose.
- Helpers a feature does not share live in `internal/` and stay out of the barrel.
- A Tauri-dependent hook that crashes in the test environment is left out of the barrel and
  imported directly.
- A feature may add subdirectories (`BuildProject/` has `machine/`, `stages/`, `types/`), but
  stays one PascalCase directory under `src/features/` with a single `api.ts` at its root.

## React and state

- Data fetching uses TanStack React Query, not `useEffect`.
- Shared state lives in Zustand stores (named `...Store`), not React Context.
- Destructive actions confirm through a Radix `AlertDialog`; notifications use Sonner toasts.
- File operations go through the Tauri backend via the feature's `api.ts`, with progress
  tracking.

## Contract tests

Each feature's `__contracts__/` guards the module boundary, not the feature. A contract test
earns its place only if breaking it means another module breaks; one that would only break a
refactor belongs in a unit test, or nowhere.

- **Shape**: the barrel exports the names other modules import, with their type signatures,
  each asserted by name.
- **Behavioural**: hooks return the documented shape, and `api.ts` calls the correct Tauri
  command.
- **No-bypass**: no source file imports `@tauri-apps` directly; all I/O goes through `api.ts`.

## Testing

The suite is green and targets under 30 seconds. Protect both. Every rule here exists because of something already
in this repo.

### Proportionality

Ask of every new test: **what behaviour breaks for a user if this test is deleted?** If the
answer is "nothing, but a refactor would have to update it", the test should not exist. Tests
that describe the current shape of the code make refactoring expensive and catch no defects.

Test code already outweighs source. That ratio is not a target to defend or grow: prefer
deleting a weak test over adding a second one beside it.

### Where tests live

| Kind        | Location                                        | Purpose                          |
| ----------- | ----------------------------------------------- | -------------------------------- |
| Unit        | Colocated `*.test.ts(x)` beside the source file | One module's behaviour           |
| Contract    | `src/features/<Name>/__contracts__/`            | Module boundary guarantees       |
| Integration | `tests/integration/`                            | Two or more modules together     |
| E2E         | `tests/e2e/`                                    | Playwright, against the real app |

A change that edits a test in a legacy location (`tests/unit/`, `tests/component/`,
`tests/lib/`, `tests/contract/`, `__tests__/`) should move it to the colocated position rather
than grow it in place.

### Weak tests

Flag these in review:

- **Mocking every child it renders.** The assertion then only proves the mocks were called, and
  passes when the real component is broken. Mock the I/O boundary and assert what a user sees.

  ```typescript
  // Weak: mocks AppSidebar, then asserts the mock rendered
  vi.mock('@shared/ui/layout/app-sidebar', () => ({ AppSidebar: () => <div>AppSidebar</div> }))
  expect(screen.getByText('AppSidebar')).toBeInTheDocument()

  // Strong: mock only Tauri, then assert the rendered result
  vi.mock('@tauri-apps/api', () => ({ core: { invoke: async () => 'alice' } }))
  expect(await screen.findByRole('button', { name: /alice/i })).toBeInTheDocument()
  ```

- **Soft checks**: a test that logs violations and passes regardless. Assert the rule or delete
  the test. `tests/integration/us11-boundary-integrity.test.ts` still does this.
- **"Renders without crashing"** as the only assertion. Name what it should render.
- **Asserting a test's own fixture**: checking the shape of props the test itself built.
- **A second test file for a unit that already has one.** Extend the existing file.

### Deleting tests

Delete a test that asserts a shape rather than a behaviour, duplicates another, mocks the thing
it claims to verify, or has needed updating more than once for reasons unrelated to a real
defect. The PR body says so plainly: removing such a test is a fix, not a regression.

A failing test is a real defect or a wrong assertion. The PR states which before the test is
touched; failing alone is no reason to delete it.

### Done checklist

The PR body for test work says which of these applied:

1. An existing test for the unit was extended rather than a new file added.
2. Each new test was seen to fail when the behaviour it names was broken.
3. Each test sits in the right location from the table above.
4. `bun run test:run` still finishes in under 30 seconds.

A developer's explicit instruction overrides anything in this section.

## Enforced by tooling

Prettier and ESLint run on commit (lefthook) and in CI. These rules fail the build, so review
need not check them:

| Rule                                                   | Check                             |
| ------------------------------------------------------ | --------------------------------- |
| `vi.mock()` targets a module that exists               | `bucket/vi-mock-resolves`         |
| No counting the keys of an imported module             | `bucket/no-export-count`          |
| No new files in legacy test locations                  | `scripts/check-test-locations.sh` |
| Features import each other only via `@features/<Name>` | `no-restricted-imports`           |
| Shared never imports features                          | `boundaries/element-types`        |
| Barrels use named re-exports, not `export *`           | `no-restricted-syntax`            |
| `src/shared/ui` has no barrel files                    | `no-restricted-syntax`            |
| No direct `@tauri-apps` imports outside `api.ts`       | no-bypass contract tests          |
| Formatting, import order, Tailwind class order         | Prettier with plugins             |
