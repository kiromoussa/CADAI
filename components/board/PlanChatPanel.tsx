'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { PlanChatResponse } from '@/lib/analysis/plan-chat'

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  meta?: PlanChatResponse
}

interface PlanChatPanelProps {
  analysisId: string | null
  className?: string
}

export function PlanChatPanel({ analysisId, className }: PlanChatPanelProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!analysisId || !input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/analyses/${analysisId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })
      const data = (await res.json()) as {
        response?: PlanChatResponse
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Chat failed')
      const response = data.response!
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, meta: response },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={clsx('flex h-full flex-col', className)}>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Plan chat</h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Ask code questions grounded in this plan and its findings.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!analysisId && (
          <p className="text-sm text-text-secondary">
            Run a compliance check on a plan node to enable plan chat.
          </p>
        )}
        {messages.length === 0 && analysisId && (
          <p className="text-sm text-text-secondary">
            Try: &quot;Does egress width satisfy code for this occupancy?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={clsx(
              'rounded-lg px-3 py-2 text-sm',
              m.role === 'user'
                ? 'ml-6 bg-accent/15 text-text-primary'
                : 'mr-6 bg-background/60 text-text-primary'
            )}
          >
            <p>{m.content}</p>
            {m.meta && (
              <div className="mt-2 space-y-1 text-xs text-text-secondary">
                {m.meta.code_citations.length > 0 && (
                  <p>Citations: {m.meta.code_citations.join(', ')}</p>
                )}
                {m.meta.sheet_reference && <p>Sheet: {m.meta.sheet_reference}</p>}
                <p>Confidence: {m.meta.confidence}</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p className="text-xs text-text-secondary">Thinking…</p>
        )}
        {error && <p className="text-xs text-severity-violation">{error}</p>}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            disabled={!analysisId || loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send()
            }}
            placeholder={analysisId ? 'Ask about this plan…' : 'Select a analyzed plan first'}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!analysisId || loading || !input.trim()}
            onClick={() => void send()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
