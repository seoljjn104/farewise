import Icon from './Icon.jsx'
import { Badge, Row } from './ui.jsx'
import { peso, km as kmFmt, duration } from '../lib/format.js'
import { timeline } from '../lib/plan.js'

/**
 * The fare ticket. It is the only place on this screen that says what the trip
 * costs, so everything else (route card, class selector, breakdown sheet) reads
 * from the same priced trip object.
 */
export default function FareTicket({
  trip,
  route,
  role,
  mode,
  stops,
  loading,
  cheapest,
  onSwitchMode,
}) {
  if (loading && !trip) return <TicketSkeleton />

  if (!trip) {
    return (
      <div className="panel px-4 py-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-ink-800 text-muted">
          <Icon name="route" size={18} />
        </span>
        <p className="mt-3 text-[13px] font-semibold text-fg">Pick two places</p>
        <p className="mx-auto mt-1 max-w-[34ch] text-[11.5px] leading-relaxed text-muted">
          The fare appears here as soon as the route resolves.
        </p>
      </div>
    )
  }

  const steps = timeline(stops, route.legs.map((leg) => leg.km))
  const estimate = route.source === 'estimate'
  const discounted = trip.discountPct > 0

  return (
    <div>
      <section className="panel overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <p className="label-xs truncate">{discounted ? `${role.label} fare` : 'Total fare'}</p>
            <p
              aria-live="polite"
              className="num mt-1.5 text-[38px] leading-none font-bold tracking-[-0.02em] text-signal"
            >
              {peso(trip.net)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {mode?.code && <Badge>{mode.code}</Badge>}
            {estimate && (
              <Badge tone="info" icon="info">
                Estimate
              </Badge>
            )}
          </div>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 text-[11.5px] text-muted">
          <span className="num font-semibold text-fg-dim">{kmFmt(trip.totalKm)}</span>
          <span aria-hidden="true">·</span>
          <span className="num">{duration(route.min)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {trip.legs.length} {trip.legs.length === 1 ? 'leg' : 'legs'}
          </span>
          {estimate && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-info">offline road estimate</span>
            </>
          )}
        </p>

        <div className="mx-4 mt-3.5 border-t border-dashed border-line" />

        <ol className="px-4 pt-3">
          {steps.map((step, i) => (
            <li key={`${step.name}-${i}`} className="flex gap-3">
              <div className="flex w-3 shrink-0 flex-col items-center">
                <span
                  className={`mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                    step.kind === 'origin'
                      ? 'border-signal bg-signal'
                      : step.kind === 'destination'
                        ? 'border-route bg-route'
                        : 'border-line bg-ink-850'
                  }`}
                />
                {i < steps.length - 1 && <span className="w-px flex-1 bg-line" />}
              </div>
              <div
                className={`flex min-w-0 flex-1 items-baseline justify-between gap-3 ${
                  i < steps.length - 1 ? 'pb-2.5' : 'pb-0'
                }`}
              >
                <span
                  className="truncate text-[12.5px] font-medium text-fg"
                  title={step.name}
                >
                  {step.name}
                </span>
                <span className="num shrink-0 text-[10.5px] text-faint">
                  {i === 0 ? 'Start' : kmFmt(step.km)}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-3.5 border-t border-line px-4 py-3">
          <Row
            label={`Base fare — first ${trip.baseKm} km`}
            value={peso(trip.baseFare)}
          />
          <Row
            label="Excess distance"
            sub={`${trip.billableKm.toFixed(2)} km × ${peso(trip.perKm)}/km`}
            value={peso(trip.excessCharge)}
          />
          <Row label="Gross fare" value={peso(trip.gross)} strong />
          {discounted && (
            <Row
              label={`${role.label} discount`}
              sub={`${trip.discountPct}% statutory`}
              value={`−${peso(trip.discountAmount)}`}
              tone="route"
            />
          )}
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-line bg-ink-800 px-4 py-3">
          <span className="text-[12px] font-semibold text-fg-dim">Amount payable</span>
          <span className="num text-[18px] leading-none font-bold text-fg">{peso(trip.net)}</span>
        </div>
      </section>

      {cheapest && cheapest.row.id !== mode?.id && (
        <button
          type="button"
          onClick={() => onSwitchMode?.(cheapest.row.id)}
          className="mt-2 flex w-full items-center gap-2.5 rounded-[11px] border border-line bg-ink-850 px-3 py-2.5 text-left transition-colors hover:bg-ink-800"
        >
          <Icon name="zap" size={14} className="shrink-0 text-route" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg-dim">
            Cheapest: <span className="font-semibold text-fg">{cheapest.row.mode}</span>
          </span>
          <span className="num shrink-0 text-[12px] font-semibold text-route">
            {peso(cheapest.net)}
          </span>
          <Icon name="chevronRight" size={13} className="shrink-0 text-faint" />
        </button>
      )}
    </div>
  )
}

function TicketSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-busy="true">
      <div className="px-4 pt-4">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-ink-700" />
        <div className="mt-3 h-9 w-36 animate-pulse rounded-lg bg-ink-700" />
        <div className="mt-3 h-3 w-48 animate-pulse rounded-full bg-ink-800" />
      </div>
      <div className="mx-4 mt-4 border-t border-dashed border-line" />
      <div className="space-y-3 px-4 py-4">
        <div className="h-3 w-full animate-pulse rounded-full bg-ink-800" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-ink-800" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-ink-800" />
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-ink-800" />
      </div>
      <span className="sr-only">Measuring your route.</span>
    </div>
  )
}
