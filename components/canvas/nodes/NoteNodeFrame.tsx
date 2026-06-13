'use client'

import { useEffect, useState } from 'react'
import type { CanvasNodeRow } from '@/types/database'

interface NoteNodeFrameProps {
  node: CanvasNodeRow
  onContentChange: (nodeId: string, text: string) => void
}

export function NoteNodeFrame({ node, onContentChange }: NoteNodeFrameProps) {
  const content = (node.content ?? {}) as { text?: string; label?: string }
  const [text, setText] = useState(content.text ?? '')

  useEffect(() => {
    setText(content.text ?? '')
  }, [content.text])

  return (
    <div className="flex h-full flex-col bg-amber-500/5 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onContentChange(node.id, text)}
        placeholder="Add a note, comment, or checklist item…"
        className="min-h-0 flex-1 resize-none rounded border border-amber-500/20 bg-background/80 px-2 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-amber-500/40 focus:outline-none"
      />
    </div>
  )
}
