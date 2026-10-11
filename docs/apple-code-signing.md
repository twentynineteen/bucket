# Apple Code Signing Setup Guide

This guide walks through setting up Apple Developer code signing and notarization for the Bucket macOS application in GitHub Actions CI/CD pipelines.

## Overview

Apple code signing ensures that your macOS application is trusted by users and macOS Gatekeeper. Notarization is required for applications distributed outside the Mac App Store using a Developer ID certificate.

## Prerequisites

1. **Apple Developer Account** - Enrolled in the Apple Developer Program ($99/year)
2. **Developer ID Application Certificate** - For distributing apps outside the App Store
3. **App-Specific Password** - For notarization automation

## Part 1: Creating the Code Signing Certificate

### Step 1: Generate Certificate Signing Request (CSR)

On your Mac:

1. Open **Keychain Access** (Applications → Utilities → Keychain Access)
2. From the menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Fill in the form:
   - **User Email Address**: Your Apple ID email
   - **Common Name**: Your name or company name
   - **CA Email Address**: Leave empty
   - **Request is**: Select "Saved to disk"
4. Click **Continue** and save the `CertificateSigningRequest.certSigningRequest` file

### Step 2: Create Developer ID Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click the **+** button to create a new certificate
3. Select **Developer ID Application** (for apps distributed outside the App Store)
4. Click **Continue**
5. Upload your CSR file from Step 1
6. Click **Continue** and then **Download** the certificate
7. Double-click the downloaded `.cer` file to install it in your Keychain

### Step 3: Export Certificate to .p12 Format

1. Open **Keychain Access**
2. In the left sidebar, select **login** keychain and **My Certificates** category
3. Find your "Developer ID Application: [Your Name]" certificate
4. Expand the certificate to see the private key underneath
5. Right-click the certificate (NOT the private key) and select **Export "Developer ID Application: [Your Name]"...**
6. Save as: `Bucket_Certificate.p12`
7. Set a strong password when prompted (you'll need this for GitHub Secrets)
8. Save the file to a secure location

### Step 4: Get Certificate Identity Name

1. In **Keychain Access**, double-click your Developer ID Application certificate
2. Copy the full name shown at the top (e.g., "Developer ID Application: John Doe (TEAM123456)")
3. Save this - you'll need it as `APPLE_SIGNING_IDENTITY`

## Part 2: Create App-Specific Password for Notarization

1. Go to [Apple ID Account](https://appleid.apple.com/)
2. Sign in with your Apple Developer account
3. In the **Security** section, under **App-Specific Passwords**, click **Generate Password**
4. Enter a label like "Bucket GitHub Actions Notarization"
5. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)
6. Save it securely - you'll need it as `APPLE_PASSWORD`

## Part 3: Find Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account/#!/membership)
2. Your **Team ID** is shown next to your name (10-character alphanumeric code like `TEAM123456`)
3. Save this - you'll need it as `APPLE_TEAM_ID`

## Part 4: Configure GitHub Secrets

### Required Secrets

Add these secrets to your GitHub repository at **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name                  | Description                     | How to Get                          |
| ---------------------------- | ------------------------------- | ----------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded .p12 certificate | See Step 5 below                    |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file      | The password you set when exporting |
| `APPLE_SIGNING_IDENTITY`     | Full certificate name           | From Step 4 in Part 1               |

`APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` (Parts 2 and 3) are only used for notarisation,
which runs locally (see [Releasing](#releasing)), so they do not belong in GitHub. Neither does the
updater signing key.

### Step 5: Encode Certificate to Base64

On macOS/Linux:

```bash
base64 -i Bucket_Certificate.p12 | pbcopy
```

This copies the base64-encoded certificate to your clipboard. Paste this entire string (including any `=` padding at the end) into the `APPLE_CERTIFICATE` secret.

On Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("Bucket_Certificate.p12")) | Set-Clipboard
```

### Keeping credentials safe

- **Never commit certificates or passwords to version control**
- Store your `.p12` certificate file in a secure password manager or encrypted storage
- Use GitHub's encrypted secrets - they are never exposed in logs
- The certificate password should be strong and unique
- App-specific passwords can be revoked if compromised

## Part 5: Verify Setup

### Local Testing

Before pushing to GitHub, test code signing locally:

```bash
# Export environment variables (replace with your values)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM123456)"
export APPLE_ID="your-email@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM123456"

# Build the app
bun run build:tauri
```

The build should complete without signing errors. Check the DMG file:

```bash
# Verify code signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/dmg/Bucket_0.14.0_universal.app

# Check if notarization is pending (after upload to Apple)
xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
```

### GitHub Actions Testing

1. Push to the `master` or `release` branch
2. Check the workflow run at **Actions** → **CI** → **build-macos**
3. Look for these log entries:
   - ✅ "Import Apple Code Signing Certificate" step succeeds
   - ✅ "Build (signed)" step completes
   - ✅ Tauri bundler logs show: "Code signing enabled"
   - Notarisation is not part of CI; see [Releasing](#releasing)

## Troubleshooting

### Common Issues

**Error: "No identity found"**

- Verify `APPLE_SIGNING_IDENTITY` matches exactly what's in Keychain Access
- Check that the certificate was imported correctly in the workflow

**Error: "The specified item could not be found in the keychain"**

- The keychain import step failed - check that `APPLE_CERTIFICATE` is properly base64-encoded
- Verify `APPLE_CERTIFICATE_PASSWORD` is correct

**Error: "Unable to notarize app"**

- Verify `APPLE_ID` is correct (must be your Apple Developer account email)
- Check that `APPLE_PASSWORD` is an app-specific password, not your Apple ID password
- Verify `APPLE_TEAM_ID` matches your Developer account

**Notarization stuck "In Progress"**

- As of January 2026, Apple's notarization service has experienced delays
- Check status: `xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID"`
- Builds may take several hours to complete notarization

**Error: "App is damaged and can't be opened"**

- The app was not properly signed or notarized
- Users need to download from the official GitHub release
- Check code signature: `spctl -a -vvv -t install /path/to/Bucket.app`

### Debug Commands

```bash
# List all Developer ID certificates in keychain
security find-identity -v -p codesigning

# Verify keychain contains the certificate
security find-certificate -c "Developer ID Application"

# Check notarization history
xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"

# Get detailed notarization info for a submission
xcrun notarytool info SUBMISSION_ID --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
```

## Workflow Integration

### CI Workflow (`ci.yml`)

On pushes to `release`, the `build-macos` job builds an Apple-signed arm64 app to check the
release builds. It skips the updater archives and is not notarised; nothing it builds ships.

### Publish Workflow (`publish.yml`)

Each push to `release`:

1. Stops if `app-v<version>` is already tagged, i.e. that version was published. Bump the version
   to release again.
2. Builds Apple-signed DMGs and updater archives for Apple Silicon (arm64) and Intel (x86_64).
3. Uploads them to a **draft** release for that version, pinned to the commit that was built.

CI never holds the updater signing key. The build runs every dependency's build-time code, so a
compromised dependency could otherwise sign a malicious update for every installed copy. Tauri
will not bundle updater archives without a key, so CI uses a throwaway one and discards its
signatures.

A draft is invisible to the updater, which reads `latest.json` from the latest _published_
release. Re-running the workflow while the release is a draft just replaces the draft's files.

## Releasing

1. Bump the version and merge it to `release`. Wait for the publish workflow's draft.
2. On your Mac, with the Apple notarisation variables set and the updater key to hand:

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY_PATH=/path/to/updater.key
   ./scripts/release-local.sh 0.20.0
   ```

   The script notarises and staples the DMGs, signs the updater archives (asking for the key
   password), checks the signatures match the `pubkey` in `tauri.conf.json`, writes
   `latest.json`, and asks before uploading and publishing. Publishing creates the tag, and
   installed apps start updating.

Keep the updater key and the Apple credentials out of your shell profile and out of any folder an
agent or other tool can read: export them only for the release, e.g. from a password manager.

## Certificate Renewal

Apple Developer ID certificates are valid for 5 years. When renewal is needed:

1. Generate a new CSR following Part 1, Step 1
2. Create a new Developer ID Application certificate
3. Export the new certificate to `.p12`
4. Update the `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` secrets in GitHub
5. Update `APPLE_SIGNING_IDENTITY` if the certificate name changed

## Setup checklist

Work through the Parts above for the detail; use this to track where you are.

**Certificate**

- [ ] Apple Developer Program membership is active
- [ ] CSR generated via Keychain Access (Part 1, Step 1)
- [ ] Developer ID Application certificate created and installed (Part 1, Step 2)
- [ ] Certificate exported to `.p12` with a password (Part 1, Step 3)
- [ ] Full identity name noted, e.g. `Developer ID Application: Your Name (TEAM123456)` (Part 1, Step 4)
- [ ] `.p12` stored in a password manager or encrypted storage, never in the repo

**Apple account**

- [ ] App-specific password generated (Part 2)
- [ ] Team ID found, a 10-character code (Part 3)

**GitHub secrets** (Part 4)

- [ ] `APPLE_CERTIFICATE`
- [ ] `APPLE_CERTIFICATE_PASSWORD`
- [ ] `APPLE_SIGNING_IDENTITY`
- [ ] No `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` or `TAURI_SIGNING_PRIVATE_KEY*` secrets.
      These stay on your Mac (see [Releasing](#releasing)).

**Verify** (Part 5)

- [ ] Local signed build completes and `codesign -dv` reports a valid signature
- [ ] On `master` or `release`, the CI `build-macos` job imports the certificate and builds signed
- [ ] On `release`, the publish workflow builds both arm64 and x86_64 and uploads a draft release
- [ ] A downloaded DMG installs on a machine that never held the certificate

**Renewal** (every 5 years)

- [ ] Renewal date recorded somewhere the team will see it
- [ ] New certificate created and secrets updated
- [ ] Old certificate archived

## Additional Resources

- [Tauri v2 macOS Code Signing Documentation](https://v2.tauri.app/distribute/sign/macos/)
- [Apple Developer Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Automatic Code-signing and Notarization for macOS apps using GitHub Actions](https://federicoterzi.com/blog/automatic-code-signing-and-notarization-for-macos-apps-using-github-actions/)

## Notes

- The app uses `macOSPrivateApi: true` for transparency effects, which makes it **incompatible with Mac App Store distribution**
- This configuration is for **Developer ID distribution only** (direct downloads, not App Store)
- Notarisation runs in `scripts/release-local.sh`, not in CI
- The updater uses Tauri's own signing, separate from Apple code signing; its key is only used by `scripts/release-local.sh`
