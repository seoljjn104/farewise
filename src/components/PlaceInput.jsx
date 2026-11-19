import { useEffect, useId, useMemo, useRef, useState } from 'react'
import places from '../data/places.json'
import Icon from './Icon.jsx'

const KIND_ICON = {
  terminal: 'bus',
  airport: 'flag',
  mall: 'pin',
  school: 'users',
  gov: 'shield',
  market: 'pin',
  landmark: 'pin',
  street: 'route',
  barangay: 'pin',
  business: 'pin',
}

function score(place, q) {
  const n = place.name.toLowerCase()
  const c = place.city.toLowerCase()
  if (n.startsWith(q)) return 0
  if (n.includes(q)) return 1
  if (c.startsWith(q)) return 2
  if (c.includes(q)) return 3
  return -1
}

function search(q) {
  const s = q.trim().toLowerCase()
  if (!s) return places.slice(0, 8)
  return places
    .map((p) => ({ p, s: score(p, s) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name))
    .slice(0, 8)
    .map((x) => x.p)
}

/**
 * Autocomplete bound to the curated Metro Cebu gazetteer. Every coordinate in
 * that file was resolved against OpenStreetMap, so no point is hand-guessed.
 */
export default function PlaceInput({
  value,
  onSelect,
  placeholder = 'Search a place',
  label = 'Search a place',
  autoFocus,
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (i) => `${uid}-option-${i}`

  useEffect(() => {
    setQ('')
  }, [value?.id])

  const results = useMemo(() => search(q), [q])
  const showList = open && !value

  useEffect(() => {
    function onDoc(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [])

  useEffect(() => setHi(0), [q])

  function pick(place) {
    onSelect(place)
    setQ('')
    setOpen(false)
  }

  function onKey(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHi((h) => Math.min(h + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHi((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (showList && results[hi]) {
        event.preventDefault()
        pick(results[hi])
      }
    } else if (event.key === 'Escape') {
      if (showList) {
        event.stopPropagation()
        setOpen(false)
      }
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative min-w-0">
      {value ? (
        <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-line bg-ink-800 px-3">
          <Icon name={KIND_ICON[value.kind] || 'pin'} size={15} className="shrink-0 text-signal" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg" title={value.name}>
            {value.name}
          </span>
          <span className="num hidden shrink-0 text-[10px] text-faint sm:block">{value.city}</span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-md p-1 text-muted hover:bg-ink-700 hover:text-danger"
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            <Icon name="x" size={14} stroke={2} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            autoFocus={autoFocus}
            role="combobox"
            aria-label={label}
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showList && results[hi] ? optionId(hi) : undefined}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="h-11 w-full rounded-[10px] border border-line bg-ink-800 pr-3 pl-9 text-[13px] text-fg placeholder:text-faint hover:bg-ink-750"
          />
        </div>
      )}

      {showList && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1.5 max-h-[266px] w-full overflow-y-auto rounded-[11px] border border-line bg-ink-800 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,.65)]"
        >
          {results.length === 0 && (
            <p className="px-2.5 py-3 text-[12px] text-muted">
              No match in the Metro Cebu gazetteer.
            </p>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              id={optionId(i)}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(p)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                i === hi ? 'bg-ink-700' : 'hover:bg-ink-750'
              }`}
            >
              <Icon
                name={KIND_ICON[p.kind] || 'pin'}
                size={14}
                className={i === hi ? 'text-signal' : 'text-muted'}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-fg" title={p.name}>
                  {p.name}
                </span>
                <span className="block truncate text-[10.5px] text-muted">{p.city}</span>
              </span>
              <span className="num shrink-0 text-[9.5px] text-faint">
                {p.lat.toFixed(3)}, {p.lng.toFixed(3)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
