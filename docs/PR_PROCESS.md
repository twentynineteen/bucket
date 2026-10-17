# Pull request process

This is the standard for every pull request in this repo, whether a person or an agent writes it.
It follows the process the Claude Code team describes in
[Solving code review at Anthropic](https://claude.dev/blog/solving-code-review-at-anthropic/).
Where Bucket has no equivalent yet, the step is marked **Not yet in place**, with what would close
the gap. Follow those steps by hand until then.

## The goal

Most PRs should merge with **at most one human in the loop**, who can be the author, with no rise in
reverts or incidents. Review exists for two reasons: to catch defects before they ship, and to
keep shared understanding of the codebase. Time a human spends reviewing is a cost. Reverts and
regressions are the guardrail. As the article puts it: "if they rise, we haven't saved human time,
we've only moved it."

## Layers, not one gate

A change passes through these layers in order. Few defects get through all of them, and rollback
handles the rest.

| #   | Layer                     | What it means here                                                                                                                                                                                                                                                                                                |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Before the PR             | The author (or agent) runs `bun run test:run`, `bun run typecheck`, `bun run prettier`, `bun run eslint`, and for Rust `cargo test` and `cargo clippy`, and **shows the output** rather than claiming success. A subagent reviews the diff in a fresh context. Run `/code-review` and `/security-review` locally. |
| 2   | Required CI               | The `master` ruleset requires `lint`, `test`, `rust-test` and `e2e-tests` (`.github/workflows/ci.yml`). Red blocks the merge.                                                                                                                                                                                     |
| 3   | AI code review            | Parallel finders, then a verifier vote on each finding. See below.                                                                                                                                                                                                                                                |
| 4   | Security review           | A separate pass. Any open finding blocks the merge.                                                                                                                                                                                                                                                               |
| 5   | Risk-based human approval | The tier comes from the change, not the author. See the risk tiers below.                                                                                                                                                                                                                                         |
| 6   | Up to date with `master`  | The ruleset requires a branch to contain the latest `master`, with checks passing on that combination, before it can merge. This is the stand-in for GitHub's merge queue, which personally owned repositories cannot use.                                                                                        |
| 7   | After merge               | Reversible by default: small changes, one-step revert, releases through `release` (see `docs/BRANCHING_STRATEGY.md`). **Not yet in place**: feature flags. Until they exist, new features ship behind a route or setting that can be hidden, and large changes are split.                                         |

## AI code review

- **Several finders in parallel**, each from a distinct lens:
  - _Skeptic_: correctness, edge cases, untrusted input.
  - _Architect_: boundaries, drift between paths that should agree.
  - _Minimalist_: dead code, duplication, tests that cannot fail.

  Each runs read-only, in a fresh context, ideally on a different model from the author's.

- **Context**: finders read the diff against the whole repo and the PR's stated intent. On a bug
  fix they look for the root cause.
- **Verifier vote**: each candidate finding goes to at least two independent verifiers. A finding
  is acted on only if they agree it is real. Findings that are only about style, diagnostics or
  cleanup are not posted as defects.
- **Tags**: every finding carries a severity and one tag:
  - **Important**: a user, an export or a test would be affected.
  - **Nit**: no change in behaviour.
  - **Pre-existing**: already on `master`, so not the author's to fix in this PR; raise an issue
    instead.
- **Evidence**: every finding gives a file and line, plus the code or command output that shows it.
  Without that it is a guess, not a finding.
- **Every finding is answered**: "You either fix it or resolve the thread with a reason." A false
  positive is closed with a short reason, not ignored. If a later commit fixes it, the finding is
  closed.
- **Depth tiers**: _Quick_ (one finder) for small low-risk changes, _Standard_ (two finders) for
  ordinary changes, and _Deep_ (three finders, verifiers and a security pass) "where one missed bug
  costs more than the extra review time".

### Keeping review from looping

Agent-on-agent review can keep both sides busy indefinitely, and the article saw one PR go "more
than fifty rounds". So:

- **Cap at three rounds.** After the third, stop and reconsider the approach rather than fixing
  again. A fourth round is allowed only as a final, verifier-gated pass.
- **Re-review the diff only**, after the first pass.
- **No repeats**: a finding already raised and answered is not raised again without new evidence.
- **Fix the class, not the instance**: when a bug is found, search for every instance of the same
  pattern and fix them together.
- **Watch for fixes causing regressions.** If a round's findings are mostly regressions from the
  previous round's fixes, the approach is wrong. Raise it with the owner.
- **Nits do not get their own round.** Batch them into one commit, or drop them. A person waves
  off a nit in seconds; an agent fixes it, and that costs another round.

## Risk tiers

The tier comes from what the change touches, not from who wrote it.

| Tier   | Examples in this repo                                                                                                                                                                                                                                          | Human approval                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Low    | Docs, copy, tests only, additive changes that are off by default                                                                                                                                                                                               | None once CI and review are clean                                                                                                            |
| Medium | Ordinary feature and bug-fix work in `src/features/*`                                                                                                                                                                                                          | One person                                                                                                                                   |
| High   | CI workflows, Tauri capabilities and `tauri.conf.json`, credential storage (`api_keys.json`), the updater, Rust commands that spawn processes or touch the file system, code that generates files another program executes (e.g. AE `.jsx`, Fusion `.setting`) | Two people. In practice, because this repo has one maintainer: the owner, plus a recorded security review and a second, separate review pass |

- **CI workflow files always need a person.**
- **An agent's approval never counts as a person's.**
- **Whoever prompted the change owns it** and counts as a required reviewer.
- **An approval covers one commit.** New commits need a new approval.

**Already in place**: the `master` ruleset requires a pull request with one approval and every
review thread resolved, and blocks force-pushes and deletion. Admins can bypass it only through a
pull request, which is how a single maintainer merges their own PRs; nobody, and no agent using
the maintainer's token, can push straight to `master`.

**Not yet in place**: an automatic tier classifier, CODEOWNERS, and dismissing approvals when new
commits are pushed. Until they exist, the author states the tier in the PR's Risk section, and the
reviewer checks it.

## REVIEW.md files

The owner of an area may add a `REVIEW.md` beside its code, for example
`src/features/Motion/REVIEW.md`. A good one:

- says what failure looks like there (for docs, "it lies"; for config, "it misroutes");
- caps nits;
- lists paths to skip;
- asks for a file and line as evidence.

Reviewers read the nearest `REVIEW.md` before reviewing that area. Project-wide conventions stay
in `CLAUDE.md` and `CODING_STANDARDS.md`.

## Every PR

- Uses `.github/pull_request_template.md`: **Summary**, **Testing** (the commands run and their
  output), **Risk** (tier and why), **How to revert**.
- Is small enough to review. If a PR grows past about 1,000 changed lines of non-generated code,
  split it. The article finds that most PRs that large come back with findings.
- Has every review thread resolved before merge.

## After merge: "you land it, you own it"

The author fixes what breaks. This works only because changes are small, everything can be
reverted, and the bar for checks rises with the blast radius. It is not about blame.

## Making the reviewer better

- **Misses become checks.** When a review misses something, ask what the reviewer did not have in
  front of it. Put the fix where every future review will see it: `CLAUDE.md`, a `REVIEW.md`, a
  skill, a lint rule or a test.
- **Recurring findings move to the source.** A finding that comes back PR after PR becomes a lint
  rule, a contract test or an instruction.
- **Measure.** For each review, record how its findings were resolved (fixed, wrong, intentional,
  or didn't matter), and how many rounds the PR took. A rising share of "wrong" means the reviewer
  is noisy.
- **Not yet in place**: an eval set of past reverts and bugs that every change to review prompts is
  scored against.

## What this process does not do

- It does not slow down to lower the error rate. Doing less of everything is not the goal; getting
  faster at noticing and fixing problems is.
- It does not let automated approval fill a slot that calls for a person.
- It has no automatic circuit breaker that tightens approval when reverts rise. Until it does,
  watch the revert rate by hand.
