/**
 * The progress display and the stall message quote the same file, so they have to
 * agree about how big it is. The figures pinned here are the exact ones Rust's
 * `the_stall_message_names_the_offset_the_total_and_the_silence` pins, which is
 * what makes the agreement checkable rather than assumed.
 *
 * `formatFileSize` in `@shared/utils` is deliberately not reused: it divides by
 * 1024 while labelling the result "GB", so the same 1.68 GB file would appear as
 * 1.56 GB beside a stall message saying 1.68 GB. Two numbers for one file in one
 * dialog is worse than a second small formatter. See issue #225.
 */
import { describe, expect, it } from 'vitest'

import { formatTransferredBytes } from './formatTransferredBytes'

describe('formatTransferredBytes', () => {
  it('agrees with the Rust stall message on the figures it quotes', () => {
    expect(formatTransferredBytes(1_680_000_000)).toBe('1.68 GB')
    expect(formatTransferredBytes(4_100_000_000)).toBe('4.10 GB')
  })

  it('uses the decimal units macOS shows in Finder, not binary ones', () => {
    // 1024^3 bytes is 1.07 decimal GB. Reporting it as "1.00 GB" would be the
    // binary convention and would not match the size the user sees on the file.
    expect(formatTransferredBytes(1024 * 1024 * 1024)).toBe('1.07 GB')
  })

  it('drops to megabytes below a gigabyte so a small render is still readable', () => {
    expect(formatTransferredBytes(200_000_000)).toBe('200.0 MB')
  })

  it('reports nothing sent as zero rather than an empty string', () => {
    expect(formatTransferredBytes(0)).toBe('0 bytes')
  })
})
