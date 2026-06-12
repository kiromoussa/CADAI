import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export async function getBoardForUser(
  supabase: Client,
  boardId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('canvas_boards')
    .select('*')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data
}

export async function getNodeForBoard(
  supabase: Client,
  boardId: string,
  nodeId: string
) {
  const { data, error } = await supabase
    .from('canvas_nodes')
    .select('*')
    .eq('id', nodeId)
    .eq('board_id', boardId)
    .single()

  if (error || !data) return null
  return data
}
