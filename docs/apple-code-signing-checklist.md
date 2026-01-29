# Apple Code Signing Setup Checklist

Quick reference checklist for setting up Apple Developer code signing in GitHub Actions.

## Prerequisites Checklist

- [ ] Apple Developer Program membership ($99/year)
- [ ] Access to a Mac for certificate creation
- [ ] Admin access to GitHub repository settings

## Certificate Setup

- [ ] Generate Certificate Signing Request (CSR) via Keychain Access
- [ ] Create Developer ID Application certificate at developer.apple.com
- [ ] Download and install certificate in Keychain
- [ ] Export certificate to `.p12` format with password
- [ ] Note the full certificate identity name (e.g., "Developer ID Application: Your Name (TEAMID)")
- [ ] Store `.p12` file securely (encrypted storage/password manager)

## Apple Account Configuration

- [ ] Generate app-specific password at appleid.apple.com
- [ ] Note your Apple ID email address (developer account)
- [ ] Find Team ID at developer.apple.com/account/#!/membership
- [ ] Save Team ID (10-character code like "TEAM123456")

## GitHub Secrets Configuration

Go to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**

Add the following repository secrets:

- [ ] `APPLE_CERTIFICATE` - Base64-encoded .p12 file
  ```bash
  base64 -i Bucket_Certificate.p12 | pbcopy
  ```

- [ ] `APPLE_CERTIFICATE_PASSWORD` - Password set when exporting .p12

- [ ] `APPLE_SIGNING_IDENTITY` - Full certificate name from Keychain
  ```
  Example: "Developer ID Application: John Doe (TEAM123456)"
  ```

- [ ] `APPLE_ID` - Apple Developer account email

- [ ] `APPLE_PASSWORD` - App-specific password (xxxx-xxxx-xxxx-xxxx format)

- [ ] `APPLE_TEAM_ID` - Team ID from developer account (10 characters)

## Existing Secrets (Verify Present)

- [ ] `TAURI_SIGNING_PRIVATE_KEY` - For Tauri updater (separate from Apple signing)
- [ ] `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - For Tauri updater

## Local Testing (Optional but Recommended)

```bash
# Set environment variables
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your-email@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"

# Test build
bun run build:tauri

# Verify signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/dmg/*.app
```

- [ ] Local build completes successfully
- [ ] Code signature verified
- [ ] No signing errors in output

## GitHub Actions Testing

- [ ] Push to `master` or `release` branch
- [ ] Check **Actions** → **CI** → **build-macos** workflow
- [ ] Verify "Import Apple Code Signing Certificate" step succeeds
- [ ] Verify "Build (signed)" step completes
- [ ] Check logs for "Code signing enabled"
- [ ] Verify notarization upload succeeds

## Publish Workflow Testing

- [ ] Push to `release` branch to trigger publish workflow
- [ ] Check **Actions** → **publish** workflow
- [ ] Verify both arm64 and x86_64 builds succeed
- [ ] Check DMG files are created and signed
- [ ] Verify GitHub release is created with artifacts
- [ ] Download and test DMG installation on macOS

## Security Verification

- [ ] `.p12` file NOT committed to repository
- [ ] Passwords NOT committed to repository
- [ ] GitHub secrets are encrypted (green lock icon)
- [ ] Certificate stored in secure location (password manager)
- [ ] App-specific password documented securely

## Documentation

- [ ] Read full setup guide: `docs/apple-code-signing.md`
- [ ] Team members have access to certificate and passwords (via secure channel)
- [ ] Certificate renewal date noted (certificates valid for 5 years)

## Quick Troubleshooting

**Build fails with "No identity found":**
- Check `APPLE_SIGNING_IDENTITY` matches exact name from Keychain

**Build fails with "keychain error":**
- Verify `APPLE_CERTIFICATE` is properly base64-encoded
- Check `APPLE_CERTIFICATE_PASSWORD` is correct

**Notarization fails:**
- Verify `APPLE_ID` is your developer account email
- Check `APPLE_PASSWORD` is app-specific password (not Apple ID password)
- Verify `APPLE_TEAM_ID` is correct

**"App is damaged" error on user's Mac:**
- App was not properly signed/notarized
- Ensure user downloads from official GitHub release
- Verify build workflow completed successfully

## Useful Commands

```bash
# List code signing identities
security find-identity -v -p codesigning

# Check certificate in keychain
security find-certificate -c "Developer ID Application"

# View notarization history
xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"

# Verify app signature
codesign -dv --verbose=4 /path/to/Bucket.app

# Test Gatekeeper acceptance
spctl -a -vvv -t install /path/to/Bucket.app
```

## Certificate Renewal (Every 5 Years)

- [ ] Generate new CSR
- [ ] Create new Developer ID Application certificate
- [ ] Export new certificate to .p12
- [ ] Update GitHub secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
- [ ] Test build with new certificate
- [ ] Archive old certificate securely

## Resources

- [Full Setup Guide](./apple-code-signing.md)
- [Tauri v2 macOS Signing Docs](https://v2.tauri.app/distribute/sign/macos/)
- [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list)
