/**
 * Turns a `baker_get_video_links` failure into something a user can act on.
 *
 * That command reads the project's local `breadcrumbs.json`
 * (`src-tauri/src/baker/video_links.rs`); it never contacts Sprout Video. Every
 * failure it can produce is therefore a problem reaching a file on this
 * machine, and the three it can produce want three different things from the
 * user: reconnect a drive, free up a locked file, or repair a corrupted one.
 * Passing the backend's own words through as the headline told the user none of
 * that (issue #226).
 *
 * This deliberately duplicates the shape of `Trello/internal/trelloCardsError.ts`
 * rather than sharing it. The two commands do produce the same three backend
 * strings, but importing another feature's `internal/` breaks the module rules,
 * and `@shared` must not carry copy that names a feature's own remedies. The
 * copy also legitimately differs: the noun, and the reassurance about where the
 * user's actual work is safe.
 *
 * Rust errors arrive over the Tauri IPC boundary as plain strings rather than
 * Error instances, so match on the message either way.
 */

export interface VideoLinksErrorCopy {
  /** Headline. Never the raw error string. */
  title: string
  /** What went wrong, and what the user can do about it. */
  description: string
  /** The raw error, for the diagnostics disclosure and the log. */
  detail: string
}

export function describeVideoLinksError(error: unknown): VideoLinksErrorCopy {
  const detail = error instanceof Error ? error.message : String(error)
  const haystack = detail.toLowerCase()

  if (haystack.includes('project path does not exist')) {
    return {
      title: 'Project folder not found on this machine',
      description:
        "Bucket could not reach this project's folder, so the videos linked to it could not be loaded. If the project lives on an external drive, reconnect it and retry.",
      detail
    }
  }

  if (haystack.includes('failed to parse breadcrumbs')) {
    return {
      title: "This project's breadcrumbs file could not be read",
      description:
        'The breadcrumbs.json file in this project folder is not valid JSON, so the videos recorded in it could not be loaded. Repair or regenerate it in Baker, then retry.',
      detail
    }
  }

  if (haystack.includes('failed to read breadcrumbs')) {
    return {
      title: "This project's breadcrumbs file could not be read",
      description:
        'Bucket could not open breadcrumbs.json in this project folder. Check the file is readable and not open in another application, then retry.',
      detail
    }
  }

  return {
    title: 'Linked videos could not be loaded',
    description:
      'Bucket could not read the videos linked to this project. The videos themselves are unaffected on Sprout Video. Retry, and check the project folder is reachable.',
    detail
  }
}
