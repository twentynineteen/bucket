import { loadFont } from '@utils/loadFont'
import type { Font } from 'opentype.js'
import { useCallback, useRef } from 'react'

export function usePosterframeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fontRef = useRef<Font | null>(null)

  const draw = useCallback(async (imageUrl: string, title: string) => {
    if (!canvasRef.current || !imageUrl) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    const img = new Image()
    img.src = imageUrl
    img.onload = async () => {
      // 1) match canvas to image
      canvas.width = img.width
      canvas.height = img.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      // 2) load & cache font
      if (!fontRef.current) {
        fontRef.current = await loadFont()
      }
      const font = fontRef.current
      if (!font || !title.trim()) return

      // 3) layout params
      const fontSize = 37 // px
      const xStart = 292 // left edge of box
      const yStart = 467 // first‐line baseline
      const maxWidth = 380 // box width
      const lineHeight = 45 // px between baselines
      const letterSpacing = 1.5 // extra px between glyphs

      // 4) word‐wrap into lines[]
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

      // 6) draw each line glyph‐by‐glyph with letterSpacing
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

      // 7) restore so any further drawing isn’t clipped
      ctx.restore()
    }
  }, [])

  return { canvasRef, draw }
}
