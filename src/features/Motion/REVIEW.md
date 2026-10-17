# Reviewing Motion

This feature generates code for programs it cannot run in tests: After Effects (ExtendScript `.jsx`), DaVinci Resolve (Fusion `.setting`) and ffmpeg. Review for what breaks there.

## What failure looks like here

- **An export disagrees with the preview.** One template drives the preview, the video and every exporter (`internal/evaluate.ts` and the files under `internal/exporters/`). A position, ease, anchor, colour, stagger or layer order that differs between them is a defect.
- **The script calls something the host does not have.** Every AE and Fusion name has to come from documentation or a real exported file, and the test stubs must reject anything else (`exporters/ae/testing/aeStub.ts`, the Fusion name allowlist). A stub that accepts an invented name makes its tests worthless.
- **An export overwrites or half-writes.** Exports go through a temp folder and a rename (`internal/exportBundle.ts`). Nothing outside `Graphics/Motion/.tmp-*` may ever be removed.
- **User text or a library template escapes its context.** Text ends up in ES3 strings, Lua strings, SVG and Markdown. Library templates are untrusted JSON.
- **A test that cannot fail.** Shape checks, fixed-time screenshots of animations that pause, and mocks of the unit under test. See the testing policy in `CLAUDE.md`.

## How to report

- Give a file and line, plus the evidence: quoted code, or a command and its output. Without that, it is a guess and not a finding.
- Tag each finding **Important** (a user or an export would hit it), **Nit** (no behaviour change) or **Pre-existing** (already on master).
- Cap nits at five per review. Report a class of bug once, with every instance listed, rather than one instance per round.
- Where behaviour can only be confirmed in the real app, add it to the manual fidelity check (#339). Do not guess at host behaviour.

## Skip

- The `points` arrays in `internal/templates/spread-map.json`. They are generated data, made by `scripts/motion/sample-points.ts`.
- The PNGs in `tests/e2e/specs/motion-visual.spec.ts-snapshots/`. CI renders them in the pinned Playwright container, and they are reviewed as images, not diffs.
