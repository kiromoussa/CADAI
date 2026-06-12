import type { CanvasNodeRow } from '@/types/database'
import type { CanvasNodeContent } from '@/types/canvas'

/** Same URN resolution as the main viewer: node field, then linked project. */
export function resolveForgeUrn(
  node: CanvasNodeRow,
  projectUrns: Record<string, string | null>
): string | null {
  if (node.aps_urn) return node.aps_urn
  if (node.project_id && projectUrns[node.project_id]) {
    return projectUrns[node.project_id]
  }
  return null
}

export function forgeNodeStatus(node: CanvasNodeRow): CanvasNodeContent['upload_status'] {
  const content = (node.content ?? {}) as CanvasNodeContent
  return content.upload_status
}
