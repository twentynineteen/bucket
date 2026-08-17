/**
 * Renders a transfer byte count for the upload UI.
 *
 * Deliberately mirrors `format_bytes` in `src-tauri/src/commands/sprout_upload.rs`
 * tier for tier, because the progress display and the stall message describe the
 * same file side by side and must not disagree about how big it is.
 *
 * `formatFileSize` in `@shared/utils` is not reused: it divides by 1024 while
 * labelling the result "GB", so a 1.68 GB file would read as 1.56 GB next to a
 * backend message saying 1.68 GB. Decimal units are also what macOS reports, so
 * the figure matches the one the user sees on the file in Finder. See issue #225.
 */
export function formatTransferredBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`
  }
  return `${bytes} bytes`
}
