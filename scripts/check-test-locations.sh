#!/usr/bin/env bash
# Fails when a change adds a file under a legacy test location
# (CODING_STANDARDS.md, "Testing"). Moving a test out of one is fine.
#
# Usage: check-test-locations.sh [git diff range]   (default: staged changes)
set -euo pipefail

range="${1:---cached}"
legacy='^tests/(unit|component|lib|contract)/|(^|/)__tests__/'

added=$(git diff --name-only --diff-filter=AR "$range" | grep -E "$legacy" || true)

if [ -n "$added" ]; then
  echo "New files in a legacy test location. Colocate unit tests beside their source:"
  echo "$added"
  exit 1
fi
