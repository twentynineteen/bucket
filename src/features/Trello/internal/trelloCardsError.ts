/**
 * Turns a `baker_get_trello_cards` failure into something a user can act on.
 *
 * That command reads the project's local `breadcrumbs.json`
 * (`src-tauri/src/baker/video_links.rs`); it never talks to Trello. Every
 * failure it can produce is therefore a problem reaching a file on this
 * machine, and the three it can produce need three different things from the
 * user: reconnect a drive, free up a locked file, or repair a corrupted one.
 * Passing the backend's own words through as the headline told the user none of
 * that (issue #212).
 *
 * Rust errors arrive over the Tauri IPC boundary as plain strings rather than
 * Error instances, so match on the message either way.
 */

export interface TrelloCardsErrorCopy {
  /** Headline. Never the raw error string. */
  title: string
  /** What went wrong, and what the user can do about it. */
  description: string
  /** The raw error, for the diagnostics disclosure and the log. */
  detail: string
}

export function describeTrelloCardsError(error: unknown): TrelloCardsErrorCopy {
  const detail = error instanceof Error ? error.message : String(error)
  const haystack = detail.toLowerCase()

  if (haystack.includes('project path does not exist')) {
    return {
      title: 'Project folder not found on this machine',
      description:
        "Bucket could not reach this project's folder, so the Trello cards linked to it could not be loaded. If the project lives on an external drive, reconnect it and retry.",
      detail
    }
  }

  if (haystack.includes('failed to parse breadcrumbs')) {
    return {
      title: "This project's breadcrumbs file could not be read",
      description:
        'The breadcrumbs.json file in this project folder is not valid JSON, so the Trello cards recorded in it could not be loaded. Repair or regenerate it in Baker, then retry.',
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
    title: 'Linked Trello cards could not be loaded',
    description:
      'Bucket could not read the Trello cards linked to this project. The cards themselves are unaffected in Trello. Retry, and check the project folder is reachable.',
    detail
  }
}
