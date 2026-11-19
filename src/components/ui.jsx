import Icon from './Icon.jsx'

/* ------------------------------------------------------------------ Btn -- */
export function Btn({
  variant = 'ghost',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap'
  const sizes = {
    sm: 'h-8 px-3 text-[12px]',
    md: 'h-10 px-3.5 text-[13px]',
    lg: 'h-12 px-5 text-[14px]',
  }
  const variants = {
    primary: 'bg-signal text-signal-ink hover:bg-[#ffd05c]',
    ghost: 'bg-ink-800 text-fg-dim border border-line hover:text-fg hover:bg-ink-700',
    quiet: 'bg-transparent text-muted hover:text-fg hover:bg-ink-800',
    danger: 'bg-danger-dim text-danger border border-[#5a2a2a] hover:bg-[#4a2222]',
    route: 'bg-route text-[#062015] hover:bg-[#5ce8ac]',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- Field -- */
export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="label-xs">{label}</span>
          {hint && <span className="num text-[10px] text-faint">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- Badge --- */
export function Badge({ tone = 'neutral', children, icon, className = '' }) {
  const tones = {
    neutral: 'bg-ink-800 text-muted border-line',
    signal: 'bg-[#2a2109] text-signal border-[#4a3c10]',
    route: 'bg-route-dim text-route border-[#1f4a36]',
    danger: 'bg-danger-dim text-danger border-[#5a2a2a]',
    info: 'bg-info-dim text-info border-[#1f3c5c]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.09em] ${tones[tone]} ${className}`}
    >
      {icon && <Icon name={icon} size={12} stroke={2} />}
      {children}
    </span>
  )
}

/* ----------------------------------------------------------------- Stat --- */
export function Stat({ label, value, sub, icon, tone = 'neutral', className = '' }) {
  const accents = {
    neutral: 'text-fg',
    signal: 'text-signal',
    route: 'text-route',
    danger: 'text-danger',
    info: 'text-info',
  }
  return (
    <div className={`panel p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="label-xs">{label}</span>
        {icon && <Icon name={icon} size={15} className="shrink-0 text-faint" />}
      </div>
      <p className={`num mt-2.5 text-[26px] leading-none font-semibold ${accents[tone]}`}>{value}</p>
      {sub && <p className="mt-2 text-[11.5px] leading-snug text-muted">{sub}</p>}
    </div>
  )
}

/* ------------------------------------------------------------ Segmented --- */
export function Segmented({ options, value, onChange, columns = 2, className = '' }) {
  return (
    <div
      className={`grid gap-1.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-[38px] flex-col justify-center rounded-[9px] border px-2.5 py-2 text-left transition-colors ${
              on
                ? 'border-signal bg-signal text-signal-ink'
                : 'border-line bg-ink-800 text-fg-dim hover:border-line hover:bg-ink-700 hover:text-fg'
            }`}
          >
            <span className="text-[12.5px] leading-tight font-semibold">{o.label}</span>
            {o.sub && (
              <span className={`num text-[10px] leading-tight ${on ? 'text-[#5a4708]' : 'text-faint'}`}>
                {o.sub}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ Row --- */
export function Row({ label, value, sub, tone = 'default', strong = false }) {
  const tones = {
    default: 'text-fg-dim',
    muted: 'text-muted',
    danger: 'text-danger',
    route: 'text-route',
    signal: 'text-signal',
  }
  return (
    <div className="flex items-baseline justify-between gap-4 py-[7px]">
      <span className={`text-[12.5px] ${strong ? 'font-semibold text-fg' : tones[tone]}`}>
        {label}
        {sub && <> <span className="num ml-2 text-[10.5px] text-faint">{sub}</span></>}
      </span>
      <span
        className={`num shrink-0 text-[13px] ${strong ? 'font-semibold text-fg' : tones[tone]}`}
      >
        {value}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- Toggle --- */
export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[12.5px] font-semibold text-fg">{label}</span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
      <span
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors ${
          checked ? 'border-signal bg-signal' : 'border-line bg-ink-700'
        }`}
      >
        <span
          className={`absolute top-[1.5px] h-[16px] w-[16px] rounded-full transition-all ${
            checked ? 'left-[18px] bg-signal-ink' : 'left-[2px] bg-muted'
          }`}
        />
      </span>
    </button>
  )
}

/* ----------------------------------------------------------- EmptyState --- */
export function EmptyState({ icon = 'info', title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-ink-800 text-muted">
        <Icon name={icon} size={19} />
      </span>
      <p className="text-[13.5px] font-semibold text-fg">{title}</p>
      {body && <p className="mt-1.5 max-w-[38ch] text-[12px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- Select --- */
export function Select({ value, onChange, options, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-[10px] border border-line bg-ink-800 pr-9 pl-3 text-[13px] text-fg hover:bg-ink-700"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-800">
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={15}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  )
}
