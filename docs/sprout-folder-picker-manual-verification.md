# Manual verification — Sprout folder picker (#155)

Everything in this document needs a **real Sprout Video account**, which is why
it is not automated. Automated coverage stops at two boundaries:

- Unit and component tests mock `invoke`, so they verify our side of the IPC
  contract but never Sprout's behaviour.
- E2E runs against the Vite dev server with Tauri IPC mocked
  (`tests/e2e/fixtures/tauri-e2e-mocks.ts`), so it verifies browser behaviour
  but also never reaches Sprout.

The `tauri-ipc.contract.test.ts` contract test covers the argument-binding bug
class statically. What remains below is **Sprout's own semantics** plus the
end-to-end truth that a video lands where the user asked.

> **Before you start:** Sprout allows **200 requests per minute per account**,
> shared across everything. Work through this in one pass rather than repeating
> steps quickly, and avoid running it while a colleague is uploading.

## Setup

1. Settings → SproutVideo → enter a valid API key.
2. In the Sprout web UI, make sure the account has:
   - at least one folder with **subfolders** (two levels deep is enough),
   - ideally one folder containing **more than 25 subfolders** (for step 4).

---

## 1. Subfolders resolve to the right parent

The original bug: the `parent_id` argument never reached the backend, so every
level returned the account's root folders. This is the single most important
check, because it looks like "the tree works" until you read the names.

- [ ] Open the Sprout upload page, select a video file, open the folder picker.
- [ ] The first level matches the **root** folders in the Sprout web UI.
- [ ] Hover a folder that has subfolders and hold — its submenu lists **that
      folder's children**, not the root list again.
- [ ] Go two levels deep. The third level is correct, not a repeat of level one.

**Failure signature:** every level shows identical contents. That means
`parent_id` is not arriving.

## 2. The right video lands in the right folder

- [ ] Pick a nested folder (say `Marketing / Q2 Campaign`) and upload a short video.
- [ ] In the Sprout web UI, the video is inside **that** folder — not the root,
      not the parent.
- [ ] Repeat with **Root (no folder)** selected: the video appears at the root.

## 3. Poster frames still work with a folder selected

Folder placement happens at upload time; poster frames are applied to the video
by ID afterwards. They should not interact, but this confirms it.

- [ ] In Baker → Add Video → Upload, select a folder **and** enable the branded
      poster frame.
- [ ] Upload succeeds, the video is in the chosen folder, **and** the poster
      frame is applied.

## 4. Pagination past Sprout's 25-per-page default

Sprout returns 25 folders per page; the backend requests 100 and follows
subsequent pages internally.

- [ ] Open a level with **more than 25** subfolders.
- [ ] Every folder visible in the Sprout web UI is present in the menu.
- [ ] The menu **scrolls** — nothing is clipped or unreachable.

If a level ever exceeds 1000 folders, the menu shows a
`Showing the first N of M folders` row rather than silently truncating.

## 5. `next_page` behaviour (informational — resolves a documented unknown)

We deliberately **rebuild** each page URL rather than following Sprout's
`next_page`, because the documented example carries neither `parent_id` nor the
requested `per_page` — following it verbatim could splice root's page 2 into a
child listing. This step confirms whether that caution was warranted.

- [ ] With devtools open on a level that paginates, note whether results stay
      correct across the page boundary (they should, since we rebuild the URL).
- [ ] Record what `next_page` actually contains, and add it to #155. If Sprout
      does echo `parent_id`, we can simplify; if not, the current approach is
      required.

## 6. Rate-limit behaviour

The account-wide limit is the reason browsing is throttled and uploads are not.

- [ ] Sweep the mouse quickly down a list of 10+ folders **without pausing**.
      In devtools, **no** folder requests fire.
- [ ] Rest on one folder for ~half a second — exactly one request fires.
- [ ] Close and reopen the picker: previously loaded levels appear instantly
      with **no** new requests.
- [ ] Start a large upload, and browse folders while it runs. The upload
      completes normally.

**If you can reach a 429** (a busy shared account, or an already-exhausted
window): browsing shows a message naming the wait, and it does **not** retry.
Uploads must still work.

## 7. Failure modes are honest

- [ ] Enter an **invalid** API key. The picker shows an error naming the API key
      and pointing at Settings — **not** an empty folder tree.
- [ ] With folders failing to load, uploading to Root still works.
- [ ] Disconnect from the network mid-browse: an error appears with a Retry
      button, and Retry works once connectivity returns.

## 8. Persistence

- [ ] Settings → SproutVideo → set a **default upload folder**. A confirmation
      toast names it.
- [ ] Restart the app. A new upload defaults to that folder.
- [ ] Upload to a *different* folder, then start another upload — it defaults to
      the folder you just used (session last-used beats the stored default).
- [ ] Restart again: the default from Settings is back (last-used is
      session-scoped by design).
- [ ] The picker's **Recent** section lists up to 5 folders, most recent first,
      with no duplicates.

## 9. Appearance

- [ ] Cycle through several of the 13 themes with the picker open — including
      at least one light, one dark, and one Catppuccin variant. Selected rows,
      folder names and the error row all stay legible.
- [ ] In Baker → Add Video → Upload with the poster frame enabled, the dialog is
      still usable at a laptop viewport and "Upload and Add" is reachable.
      *(If it is not, that is #157, not this feature.)*

---

## Reporting

Record the outcome on #155. If step 1 or 2 fails, stop — those indicate the core
fix is not working and everything below them is moot.
