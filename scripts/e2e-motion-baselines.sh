#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# e2e-motion-baselines.sh - Regenerate Linux screenshot baselines for the
# Motion visual regression specs inside the pinned Playwright Docker image.
#
# Usage:
#   ./scripts/e2e-motion-baselines.sh
#
# Requires Docker. The script reads the @playwright/test version from
# package.json and uses the matching mcr.microsoft.com/playwright image
# so that baselines and CI renders come from one environment.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Read the Playwright version from package.json
PW_VERSION="$(node -e "const p = require('./package.json'); const v = p.devDependencies?.['@playwright/test'] ?? p.dependencies?.['@playwright/test'] ?? ''; console.log(v.replace(/^[\^~]/, ''))")"

if [ -z "$PW_VERSION" ]; then
  echo "ERROR: Could not read @playwright/test version from package.json" >&2
  exit 1
fi

IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"
echo "Using Playwright image: $IMAGE"
echo "Playwright version: $PW_VERSION"

# Pull the image if not already present
docker pull "$IMAGE"

# Snapshot directory
SNAP_DIR="tests/e2e/specs/motion-visual.spec.ts-snapshots"
mkdir -p "$SNAP_DIR"

# Run the visual tests with --update-snapshots inside the container, set up the
# way the e2e-tests job in .github/workflows/ci.yml sets it up, so a baseline
# made here is the render CI compares against.
#
# The checkout is mounted read-only at /src and copied to /work inside the
# container. The app is not served straight from the bind mount: over a Docker
# Desktop mount the first Tailwind compile missed classes from files it had not
# yet read, and the page rendered with a header 11px too short (issue #368).
# Only the snapshot directory is mounted writable, at /out.
docker run --rm \
  -v "$REPO_ROOT:/src:ro" \
  -v "$REPO_ROOT/$SNAP_DIR:/out" \
  -e CI=1 \
  -e E2E_HOST=127.0.0.1 \
  "$IMAGE" \
  bash -c "
    set -euo pipefail

    # The image ships browsers but not unzip, which the Bun installer needs.
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends unzip >/dev/null

    mkdir -p /work
    tar -C /src \
      --exclude=./node_modules \
      --exclude=./.git \
      --exclude=./dist \
      --exclude=./src-tauri/target \
      --exclude=./test-results \
      --exclude=./playwright-report \
      -cf - . | tar -C /work -xf -
    cd /work

    # The prepare script runs 'lefthook install', which needs a git repository.
    git init -q

    curl -fsSL https://bun.sh/install | bash
    export PATH=\$HOME/.bun/bin:\$PATH

    bun install --frozen-lockfile

    bunx playwright test tests/e2e/specs/motion-visual.spec.ts \
      --project=e2e \
      --update-snapshots \
      --reporter=list

    cp '$SNAP_DIR'/*-linux.png /out/

    # The container runs as root: hand the files back to the host user.
    chown $(id -u):$(id -g) /out/*-linux.png 2>/dev/null || true
  "

echo ""
echo "Baselines generated:"
ls -la "$SNAP_DIR"/*-linux.png
echo ""
echo "Run the script a second time to verify byte-identical output."
