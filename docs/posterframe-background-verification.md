# Poster frame background folder: manual verification

Issue #166. The automated coverage for this fix mocks Tauri IPC, so it proves the
UI wiring and the state transitions but not the filesystem behaviour underneath.
Specifically, it cannot prove that:

- Tauri's `readDir` rejects with `os error 2` for a directory that is not there,
  which is what `exists() === false` stands in for in the fixture.
- A macOS TCC permission denial on a protected directory (`~/Documents`,
  `~/Desktop`, an external volume) surfaces as a rejection rather than an empty
  listing. This is the case that originally hid behind "contains no image files".
- A genuinely malformed `api_keys.json` reaches `JSON.parse` and rethrows, rather
  than being caught earlier.

Run this checklist against a real build before releasing a change that touches
`listDirectory`, `useBackgroundFolder`, `BackgroundsSection`, `SettingsPage` or
`storage.ts`.

## 1. Baseline: a folder that works

1. Settings > Backgrounds > Choose Folder, pick a folder containing at least one
   `.jpg` or `.png`. Save.
2. Expect the path printed with no warning beside it.
3. Upload content > Posterframe.
4. **Expect** the folder path shown, the background dropdown populated, and no
   warning.

## 2. The reported bug: folder no longer on disk

1. With the above still configured, quit Bucket.
2. Rename or move the folder in Finder.
3. Reopen Bucket, go to Posterframe.
4. **Expect** `Cannot read background folder: <path>`, the path named in full,
   and the "Select Background Folder" button still usable.
5. **Expect not** "The background folder contains no image files", and not
   "No default background folder configured".
6. Settings > Backgrounds.
7. **Expect** the path still printed, now with "Bucket cannot read this folder",
   and the stored value unchanged.

## 3. Session recovery leaves the default alone

1. From the warning state in step 2, click "Select Background Folder" and pick a
   folder that does have images.
2. **Expect** the dropdown populates, the chosen folder is labelled as the
   session folder, the configured default is still shown, and a "Use default"
   control appears.
3. Click "Use default".
4. **Expect** the warning returns, because the default is still the dead path.
5. Settings > Backgrounds.
6. **Expect** the original stored path, unchanged. Nothing on the Posterframe
   page may write to `api_keys.json`.

## 4. Permission denial, not absence

This is the case that mocks cannot model. Do not skip it.

1. Point the default background folder at a folder inside `~/Documents`.
2. Confirm it works.
3. System Settings > Privacy & Security > Files and Folders, revoke Bucket's
   access to Documents (or remove Bucket from Full Disk Access if that is how it
   was granted). Quit and reopen Bucket.
4. Posterframe.
5. **Expect** `Cannot read background folder: <path>`. The wording is
   deliberately true for both absence and denial, so it should read correctly
   here without claiming the folder is missing.
6. Check the log for the underlying detail (`os error 13` or similar).
   **Expect** the detail in the log only, never on screen.
7. Restore the permission afterwards.

## 5. Folder present but holding no images

1. Point the default at a folder containing only non-image files.
2. Posterframe.
3. **Expect** "The background folder contains no image files", and **not** the
   cannot-read message.

## 6. Unreadable settings file

1. Quit Bucket.
2. Corrupt the settings file: open
   `~/Library/Application Support/com.bucket-app.devapi_keys.json` and delete a
   closing brace so it no longer parses. Keep a backup first.
   (The path looks wrong because it is: see issue #167.)
3. Reopen Bucket, go to Settings.
4. **Expect** the banner "Could not read your saved settings", every section
   still rendered, and **every Save button disabled**. This last point matters:
   a Save here would overwrite the file with a single field and destroy the
   Sprout key and Trello token that are still sitting in it.
5. Posterframe.
6. **Expect** "Could not read your settings, so the background folder is
   unknown", and **not** "No default background folder configured". Those two
   screens must agree about what went wrong.
7. Restore the backup and confirm normal operation returns.

## 7. First run

1. Quit Bucket, move `api_keys.json` aside entirely.
2. Reopen Bucket, go to Settings.
3. **Expect** no banner and Save enabled. An absent file is a first run, not a
   failure.
4. Posterframe.
5. **Expect** "No default background folder configured. Set one in Settings."
