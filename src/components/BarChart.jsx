import { pesoShort } from '../lib/format.js'

/**
 * Dependency-free bar chart. Built from flex + percentage heights so it stays
 * responsive without measuring the DOM, and prints legibly in greyscale.
 * Height is a pair of CSS variables so the same chart can be short on a phone
 * and taller from `md` up without a second render.
 */
export default function BarChart({
  data = [],
  height = 160,
  heightMd = 188,
  tone = 'signal',
  highlightMax = true,
  formatValue = pesoShort,
  emptyLabel = 'No data yet',
}) {
  const frame = {
    '--chart-h': `${height}px`,
    '--chart-h-md': `${heightMd}px`,
  }

  if (!data.length) {
    return (
      <div
        className="flex h-[var(--chart-h)] items-center justify-center rounded-[11px] border border-dashed border-line text-[12px] text-muted md:h-[var(--chart-h-md)]"
        style={frame}
      >
        {emptyLabel}
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const tones = {
    signal: 'bg-signal',
    route: 'bg-route',
    info: 'bg-info',
  }
  const dim = {
    signal: 'bg-[#4a3c10]',
    route: 'bg-[#1f4a36]',
    info: 'bg-[#1f3c5c]',
  }

  return (
    <div
      className="relative h-[var(--chart-h)] md:h-[var(--chart-h-md)]"
      style={frame}
    >
      {/* gridlines */}
      <div className="absolute inset-x-0 top-0 bottom-[38px] flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rule-fade w-full" />
        ))}
      </div>

      <div className="relative flex h-full items-end gap-1">
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)
          const isMax = highlightMax && d.value === max && d.value > 0
          return (
            <div
              key={d.key ?? i}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${d.label}: ${formatValue(d.value)}`}
            >
              <span
                className={`num mb-1 truncate text-center text-[12px] leading-none transition-colors ${
                  isMax ? 'font-semibold text-signal' : 'text-faint group-hover:text-fg-dim'
                }`}
              >
                {d.value > 0 ? formatValue(d.value) : '—'}
              </span>
              <div
                className={`mx-auto w-full max-w-[64px] rounded-t-[5px] transition-all duration-300 ${
                  isMax ? tones[tone] : d.value > 0 ? dim[tone] : 'bg-ink-700'
                }`}
                style={{ height: `calc(${pct}% - 26px)` }}
              />
              <span className="mt-2 h-[26px] text-center text-[12px] leading-tight font-semibold tracking-[0.04em] text-muted uppercase">
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
