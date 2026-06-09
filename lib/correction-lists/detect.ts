import { CORRECTION_LIST_IDS } from '@/lib/correction-lists/catalog'

const CORRECTION_SHEET_MARKERS = [
  /PC\/STR\/Corr\.Lst\.\d+[A-Z]?/i,
  /Plan\s+Check\s+Correction\s+Sheet/i,
  /CORRECTIONS\s+SHALL\s+BE\s+VERIFIED/i,
  /PART\s+I\.\s*GENERAL\s+REQUIREMENTS/i,
  /PART\s+III\.\s*BUILDING\s+AND\s+RESIDENTIAL\s+CODE\s+REQUIREMENTS/i,
]

export interface CorrectionSheetDetection {
  is_correction_sheet: boolean
  list_id: string | null
  confidence: 'high' | 'medium' | 'low'
  markers_matched: string[]
}

export function detectCorrectionSheet(text: string): CorrectionSheetDetection {
  const flat = text.replace(/\s+/g, ' ')
  const markers_matched: string[] = []

  for (const marker of CORRECTION_SHEET_MARKERS) {
    if (marker.test(flat)) {
      markers_matched.push(marker.source)
    }
  }

  const listMatch = flat.match(/PC\/STR\/Corr\.Lst\.(\d+[A-Z]?)/i)
  const list_id =
    listMatch ?
      `PC/STR/Corr.Lst.${listMatch[1].toUpperCase()}`
    : markers_matched.length >= 2 ?
      CORRECTION_LIST_IDS.PC_STR_CORR_LST_20A
    : null

  const is_correction_sheet = markers_matched.length >= 2 || list_id != null
  const confidence: CorrectionSheetDetection['confidence'] =
    list_id && markers_matched.length >= 3 ? 'high'
    : list_id ? 'medium'
    : markers_matched.length >= 2 ? 'low'
    : 'low'

  return {
    is_correction_sheet,
    list_id,
    confidence,
    markers_matched,
  }
}
