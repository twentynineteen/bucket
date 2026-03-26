#!/bin/bash
# Local notarization script - run this after downloading artifacts from GitHub Actions
# This avoids using GitHub macOS runner minutes for the slow notarization process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Bucket Local Notarization Script ===${NC}"
echo ""

# Check required environment variables
check_env() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        echo -e "${RED}Error: $var_name environment variable is not set${NC}"
        echo "Please set it with: export $var_name='your-value'"
        exit 1
    fi
}

check_env "APPLE_ID"
check_env "APPLE_PASSWORD"
check_env "APPLE_TEAM_ID"

# Check for artifacts directory
ARTIFACTS_DIR="${1:-./artifacts}"

if [ ! -d "$ARTIFACTS_DIR" ]; then
    echo -e "${RED}Error: Artifacts directory not found: $ARTIFACTS_DIR${NC}"
    echo ""
    echo "Usage: $0 [artifacts-directory]"
    echo ""
    echo "Download artifacts from GitHub Actions release workflow first:"
    echo "  1. Go to your GitHub repo → Actions → publish workflow run"
    echo "  2. Download dmg-aarch64-apple-darwin and dmg-x86_64-apple-darwin artifacts"
    echo "  3. Extract them to ./artifacts/ directory"
    echo ""
    exit 1
fi

# Find all DMG files
DMG_FILES=$(find "$ARTIFACTS_DIR" -name "*.dmg" -type f)

if [ -z "$DMG_FILES" ]; then
    echo -e "${RED}Error: No DMG files found in $ARTIFACTS_DIR${NC}"
    exit 1
fi

echo "Found DMG files:"
echo "$DMG_FILES"
echo ""

# Notarize each DMG
for dmg in $DMG_FILES; do
    echo -e "${YELLOW}Notarizing: $dmg${NC}"

    # Submit for notarization
    MAX_ATTEMPTS=3
    ATTEMPT=1

    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        echo "Notarization attempt $ATTEMPT of $MAX_ATTEMPTS..."

        if xcrun notarytool submit "$dmg" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --wait; then
            echo -e "${GREEN}Notarization succeeded on attempt $ATTEMPT${NC}"
            break
        fi

        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo -e "${RED}Notarization failed after $MAX_ATTEMPTS attempts${NC}"
            exit 1
        fi

        echo "Notarization failed, retrying in 30 seconds..."
        sleep 30
        ATTEMPT=$((ATTEMPT + 1))
    done

    # Staple the notarization ticket
    echo "Stapling notarization ticket..."
    xcrun stapler staple "$dmg"

    echo -e "${GREEN}✓ Complete: $dmg${NC}"
    echo ""
done

echo -e "${GREEN}=== All DMGs notarized successfully! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Upload the notarized DMGs to your GitHub release"
echo "  2. Or run: gh release upload <tag> $ARTIFACTS_DIR/**/*.dmg --clobber"
