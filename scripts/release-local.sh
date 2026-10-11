#!/bin/bash
# Finish a release that the publish workflow uploaded as a draft.
#
# The updater signing key never goes to GitHub: CI builds with a throwaway
# key, and this script signs the updater archives here. Until it publishes,
# the draft is invisible to the updater, which only reads the latest
# published release.
#
#   1. Downloads the draft's DMGs and updater archives
#   2. Notarises and staples the DMGs
#   3. Signs the updater archives and checks the signatures match the
#      updater public key in tauri.conf.json
#   4. Writes latest.json, uploads everything and publishes the release
#
# Usage: ./scripts/release-local.sh <version>     e.g. ./scripts/release-local.sh 0.20.0
#
# Needs gh (signed in with write access to the repo), xcrun, bun and jq, plus:
#   APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID   for notarisation
#   TAURI_SIGNING_PRIVATE_KEY_PATH            path to the updater private key
# The key password is asked for once. Keep the key file somewhere agents
# cannot read it, e.g. in your password manager, exported only for the release.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO="twentynineteen/bucket"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

die() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

check_env() {
    [ -n "${!1:-}" ] || die "$1 environment variable is not set"
}

# The 8-byte key ID inside a Tauri public key or signature (base64 of a
# minisign file whose second line is base64 of: 2-byte algorithm, 8-byte key ID, ...).
key_id() {
    base64 -d | sed -n 2p | base64 -d | xxd -s 2 -l 8 -p
}

VERSION="${1:-}"
[ -n "$VERSION" ] || die "usage: $0 <version>   e.g. $0 0.20.0"
TAG="app-v${VERSION}"

check_env APPLE_ID
check_env APPLE_PASSWORD
check_env APPLE_TEAM_ID
check_env TAURI_SIGNING_PRIVATE_KEY_PATH
[ -f "$TAURI_SIGNING_PRIVATE_KEY_PATH" ] || die "no key file at $TAURI_SIGNING_PRIVATE_KEY_PATH"
for tool in gh xcrun bun jq xxd; do
    command -v "$tool" >/dev/null || die "$tool is not installed"
done

echo -e "${GREEN}=== Bucket release ${TAG} ===${NC}"

if git ls-remote --exit-code --tags "https://github.com/${REPO}" "refs/tags/${TAG}" >/dev/null; then
    die "${TAG} is already published"
fi
[ "$(gh release view "$TAG" -R "$REPO" --json isDraft -q .isDraft)" = "true" ] \
    || die "no draft release for ${TAG}; push the version to the release branch first"

PUBKEY=$(jq -r .plugins.updater.pubkey "$ROOT/src-tauri/tauri.conf.json")
EXPECTED_KEY_ID=$(printf %s "$PUBKEY" | key_id)

WORK=$(mktemp -d)
echo "Working in $WORK"
gh release download "$TAG" -R "$REPO" -D "$WORK" -p '*.dmg' -p '*.app.tar.gz'

DMGS=("$WORK"/*.dmg)
AARCH64_FILE=$(basename "$WORK"/*_aarch64-apple-darwin.app.tar.gz)
X86_64_FILE=$(basename "$WORK"/*_x86_64-apple-darwin.app.tar.gz)
[ "${#DMGS[@]}" -eq 2 ] || die "expected 2 DMGs in the draft, found ${#DMGS[@]}"

# Notarise each DMG. Apple's service can be flaky, so retry.
for dmg in "${DMGS[@]}"; do
    echo -e "${YELLOW}Notarising: $(basename "$dmg")${NC}"
    ATTEMPT=1
    until xcrun notarytool submit "$dmg" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait; do
        [ $ATTEMPT -lt 3 ] || die "notarisation failed after 3 attempts"
        ATTEMPT=$((ATTEMPT + 1))
        echo "Retrying in 30 seconds (attempt $ATTEMPT of 3)..."
        sleep 30
    done
    xcrun stapler staple "$dmg"
done

# Sign the updater archives. The signer is the project's pinned Tauri CLI.
if [ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]; then
    read -rsp "Updater key password: " TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    echo
fi
for file in "$AARCH64_FILE" "$X86_64_FILE"; do
    echo -e "${YELLOW}Signing: $file${NC}"
    (cd "$ROOT" && TAURI_PRIVATE_KEY_PASSWORD="$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" \
        bun run tauri signer sign -f "$TAURI_SIGNING_PRIVATE_KEY_PATH" "$WORK/$file" >/dev/null)
    [ "$(key_id < "$WORK/$file.sig")" = "$EXPECTED_KEY_ID" ] \
        || die "$file.sig was not made with the key in tauri.conf.json; installed apps would reject it"
done
unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD

jq -n \
    --arg version "$VERSION" \
    --arg notes "$(gh release view "$TAG" -R "$REPO" --json body -q .body)" \
    --arg pub_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg aarch64_url "https://github.com/${REPO}/releases/download/${TAG}/${AARCH64_FILE}" \
    --arg aarch64_sig "$(cat "$WORK/$AARCH64_FILE.sig")" \
    --arg x86_64_url "https://github.com/${REPO}/releases/download/${TAG}/${X86_64_FILE}" \
    --arg x86_64_sig "$(cat "$WORK/$X86_64_FILE.sig")" \
    '{
      version: $version,
      notes: $notes,
      pub_date: $pub_date,
      platforms: {
        "darwin-aarch64": { url: $aarch64_url, signature: $aarch64_sig },
        "darwin-x86_64": { url: $x86_64_url, signature: $x86_64_sig }
      }
    }' > "$WORK/latest.json"

echo ""
echo "Ready to publish ${TAG}:"
ls -1 "$WORK"
read -rp "Upload and publish now? Installed apps will start updating. [y/N] " answer
[ "$answer" = "y" ] || { echo "Stopped. The draft is unchanged; files are in $WORK"; exit 0; }

gh release upload "$TAG" -R "$REPO" --clobber \
    "${DMGS[@]}" "$WORK/$AARCH64_FILE.sig" "$WORK/$X86_64_FILE.sig" "$WORK/latest.json"
gh release edit "$TAG" -R "$REPO" --draft=false --latest --title "v${VERSION}"

SERVED=$(curl -fsSL "https://github.com/${REPO}/releases/latest/download/latest.json" | jq -r .version)
[ "$SERVED" = "$VERSION" ] || die "published, but the updater endpoint serves version $SERVED"
echo -e "${GREEN}=== ${TAG} published; the updater now serves it ===${NC}"
