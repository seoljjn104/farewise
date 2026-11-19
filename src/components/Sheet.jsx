import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

/**
 * Bottom sheet on a phone, centred dialog from `md` up. Keeps the existing
 * dark visual language and needs no focus-trap dependency.
 */
export default function Sheet({ open, onClose, title, children, footer }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current?.()
    }
    document.addEventListener('keydown', onKey)

    const focusTarget = panelRef.current?.querySelector(
      '[data-autofocus], input, select, textarea, button, a[href]'
    )
    focusTarget?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={() => closeRef.current?.()}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fw-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[18px] border border-line bg-ink-850 shadow-[0_-18px_54px_rgba(0,0,0,.6)] md:max-w-[560px] md:rounded-[14px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate text-[15px] leading-tight font-bold text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => closeRef.current?.()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-ink-800 hover:text-fg pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-ink-850 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
