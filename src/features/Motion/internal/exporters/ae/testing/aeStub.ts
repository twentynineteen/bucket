/**
 * Minimal AE ExtendScript object model stub (issue #329)
 *
 * Provides a stub of `app`, `CompItem`, `TextLayer`, `ShapeLayer`,
 * `KeyframeEase`, `alert`, `File` etc. for running generated scripts
 * in a Node vm context and recording what they did.
 *
 * Test-only helper. Not part of the production build.
 */

/** Recorded call to the AE stub. */
export interface AEStubCall {
  method: string
  args: unknown[]
}

/** Result of running a script in the AE stub. */
export interface AEStubResult {
  calls: AEStubCall[]
  comps: AEStubComp[]
  alerts: string[]
}

export interface AEStubComp {
  name: string
  width: number
  height: number
  pixelAspect: number
  duration: number
  frameRate: number
  layers: AEStubLayer[]
}

export interface AEStubLayer {
  kind: string
  name: string
  properties: Record<string, AEStubProperty>
  essentialProperties?: string[]
}

export interface AEStubProperty {
  keyframes: AEStubKeyframe[]
  expression?: string
  value?: unknown
}

export interface AEStubKeyframe {
  time: number
  value: unknown
  inEase?: { speed: number; influence: number }[]
  outEase?: { speed: number; influence: number }[]
  spatialInterpolation?: string
}

/**
 * Run a generated .jsx script in a sandboxed vm context with the AE stub.
 */
export function runInAEStub(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  script: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: { missingFonts?: string[] }
): AEStubResult {
  throw new Error('Not implemented')
}
