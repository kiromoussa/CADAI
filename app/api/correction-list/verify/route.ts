import { NextResponse } from 'next/server'
import { summarizeVerification, verifyCatalogCodeCoverage } from '@/lib/correction-lists/verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dev/CI endpoint: verify that PC.STR.Corr.Lst.20A checklist codes exist in the code index.
 * Users upload their own plans (PDF/DWG), not the city's correction sheet PDF.
 */
export async function POST() {
  try {
    const result = verifyCatalogCodeCoverage()
    const summary = summarizeVerification(result)
    return NextResponse.json({ ...result, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
