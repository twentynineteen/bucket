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

# Run the visual tests with --update-snapshots inside the container.
# The container runs as root, so we fix ownership after.
# The anonymous /work/node_modules volume keeps the container's Linux install
# from overwriting the host's macOS node_modules (native binaries differ).
docker run --rm \
  -v "$REPO_ROOT:/work" \
  -v /work/node_modules \
  -w /work \
  "$IMAGE" \
  bash -c "
    # Install bun
    curl -fsSL https://bun.sh/install | bash
    export PATH=\$HOME/.bun/bin:\$PATH

    # Install deps
    bun install --frozen-lockfile

    # Run only the motion-visual spec with --update-snapshots
    bunx playwright test tests/e2e/specs/motion-visual.spec.ts \
      --project=e2e \
      --update-snapshots \
      --reporter=list

    # Fix ownership so the host user can edit the files
    chown -R $(id -u):$(id -g) '$SNAP_DIR' 2>/dev/null || true
  "

# Verify baselines were generated
if ls "$SNAP_DIR"/*-linux.png 1>/dev/null 2>&1; then
  echo ""
  echo "Baselines generated:"
  ls -la "$SNAP_DIR"/*-linux.png
  echo ""
  echo "Run the script a second time to verify byte-identical output."
else
  echo ""
  echo "WARNING: No *-linux.png baselines found in $SNAP_DIR."
  echo "The visual tests may have been skipped or failed."
  echo "Check the Playwright output above for details."
fi
