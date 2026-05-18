import { loadFont } from '../internal/loadFont'
import type { Font } from 'opentype.js'
import { useCallback, useRef, useState } from 'react'

/**
 * Outcome of attempting to load the Cabrito font.
 *
 * - `unknown` — `draw()` hasn't been called yet, so we don't know if the font
 *   is available on this machine.
 * - `loaded` — the font file was found and parsed successfully; text overlay
 *   will render normally.
 * - `missing` — the expected font file isn't present on the user's machine
 *   (Cabrito.otf in macOS user fonts dir). The background image will still
 *   draw, but the title-text branch silently bails. Consumers should surface
 *   this so the user knows why the thumbnail looks blank.
 */
export type PosterframeFontStatus = 'unknown' | 'loaded' | 'missing'

export function usePosterframeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fontRef = useRef<Font | null>(null)
  const [fontStatus, setFontStatus] = useState<PosterframeFontStatus>('unknown')

  /**
   * Paint the background image and (optionally) the title text onto the
   * canvas, awaiting all asynchronous loading first.
   *
   * The previous implementation registered `img.onload` as a callback and let
   * the outer `async` function resolve immediately. Callers that awaited
   * `draw(...)` (the auto-redraw hook, and most importantly the save handler)
   * would proceed before any pixels had been written, capturing an empty or
   * partial canvas. This version awaits the image load before continuing so
   * `await draw(...)` actually waits for the paint to complete.
   */
  const draw = useCallback(async (imageUrl: string, title: string): Promise<void> => {
    if (!canvasRef.current || !imageUrl) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    // Promisify Image loading so we can `await` it and avoid the
    // fire-and-forget race that hid this code's effect from any caller.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error(`Posterframe image failed to load: ${imageUrl}`))
      i.src = imageUrl
    })

    // 1) match canvas to image
    canvas.width = img.width
    canvas.height = img.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    // 2) load & cache font. loadFont() returns null when the expected
    // Cabrito.otf isn't present in the macOS user fonts directory — we
    // record that as `fontStatus = 'missing'` so the component can warn
    // the user instead of silently producing a thumbnail with no text.
    if (!fontRef.current) {
      const loaded = await loadFont()
      fontRef.current = loaded
      setFontStatus(loaded ? 'loaded' : 'missing')
    }
    const font = fontRef.current
    if (!font || !title.trim()) return

    // 3) layout params
    const fontSize = 37 // px
    const xStart = 292 // left edge of box
    const yStart = 467 // first-line baseline
    const maxWidth = 380 // box width
    const lineHeight = 45 // px between baselines
    const letterSpacing = 1.5 // extra px between glyphs

    // 4) word-wrap into lines[]
    const lines: string[] = []
    {
      let line = ''
      for (const word of title.split(' ')) {
        const testLine = line + word + ' '
        // measure width of testLine manually (including letterSpacing)
        const glyphs = font.stringToGlyphs(testLine)
        let widthPx = 0
        for (const g of glyphs) {
          widthPx += g.advanceWidth * (fontSize / font.unitsPerEm) + letterSpacing
        }
        if (widthPx > maxWidth && line) {
          lines.push(line.trim())
          line = word + ' '
        } else {
          line = testLine
        }
      }
      if (line) lines.push(line.trim())
    }

    // 5) set up clipping region to restore your bounding box
    const boxX = xStart
    const boxY = yStart - fontSize // top of first line
    const boxW = maxWidth
    const boxH = lines.length * lineHeight // height for all lines
    ctx.save()
    ctx.beginPath()
    ctx.rect(boxX, boxY, boxW, boxH)
    ctx.clip()

    // 6) draw each line glyph-by-glyph with letterSpacing
    let y = yStart
    for (const line of lines) {
      let x = xStart
      const glyphs = font.stringToGlyphs(line)
      for (const glyph of glyphs) {
        const path = glyph.getPath(x, y, fontSize)
        path.fill = 'white'
        path.stroke = null
        path.draw(ctx)
        // advance x
        const adv = glyph.advanceWidth * (fontSize / font.unitsPerEm)
        x += adv + letterSpacing
      }
      y += lineHeight
    }

    // 7) restore so any further drawing isn't clipped
    ctx.restore()
  }, [])

  return { canvasRef, draw, fontStatus }
}
