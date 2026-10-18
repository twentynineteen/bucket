/**
 * Motion frame renderer e2e tests (issue #335)
 *
 * These tests need a real browser canvas, which jsdom does not provide.
 * They load the frameRenderer module directly through page.evaluate()
 * against the Vite dev server.
 *
 * P5.3: PNG output with correct dimensions and alpha
 * P5.4: Particle canvas compositing
 */
import { expect, test } from '@playwright/test'
import { stubGitHubReleases } from '../fixtures/mocks.fixture'

test.describe('motion frame renderer', () => {
  test.beforeEach(async ({ page }) => {
    await stubGitHubReleases(page)
  })

  // P5.3: single opaque rect frame
  test('p5_3_png_frame_has_correct_dimensions_and_alpha', async ({ page }) => {
    // Navigate to the app so Vite modules are available
    await page.goto('/')

    const result = await page.evaluate(async () => {
      // Import the frame renderer from the Vite dev server
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const fr: any = await import(
        '/src/features/Motion/internal/frameRenderer.ts' as any
      )
      const rv: any = await import('/src/features/Motion/internal/resolve.ts' as any)
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const { renderFrameToPng } = fr
      const { resolveTemplate } = rv

      const template = {
        schemaVersion: 1 as const,
        id: 'test-rect',
        version: '1.0.0',
        name: 'Test Rect',
        description: 'E2E test fixture',
        category: 'lower-third' as const,
        status: 'stable' as const,
        tags: [],
        fonts: [],
        duration: 1,
        inEnd: 0.5,
        outStart: 0.5,
        params: {},
        layers: [
          {
            kind: 'rect' as const,
            id: 'opaque-rect',
            anchor: { x: 0, y: 0 },
            position: [{ t: 0, value: { x: 100, y: 100 } }],
            opacity: [{ t: 0, value: 1 }],
            width: 200,
            height: 200,
            fill: '#ff0000',
            radius: 0
          }
        ]
      }

      const format = { width: 1920 as const, height: 1080 as const, fps: 25 as const }
      const resolved = resolveTemplate(template, {}, format)
      const png = await renderFrameToPng(resolved, 0, format, [])

      // Check PNG signature
      const sig = [png[0], png[1], png[2], png[3]]

      // Decode the PNG to check dimensions and pixel data
      const blob = new Blob([png], { type: 'image/png' })
      const bitmap = await createImageBitmap(blob)
      const w = bitmap.width
      const h = bitmap.height

      // Sample pixels using a canvas
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)

      // Pixel at the centre of the rect (3840 space 100..300 scales to 1920 space 50..150)
      const insidePixel = ctx.getImageData(100, 100, 1, 1).data
      // Corner pixel (0, 0) should be transparent
      const cornerPixel = ctx.getImageData(0, 0, 1, 1).data

      return {
        sig,
        width: w,
        height: h,
        insideAlpha: insidePixel[3],
        cornerAlpha: cornerPixel[3]
      }
    })

    // PNG signature: 0x89, 0x50 ('P'), 0x4E ('N'), 0x47 ('G')
    expect(result.sig).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
    expect(result.insideAlpha).toBe(255)
    expect(result.cornerAlpha).toBe(0)
  })

  // P5.4: particle canvas compositing
  test('p5_4_particle_canvas_composited_into_frame', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const fr: any = await import(
        '/src/features/Motion/internal/frameRenderer.ts' as any
      )
      const rv: any = await import('/src/features/Motion/internal/resolve.ts' as any)
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const { renderFrameToPng } = fr
      const { resolveTemplate } = rv

      const template = {
        schemaVersion: 1 as const,
        id: 'test-particles',
        version: '1.0.0',
        name: 'Test Particles',
        description: 'E2E test fixture',
        category: 'data' as const,
        status: 'stable' as const,
        tags: [],
        fonts: [],
        duration: 2,
        inEnd: 1,
        outStart: 1.5,
        params: {},
        layers: [
          {
            kind: 'particles' as const,
            id: 'dots',
            anchor: { x: 0, y: 0 },
            // Points at known positions (in 3840x2160 space)
            // At 1920x1080, these scale to 480, 540 and 960, 540
            points: [
              { x: 960, y: 1080 },
              { x: 1920, y: 1080 }
            ],
            seed: 42,
            assembleStart: 0,
            assembleEnd: 0.5,
            baseFill: '#ff0000',
            regionFills: {},
            pointRadius: 20
          }
        ]
      }

      const format = { width: 1920 as const, height: 1080 as const, fps: 25 as const }
      // Render at t=1.0, which is after assembly (hold phase)
      const resolved = resolveTemplate(template, {}, format)
      const png = await renderFrameToPng(resolved, 1.0, format, [])

      const blob = new Blob([png], { type: 'image/png' })
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)

      // Check pixels at assembled point positions (scaled to 1920x1080)
      // Point 1: 960/2=480, 1080/2=540
      // Point 2: 1920/2=960, 1080/2=540
      const p1 = ctx.getImageData(480, 540, 1, 1).data
      const p2 = ctx.getImageData(960, 540, 1, 1).data

      return {
        p1Alpha: p1[3],
        p2Alpha: p2[3]
      }
    })

    // During hold phase, particles should be assembled at their target positions
    expect(result.p1Alpha).toBeGreaterThan(0)
    expect(result.p2Alpha).toBeGreaterThan(0)
  })
})
