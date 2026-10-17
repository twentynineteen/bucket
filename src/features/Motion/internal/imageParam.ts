/**
 * Image param application - pure function for replacing particle layer points
 * from a decoded image, keyed by each layer's imageParam field.
 *
 * The dialog does I/O (pick, read, decode) and calls applyImageParam to get
 * the updated template and values. This keeps the sampling logic testable
 * as a pure function.
 */
import type {
  ImageValue,
  Layer,
  MotionTemplate,
  ParamValues,
  ParticlesLayer
} from '../types'
import { samplePoints } from './sampler'

export interface DecodedImage {
  rgba: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

/** Target point count, approximately matching the built-in templates' density. */
const TARGET_POINT_COUNT = 4500

/** Hard cap on sampled points to prevent performance problems. */
const MAX_POINTS = 8000

/**
 * Compute the bounding box of a set of points (used as the re-sampling
 * target box, matching the built-in points' extent).
 */
function pointsBoundingBox(points: { x: number; y: number }[]): {
  x: number
  y: number
  w: number
  h: number
} {
  if (points.length === 0) return { x: 0, y: 0, w: 3840, h: 2160 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Derive the minDistance from the image dimensions and a target point count.
 * For Poisson-disc sampling, point count ~ area / (minDistance^2 * pi/4).
 * We invert that to get a minDistance that produces roughly TARGET_POINT_COUNT
 * points in the opaque area (approximated as the whole image).
 */
function deriveMinDistance(
  imgWidth: number,
  imgHeight: number,
  targetCount: number
): number {
  // area / targetCount ~ (minDist^2 * pi/4), so minDist ~ sqrt(area * 4 / (pi * targetCount))
  const area = imgWidth * imgHeight
  const dist = Math.sqrt((area * 4) / (Math.PI * targetCount))
  return Math.max(2, dist)
}

/**
 * Fit the source image dimensions inside the target box while preserving
 * aspect ratio (letterbox). Returns the fitted box within the target.
 */
function fitInsideBox(
  imgWidth: number,
  imgHeight: number,
  targetBox: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  const imgAspect = imgWidth / imgHeight
  const boxAspect = targetBox.w / targetBox.h

  let fitW: number
  let fitH: number

  if (imgAspect > boxAspect) {
    // Image is wider than box - fit to width
    fitW = targetBox.w
    fitH = targetBox.w / imgAspect
  } else {
    // Image is taller than box - fit to height
    fitH = targetBox.h
    fitW = targetBox.h * imgAspect
  }

  const offsetX = targetBox.x + (targetBox.w - fitW) / 2
  const offsetY = targetBox.y + (targetBox.h - fitH) / 2

  return { x: offsetX, y: offsetY, w: fitW, h: fitH }
}

export interface ApplyImageResult {
  template: MotionTemplate
  values: ParamValues
}

/**
 * Thin an array of points evenly by selecting every k-th point, keeping
 * the first and last. This preserves spatial coverage across the whole
 * image rather than slicing off a contiguous region.
 */
/** @internal Exported for testing only. */
export function thinEvenly<T>(points: T[], maxCount: number): T[] {
  if (points.length <= maxCount) return points
  const step = (points.length - 1) / (maxCount - 1)
  const result: T[] = []
  for (let i = 0; i < maxCount; i++) {
    result.push(points[Math.round(i * step)])
  }
  return result
}

/**
 * Apply a decoded image to a template's particle layers, recursing into groups.
 *
 * For each particle layer that declares an `imageParam`, this function:
 * 1. Finds the param id from `layer.imageParam`
 * 2. Re-samples the image using the layer's own seed
 * 3. Fits the image into the layer's built-in bounding box preserving aspect ratio
 * 4. Caps the point count at MAX_POINTS by thinning evenly
 * 5. Sets the param value keyed by the actual param id (not hard-coded "image")
 *
 * Re-sampled points carry no `region`, because the image has no region data.
 */
export function applyImageParam(
  template: MotionTemplate,
  values: ParamValues,
  decoded: DecodedImage,
  pickedPath: string
): ApplyImageResult {
  const nextValues: ParamValues = { ...values }

  function processLayer(layer: Layer): Layer {
    if (layer.kind === 'group') {
      return { ...layer, children: layer.children.map(processLayer) }
    }
    if (layer.kind !== 'particles') return layer
    const pLayer = layer as ParticlesLayer
    if (!pLayer.imageParam) return layer

    const paramId = pLayer.imageParam
    const targetBox = pointsBoundingBox(pLayer.points)
    const fittedBox = fitInsideBox(decoded.width, decoded.height, targetBox)

    const minDist = deriveMinDistance(decoded.width, decoded.height, TARGET_POINT_COUNT)

    let newPoints = samplePoints({
      rgba: decoded.rgba,
      width: decoded.width,
      height: decoded.height,
      minDistance: minDist,
      seed: pLayer.seed,
      targetBox: fittedBox
    })

    // Cap the point count by thinning evenly (preserves spatial coverage)
    if (newPoints.length > MAX_POINTS) {
      newPoints = thinEvenly(newPoints, MAX_POINTS)
    }

    // Set the param value keyed by the actual param id
    const imgVal: ImageValue = { pickedPath }
    nextValues[paramId] = imgVal

    return { ...layer, points: newPoints }
  }

  const nextLayers = template.layers.map(processLayer)

  return {
    template: { ...template, layers: nextLayers },
    values: nextValues
  }
}
