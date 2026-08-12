/**
 * Report formatting (issue #180, stage 2)
 *
 * Kept out of the page component so both stay simple, and so the arithmetic is
 * testable without rendering anything.
 */

/** `m:ss.s`, because a QC report is read against a timeline. */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const minutes = Math.floor(safe / 60)
  const remainder = safe - minutes * 60
  return `${minutes}:${remainder < 10 ? '0' : ''}${remainder.toFixed(1)}`
}

/**
 * Filename prefix for saved evidence, taken from the render's own name.
 *
 * Evidence for two different renders lands in the same folder often enough that
 * the filenames have to say which render they came from.
 */
export function evidencePrefix(videoPath: string | null): string {
  if (!videoPath) return 'kavanagh'

  const name = videoPath.split('/').pop() ?? ''
  const stem = name.replace(/\.[^.]+$/, '')
  return stem === '' ? 'kavanagh' : `kavanagh-${stem}`
}

/** Wording for a progress phase. */
export function phaseLabel(phase: 'probe' | 'watermark' | 'refine'): string {
  switch (phase) {
    case 'probe':
      return 'Reading the video'
    case 'watermark':
      return 'Checking the watermark'
    case 'refine':
      return 'Measuring the gaps'
  }
}

/** Wording for a corner, including when there is not one. */
export function cornerLabel(corner: 'topLeft' | 'topRight' | null): string {
  if (corner === 'topLeft') return 'top-left'
  if (corner === 'topRight') return 'top-right'
  return 'no corner established'
}

/**
 * Base64 for a byte array.
 *
 * Chunked rather than spread in one call: a 400KB thumbnail spread into
 * `String.fromCharCode` overflows the argument limit and throws.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}
