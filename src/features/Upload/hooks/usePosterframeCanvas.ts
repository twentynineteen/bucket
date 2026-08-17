import { loadFont } from '../internal/loadFont'
import {
  isOffAspectBackground,
  resolvePosterframeLayout,
  wrapPosterframeTitle,
  type PosterframeTemplateId
} from '../internal/posterframeTemplates'
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
  // Whether the last-drawn background deviates from 16:9 (issue #189 B4.2).
  // The layout still renders - scaled by height - but the text may sit oddly,
  // so consumers surface a warning rather than a block.
  const [offAspect, setOffAspect] = useState(false)

  /**
   * Paint the background image and (optionally) the title text onto the
   * canvas, laid out by the given template, awaiting all asynchronous loading
   * first.
   *
   * The previous implementation registered `img.onload` as a callback and let
   * the outer `async` function resolve immediately. Callers that awaited
   * `draw(...)` (the auto-redraw hook, and most importantly the save handler)
   * would proceed before any pixels had been written, capturing an empty or
   * partial canvas. This version awaits the image load before continuing so
   * `await draw(...)` actually waits for the paint to complete.
   */
  const draw = useCallback(
    async (
      imageUrl: string,
      title: string,
      templateId: PosterframeTemplateId
    ): Promise<void> => {
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
        i.onerror = () =>
          reject(new Error(`Posterframe image failed to load: ${imageUrl}`))
        i.src = imageUrl
      })

      // 1) match canvas to image
      canvas.width = img.width
      canvas.height = img.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      setOffAspect(isOffAspectBackground(img.width, img.height))

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

      // 3) resolve the template's layout for this image (issue #189)
      const layout = resolvePosterframeLayout(templateId, img.width, img.height, {
        ascender: font.ascender,
        unitsPerEm: font.unitsPerEm
      })

      // 4) word-wrap into lines[]
      const lines = wrapPosterframeTitle(font, title, layout)

      // 5) set up clipping region for the text box. The height grows with the
      // line count on purpose - long titles render in full (#189 B1.5). The
      // top keeps the original baseline-minus-fontSize convention, NOT the
      // metrics-derived box top: Classic thumbnails have always been clipped
      // this way and must not shift (#189 B4.1).
      ctx.save()
      ctx.beginPath()
      ctx.rect(
        layout.x,
        layout.firstBaselineY - layout.fontSize,
        layout.maxWidth,
        lines.length * layout.lineHeight
      )
      ctx.clip()

      // 6) draw each line glyph-by-glyph with letterSpacing
      let y = layout.firstBaselineY
      for (const line of lines) {
        let x = layout.x
        const glyphs = font.stringToGlyphs(line)
        for (const glyph of glyphs) {
          const path = glyph.getPath(x, y, layout.fontSize)
          path.fill = 'white'
          path.stroke = null
          path.draw(ctx)
          // advance x
          const adv = glyph.advanceWidth * (layout.fontSize / font.unitsPerEm)
          x += adv + layout.letterSpacing
        }
        y += layout.lineHeight
      }

      // 7) restore so any further drawing isn't clipped
      ctx.restore()
    },
    []
  )

  return { canvasRef, draw, fontStatus, offAspect }
}
