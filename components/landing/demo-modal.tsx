'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useForm, ValidationError } from '@formspree/react'

const FORMSPREE_FORM_ID = 'mwvzrveq'

type DemoModalContextValue = {
  openDemo: () => void
}

const DemoModalContext = createContext<DemoModalContextValue | null>(null)

export function useDemoModal() {
  const context = useContext(DemoModalContext)
  if (!context) {
    throw new Error('useDemoModal must be used within DemoModalProvider')
  }
  return context
}

function DemoModal({ onClose }: { onClose: () => void }) {
  const [state, handleSubmit] = useForm(FORMSPREE_FORM_ID)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-navy/90 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-blueprint bg-surface p-8 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
      >
        {state.succeeded ? (
          <div className="py-4 text-center">
            <h3 className="text-2xl font-semibold text-offwhite">You&apos;re on the list.</h3>
            <p className="mb-6 mt-3 text-sm leading-relaxed text-offwhite/70">
              We&apos;ll reach out within 1–2 business days to schedule your demo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-blueprint px-6 py-2 text-sm font-medium text-offwhite transition hover:border-cyan hover:text-cyan"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-lg leading-none text-offwhite/50 transition hover:text-offwhite"
              aria-label="Close"
            >
              ×
            </button>
            <p className="font-mono text-xs uppercase tracking-widest text-cyan">Request a Demo</p>
            <h3 id="demo-modal-title" className="mt-4 text-2xl font-semibold text-offwhite">
              See CodeComply in action.
            </h3>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-offwhite/70">
              Enter your email and we&apos;ll reach out to schedule a walkthrough tailored to your
              firm.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                name="email"
                required
                placeholder="you@firm.com"
                className="rounded-lg border border-blueprint bg-navy px-4 py-3 text-sm text-offwhite outline-none transition placeholder:text-offwhite/40 focus:border-cyan"
              />
              <ValidationError
                field="email"
                errors={state.errors}
                className="-mt-1 text-xs text-violation"
              />
              <button
                type="submit"
                disabled={state.submitting}
                className="w-full rounded-lg bg-cyan py-3 text-sm font-semibold text-white transition hover:bg-cyan/90 disabled:opacity-50"
              >
                {state.submitting ? 'Sending...' : 'Request Demo'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export function DemoModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openDemo = useCallback(() => setOpen(true), [])
  const closeDemo = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ openDemo }), [openDemo])

  return (
    <DemoModalContext.Provider value={value}>
      {children}
      {open ? <DemoModal onClose={closeDemo} /> : null}
    </DemoModalContext.Provider>
  )
}
