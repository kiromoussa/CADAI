import 'server-only'

import path from 'node:path'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

GlobalWorkerOptions.workerSrc = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
)

const MAX_CANVAS_EDGE_PX = 8192

export async function renderPdfToPngPages(
  pdfBase64: string,
  scale = 3
): Promise<string[]> {
  const data = Uint8Array.from(Buffer.from(pdfBase64, 'base64'))
  const doc = await getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  const pages: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: effectiveScale(page, scale) })
      const canvas = createCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise
      const cropped = cropCanvasToContent(canvas)
      pages.push(cropped.toBuffer('image/png').toString('base64'))
    } catch (err) {
      console.warn(`[pdf-render] Skipping page ${pageNum}:`, err)
    }
  }

  if (pages.length === 0) {
    throw new Error('PDF render produced no pages')
  }
  return pages
}

function effectiveScale(
  page: { getViewport: (opts: { scale: number }) => { width: number; height: number } },
  requestedScale: number
): number {
  const atOne = page.getViewport({ scale: 1 })
  const maxEdge = Math.max(atOne.width, atOne.height)
  if (maxEdge * requestedScale <= MAX_CANVAS_EDGE_PX) {
    return requestedScale
  }
  return Math.max(1, MAX_CANVAS_EDGE_PX / maxEdge)
}

function cropCanvasToContent(canvas: Canvas): Canvas {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const alpha = data[i + 3]
      if (alpha === 0) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r > 250 && g > 250 && b > 250) continue

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return canvas
  }

  const pad = 24
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width, maxX + pad)
  maxY = Math.min(height, maxY + pad)

  const cropW = maxX - minX
  const cropH = maxY - minY
  const cropped = createCanvas(cropW, cropH)
  const cropCtx = cropped.getContext('2d')
  cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

  const targetWidth = 2400
  if (cropW >= targetWidth) {
    return cropped
  }

  const upscale = targetWidth / cropW
  const upscaled = createCanvas(Math.round(cropW * upscale), Math.round(cropH * upscale))
  const upCtx = upscaled.getContext('2d')
  upCtx.imageSmoothingEnabled = true
  upCtx.drawImage(cropped, 0, 0, upscaled.width, upscaled.height)
  return upscaled
}
