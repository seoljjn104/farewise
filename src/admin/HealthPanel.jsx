import { useStore } from '../lib/store.js'
import { aggregateCounts } from '../lib/store.js'
import { clockTime } from '../lib/format.js'

export default function HealthPanel() {
  const { state } = useStore()
  const counts = aggregateCounts(state)
  const storageError = state.storageError

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
        <p className="label-xs">Health</p>
        <span className="num text-[12px] text-fg-dim">local-only</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10.5px] leading-relaxed text-faint">Commuters</p>
          <p className="text-[13px] font-semibold text-fg">{counts.commuters}</p>
        </div>
        <div>
          <p className="text-[10.5px] leading-relaxed text-faint">Admins</p>
          <p className="text-[13px] font-semibold text-fg">{counts.admins}</p>
        </div>
        <div>
          <p className="text-[10.5px] leading-relaxed text-faint">Trips</p>
          <p className="text-[13px] font-semibold text-fg">{counts.trips}</p>
        </div>
        <div>
          <p className="text-[10.5px] leading-relaxed text-faint">Advisories</p>
          <p className="text-[13px] font-semibold text-fg">{counts.advisories}</p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-[10.5px] leading-relaxed text-faint">Pending</p>
        <p className="text-[13px] font-semibold text-fg route">{counts.pending}</p>

        <p className="text-[10.5px] leading-relaxed text-faint">Rate matrix</p>
        <p className="text-[13px] font-semibold text-fg route">
          {counts.oldestRate ? clockTime(counts.oldestRate) : '—'} ·{' '}
          {counts.newestRate ? clockTime(counts.newestRate) : '—'}
        </p>
      </div>

      {storageError && (
        <p className="mt-4 rounded-[10px] border border-danger px-3 py-3 text-[11px] text-danger">
          {storageError}
        </p>
      )}
    </section>
  )
}