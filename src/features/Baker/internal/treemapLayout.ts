/**
 * Squarified Treemap Layout
 *
 * Pure layout math for the Baker storage view. Given weighted items and a
 * bounding box, returns a rectangle per item using the squarified treemap
 * algorithm (Bruls, Huizing, van Wijk 2000), which keeps tile aspect ratios
 * close to 1 so labels stay readable.
 *
 * Internal utility -- not exported from the Baker barrel.
 */

export interface TreemapItem {
  /** Stable identifier carried through to the output rectangle */
  key: string
  /** Non-negative weight (bytes). Zero-weight items receive zero-area rects. */
  weight: number
}

export interface TreemapRect {
  key: string
  x: number
  y: number
  width: number
  height: number
}

/** Worst (max) aspect ratio in a row if `row` weights fill a strip of length `side`. */
function worstAspect(row: number[], side: number, totalArea: number): number {
  const sum = row.reduce((acc, w) => acc + w, 0)
  if (sum === 0 || side === 0) return Infinity

  const stripThickness = sum / side
  let worst = 0
  for (const w of row) {
    if (w === 0) continue
    const length = w / stripThickness
    const ratio = Math.max(length / stripThickness, stripThickness / length)
    worst = Math.max(worst, ratio)
  }
  // totalArea kept in the signature shape for clarity of units; weights are
  // already normalized to areas by the caller.
  void totalArea
  return worst === 0 ? Infinity : worst
}

/**
 * Compute a squarified treemap layout.
 *
 * Items are laid out in the given order (callers should pre-sort descending
 * by weight for the canonical squarified look). Weights are normalized so the
 * rectangles exactly tile `width` x `height`. Items with weight <= 0 are
 * returned as zero-area rectangles at the origin.
 */
export function computeTreemapLayout(
  items: TreemapItem[],
  width: number,
  height: number
): TreemapRect[] {
  const rects: TreemapRect[] = []
  if (width <= 0 || height <= 0) {
    return items.map((item) => ({ key: item.key, x: 0, y: 0, width: 0, height: 0 }))
  }

  const positive = items.filter((item) => item.weight > 0)
  const zeroes = items.filter((item) => item.weight <= 0)
  const totalWeight = positive.reduce((acc, item) => acc + item.weight, 0)

  if (totalWeight === 0) {
    return items.map((item) => ({ key: item.key, x: 0, y: 0, width: 0, height: 0 }))
  }

  // Normalize weights to areas in layout units.
  const scale = (width * height) / totalWeight
  let remaining = positive.map((item) => ({
    key: item.key,
    area: item.weight * scale
  }))

  let x = 0
  let y = 0
  let w = width
  let h = height

  while (remaining.length > 0) {
    const side = Math.min(w, h)
    const row: { key: string; area: number }[] = [remaining[0]]
    let rest = remaining.slice(1)

    // Grow the row while it improves (or keeps) the worst aspect ratio.
    while (rest.length > 0) {
      const current = worstAspect(
        row.map((r) => r.area),
        side,
        w * h
      )
      const withNext = worstAspect(
        [...row, rest[0]].map((r) => r.area),
        side,
        w * h
      )
      if (withNext > current) break
      row.push(rest[0])
      rest = rest.slice(1)
    }

    // Lay the row along the shorter side of the remaining box.
    const rowArea = row.reduce((acc, r) => acc + r.area, 0)
    const thickness = rowArea / side

    let offset = 0
    for (const r of row) {
      const length = r.area / thickness
      if (w <= h) {
        // Horizontal strip across the top of the remaining box.
        rects.push({ key: r.key, x: x + offset, y, width: length, height: thickness })
      } else {
        // Vertical strip down the left of the remaining box.
        rects.push({ key: r.key, x, y: y + offset, width: thickness, height: length })
      }
      offset += length
    }

    if (w <= h) {
      y += thickness
      h -= thickness
    } else {
      x += thickness
      w -= thickness
    }

    remaining = rest
  }

  for (const item of zeroes) {
    rects.push({ key: item.key, x: 0, y: 0, width: 0, height: 0 })
  }

  // Preserve caller ordering in the output.
  const byKey = new Map(rects.map((r) => [r.key, r]))
  return items.map((item) => byKey.get(item.key)!)
}
