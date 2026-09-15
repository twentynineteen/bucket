# Bucket user guide

How to use Bucket, what its domain concepts mean, and what to do when something
goes wrong. For installing and building the app see the
[root README](../README.md); for working on the code see
[ONBOARDING.md](./ONBOARDING.md).

## Key concepts

### Breadcrumbs

A `breadcrumbs.json` file stored in each project folder, holding that project's
metadata: title, date, camera count, video links, Trello cards.

Breadcrumbs are the source of truth for project metadata, which is what makes the
rest of the app possible. They let you identify a project without opening
Premiere, they carry the links to Trello and Sprout Video, they are what Baker
reads and writes when it operates across many projects at once, and they survive
the file being moved.

```json
{
  "projectTitle": "Conference Keynote 2024",
  "numberOfCameras": 3,
  "files": [{ "camera": 1, "name": "clip1.mov", "path": "Footage/Camera 1/clip1.mov" }],
  "parentFolder": "/Volumes/Media/Projects",
  "createdBy": "alice",
  "creationDateTime": "2024-03-15T14:30:00Z",
  "videoLinks": [
    {
      "url": "https://sproutvideo.com/videos/abc123",
      "sproutVideoId": "abc123",
      "title": "Full Event",
      "thumbnailUrl": "https://..."
    }
  ],
  "trelloCards": [
    {
      "url": "https://trello.com/c/xyz789",
      "cardId": "xyz789",
      "title": "Q1 Marketing Event",
      "lastFetched": "2024-03-20T10:30:00Z"
    }
  ]
}
```

### Multi-camera projects

A multi-camera shoot produces hundreds of files from several cameras. Bucket
organises them by camera number, from 1 to N.

Every file must carry a camera assignment within that range, which Bucket
validates before it copies anything. Files then go to their camera subfolder, and
the Adobe Premiere project template is configured for the camera count you set.

```javascript
// Selected files
;[
  { name: 'clip1.mov', camera: 1 },
  { name: 'clip2.mov', camera: 1 },
  { name: 'clip3.mov', camera: 2 }
]
```

```
Conference Keynote 2024/
├── Footage/
│   ├── Camera 1/
│   │   ├── clip1.mov
│   │   └── clip2.mov
│   └── Camera 2/
│       └── clip3.mov
├── Projects/
│   └── Conference Keynote 2024.prproj
└── breadcrumbs.json
```

### RAG script formatting

Autocue scripts need particular formatting: punctuation, paragraph breaks,
speaker notes. Rather than applying that by hand, Bucket formats a raw transcript
using a local LLM guided by examples of scripts already formatted correctly.
That retrieval step is what keeps the output consistent with house style instead
of whatever the model would produce unprompted.

1. You upload a `.docx` script, parsed with mammoth.js
2. Script chunks are embedded using Ollama's embedding model
3. Similar examples are retrieved from the SQLite vector database
4. Those examples and your script go to the LLM for formatting
5. The result appears in a Monaco diff editor
6. You edit as needed and export as `.docx`

## Common tasks

### Create a new video project

1. Open **Build Project** from the sidebar
2. Click **Select Files** and choose your footage
3. Assign camera numbers to each file, or auto-assign for sequential numbering
4. Set the number of cameras. Bucket validates that all cameras 1 to N are assigned
5. Enter a project title and pick a destination folder
6. Click **Create Project** and watch the progress bar as files copy and the
   Premiere project is generated

You get a folder of organised footage, a Premiere project file and a
`breadcrumbs.json`.

### Format a script with AI

1. Start Ollama (`ollama serve`)
2. Open **AI Tools > Script Formatter**
3. Pick Ollama as the provider and choose a model, for example `llama3.1`
4. Click **Upload .docx File**
5. Click **Format Script**
6. Review the diff, original on the left and formatted on the right
7. Edit the right pane if you need to
8. Click **Download Formatted Script**

### Batch update breadcrumbs with Baker

1. Open **Baker** from the sidebar
2. Click **Select Root Directory** and choose a folder containing several project folders
3. Wait for the scan to identify projects
4. Review the detected projects
5. Change the fields you want: title, date, video links, Trello cards
6. Tick the projects to update
7. Click **Preview Changes** to see what will be modified
8. Click **Apply Changes**

### Add a Sprout Video link

Upload the video to Sprout Video first, then copy its embed code. In Bucket, open
the project or go to **Upload Sprout**, paste the embed code, and Bucket extracts
the video ID and thumbnail. Save to write it into breadcrumbs.

### Connect a Trello card

Go to **Upload Trello**, or use Baker's Trello integration, and paste a card URL
such as `https://trello.com/c/abc123`. Bucket fetches the title, members and
description through the Trello API for you to review, then caches them in
breadcrumbs. Cached card data refreshes every 7 days.

## Configuration

There are no environment variables. Configuration lives in Tauri's app data
directory and is managed through the Settings page.

| Setting              | Description                            | Default                  | Needed for      |
| -------------------- | -------------------------------------- | ------------------------ | --------------- |
| Ollama URL           | Ollama server endpoint for AI features | `http://localhost:11434` | AI features     |
| Trello API Key       | Trello API key for card integration    | None                     | Trello features |
| Trello Token         | Trello OAuth token                     | None                     | Trello features |
| Sprout Video API Key | Sprout Video API key                   | None                     | Sprout features |

Enter these under Settings, then use **Test Connection** to confirm each one
before saving.

Credentials are stored unencrypted in `api_keys.json` in the app data directory,
protected only by your account's file permissions. Bucket is a single-user local
tool with no login.

## Troubleshooting

### Ollama connection failed

The Script Formatter reports "Failed to connect to Ollama" or shows no models.

```bash
# Is Ollama running?
curl http://localhost:11434/api/tags

# If the connection is refused, start it
ollama serve

# Are any models installed?
ollama list

# If not, install one
ollama pull llama3.1:latest
```

Then check Settings has the Ollama URL as `http://localhost:11434` and click
**Test Connection**.

### Build fails on missing dependencies

`bun run build:tauri` reports missing dependencies.

```bash
# Reinstall JS dependencies
rm -rf node_modules bun.lock
bun install

# Clear the Rust build cache
cd src-tauri && cargo clean && cd ..

bun run build:tauri
```

If it still fails, check `rustc --version` is 1.70 or later and run `rustup update`.

### File copy fails during project creation

"Failed to copy file" or "Permission denied" during the Build Project workflow.
Check that the destination has enough space (`df -h`), that you have write access
(`ls -ld /path/to/destination`), and that nothing else holds the files open.
Premiere and Finder both do this. Some network drives do not support the
operations Bucket needs, so try a local destination to rule that out.

### Premiere project file will not open

Fixed in v0.9.1 with proper file sync. Update Bucket and recreate the project.
If it recurs, check that
`src-tauri/assets/Premiere 4K Template 2025.prproj` is present.

### Baker scan finds no projects

Baker validates a folder against five standard subfolders. A folder is detected
when all five are present with some content, or when it already has a
`breadcrumbs.json` regardless of structure.

```
ProjectFolder/
├── Footage/
├── Graphics/
├── Renders/
├── Projects/
├── Scripts/
└── breadcrumbs.json (optional, created if missing)
```

Folder names are case-sensitive on macOS and Linux. If a folder still is not
picked up, try scanning the parent directory instead.

### Inspecting app state

```bash
# Open the app data directory (settings, api_keys.json)
open ~/Library/Application\ Support/com.bucket-app.dev

# Count the script examples in the embeddings database
sqlite3 src-tauri/resources/embeddings/examples.db "SELECT COUNT(*) FROM examples;"

# Scope Rust logs to one module
RUST_LOG=app_lib::commands=debug bun run dev:tauri
```

## Getting help

- [GitHub Issues](https://github.com/twentynineteen/bucket/issues)
- [GitHub Discussions](https://github.com/twentynineteen/bucket/discussions)
