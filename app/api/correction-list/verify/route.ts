import { NextResponse } from 'next/server'
import { detectCorrectionSheet } from '@/lib/correction-lists/detect'
import { parseCorrectionSheetFromPdf } from '@/lib/correction-lists/parse-pdf'
import {
  summarizeVerification,
  verifyCatalogCodeCoverage,
  verifyUploadedCorrectionSheet,
} from '@/lib/correction-lists/verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface VerifyRequestBody {
  mode?: 'catalog' | 'text' | 'pdf'
  text?: string
  pdf_base64?: string
  list_id?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyRequestBody
    const mode = body.mode ?? (body.pdf_base64 ? 'pdf' : body.text ? 'text' : 'catalog')

    if (mode === 'catalog') {
      const result = verifyCatalogCodeCoverage()
      const summary = summarizeVerification(result)
      return NextResponse.json({ ...result, summary })
    }

    if (mode === 'text') {
      if (!body.text?.trim()) {
        return NextResponse.json({ error: 'text is required for mode=text' }, { status: 400 })
      }
      const result = verifyUploadedCorrectionSheet(body.text, body.list_id)
      const summary = summarizeVerification(result)
      return NextResponse.json({
        ...result,
        summary,
        detection: result.detection,
      })
    }

    if (mode === 'pdf') {
      if (!body.pdf_base64) {
        return NextResponse.json({ error: 'pdf_base64 is required for mode=pdf' }, { status: 400 })
      }
      const buffer = Buffer.from(body.pdf_base64, 'base64')
      const parsed = await parseCorrectionSheetFromPdf(buffer)
      const text = (await import('@/lib/correction-lists/parse-pdf')).extractTextFromPdfBuffer
      const flatText = await text(buffer)
      const detection = detectCorrectionSheet(flatText)
      const result = verifyUploadedCorrectionSheet(flatText, body.list_id)
      const summary = summarizeVerification(result)
      return NextResponse.json({
        ...result,
        parsed_from_pdf: {
          total_items: parsed.total_items,
          unique_code_refs: parsed.unique_code_refs.length,
        },
        summary,
        detection,
      })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
