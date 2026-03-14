import opentype, { Font } from 'opentype.js'

import { fileExists, getFontDir, readFileAsBytes } from '../api'

let parsedFont: Font | null = null

/**
 * Load our Cabrito font from the Tauri font directory,
 * register it with document.fonts, AND parse it with OpenType.js.
 * Returns the parsed Font instance for vector rendering.
 */
export async function loadFont(): Promise<Font | null> {
  // If we've already parsed it once, just return it
  if (parsedFont) {
    return parsedFont
  }
  // Load the font from the Tauri font directory
  const fontPath = await getFontDir()
  const path = `${fontPath}/Cabrito.otf`

  // Check if the font file exists return null if not
  const found = await fileExists(path)
  if (!found) return null

  // Read raw bytes from the font file
  const data = await readFileAsBytes(path)
  const uint8 = new Uint8Array(data)

  // Register a CSS FontFace so fillText() still works
  const blob = new Blob([uint8], { type: 'font/otf' })
  const url = URL.createObjectURL(blob)

  const font = new FontFace('Cabrito', `url(${url})`)
  await font.load()
  document.fonts.add(font)

  // Parse with OpenType.js for vector outlines
  //    opentype.parse() expects an ArrayBuffer
  parsedFont = opentype.parse(uint8.buffer)
  return parsedFont
}
