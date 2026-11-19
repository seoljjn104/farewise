import { useEffect, useRef, useState } from 'react'

/**
 * A table cell that only writes to the store when the operator is done.
 * Draft text lives here, so half-typed numbers never reach the fare engine.
 */
export default function RateField({
  value,
  onCommit,
  label,
  step = '0.01',
  width = 'w-[84px]',
  suffix,
}) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const [error, setError] = useState('')
  const focused = useRef(false)
  const id = useRef(`rate-${Math.random().toString(36).slice(2, 9)}`)

  /* Adopt external changes, but never while the operator is typing. */
  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? ''))
  }, [value])

  function commit() {
    const text = draft.trim()
    if (text === '') {
      setError('Enter a number')
      return false
    }
    const next = Number(text)
    if (!Number.isFinite(next)) {
      setError('Enter a number')
      return false
    }
    if (next < 0) {
      setError('Cannot be negative')
      return false
    }
    setError('')
    if (next !== Number(value)) {
      onCommit(next)
    } else {
      setDraft(String(value ?? ''))
    }
    return true
  }

  return (
    <span className="inline-block">
      <span className="relative block">
        <input
          id={id.current}
          type="text"
          inputMode="decimal"
          step={step}
          value={draft}
          aria-label={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id.current}-error` : undefined}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError('')
          }}
          onBlur={() => {
            focused.current = false
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (commit()) e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(String(value ?? ''))
              setError('')
              e.currentTarget.blur()
            }
          }}
          className={`num h-8 ${width} rounded-md border bg-ink-800 px-2 text-right text-[12px] text-fg ${
            error ? 'border-danger' : 'border-line'
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-[9px] text-faint">
            {suffix}
          </span>
        )}
      </span>
      {error && (
        <span
          id={`${id.current}-error`}
          role="alert"
          className="mt-1 block text-[9.5px] leading-none text-danger"
        >
          {error}
        </span>
      )}
    </span>
  )
}
