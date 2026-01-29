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

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate | See Step 5 below |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file | The password you set when exporting |
| `APPLE_SIGNING_IDENTITY` | Full certificate name | From Step 4 in Part 1 |
| `APPLE_ID` | Apple Developer email | Your Apple ID email address |
| `APPLE_PASSWORD` | App-specific password | From Part 2 |
| `APPLE_TEAM_ID` | Apple Developer Team ID | From Part 3 |

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

### Security Best Practices

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
   - ✅ Notarization upload succeeds

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

The CI workflow includes a `build-macos` job that:
- **On Pull Requests**: Builds unsigned DMGs for testing
- **On master/release branches**: Builds signed and notarized DMGs

This ensures PRs can build quickly without requiring secrets, while production builds are fully signed.

### Publish Workflow (`publish.yml`)

The publish workflow runs on every push to `release` branch and:
1. Builds signed DMGs for both Apple Silicon (arm64) and Intel (x86_64)
2. Notarizes the DMGs with Apple
3. Creates a GitHub release with signed artifacts
4. Publishes the updater manifest for auto-updates

## Certificate Renewal

Apple Developer ID certificates are valid for 5 years. When renewal is needed:

1. Generate a new CSR following Part 1, Step 1
2. Create a new Developer ID Application certificate
3. Export the new certificate to `.p12`
4. Update the `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` secrets in GitHub
5. Update `APPLE_SIGNING_IDENTITY` if the certificate name changed

## Additional Resources

- [Tauri v2 macOS Code Signing Documentation](https://v2.tauri.app/distribute/sign/macos/)
- [Apple Developer Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Automatic Code-signing and Notarization for macOS apps using GitHub Actions](https://federicoterzi.com/blog/automatic-code-signing-and-notarization-for-macos-apps-using-github-actions/)

## Notes

- The app uses `macOSPrivateApi: true` for transparency effects, which makes it **incompatible with Mac App Store distribution**
- This configuration is for **Developer ID distribution only** (direct downloads, not App Store)
- Notarization is automatic when all environment variables are set
- The updater uses Tauri's built-in signing (`TAURI_SIGNING_PRIVATE_KEY`) which is separate from Apple code signing
