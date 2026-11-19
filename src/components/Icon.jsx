/**
 * Inline icon set — no icon dependency, no font, no sprite file.
 * 24×24 grid, currentColor stroke, consistent 1.7 weight.
 */
const P = {
  route: (
    <>
      <circle cx="6" cy="19" r="2.8" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="2.8" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 2.5h12a.5.5 0 0 1 .5.5v18.5l-3-2-2 2-2-2-2 2-3-2V3a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <rect x="3" y="7.5" width="18" height="11.5" rx="2.5" />
      <path d="M15.5 13.25h3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 7.5 2.5 7.5h-17S6 15 6 8.5" />
      <path d="M10.2 20a2 2 0 0 0 3.6 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 21.5s7.5-3.6 7.5-9.4V5.4L12 2.5 4.5 5.4v6.7c0 5.8 7.5 9.4 7.5 9.4Z" />
      <path d="m9 11.8 2.2 2.2L15.4 9.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  swap: (
    <>
      <path d="M7 3.5v17M7 3.5 3.5 7M7 3.5 10.5 7" />
      <path d="M17 20.5v-17M17 20.5 13.5 17M17 20.5 20.5 17" />
    </>
  ),
  arrowRight: <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </>
  ),
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUp: <path d="m18 14.5-6-6-6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="m12 3 9.5 17H2.5Z" />
      <path d="M12 9.5v4.5M12 17.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8v5.6l3.4 2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10.2c0 6-8 11.3-8 11.3S4 16.2 4 10.2a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10.2" r="2.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.6 20a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4l1.1-13.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L20 8a2.83 2.83 0 0 0-4-4L4 16v4Z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5v5.5H15" />
    </>
  ),
  sliders: (
    <>
      <path d="M3.5 7.5h9M17.5 7.5h3M3.5 16.5h3M11.5 16.5h9" />
      <circle cx="15" cy="7.5" r="2.4" />
      <circle cx="9" cy="16.5" r="2.4" />
    </>
  ),
  bus: (
    <>
      <rect x="3.5" y="3.5" width="17" height="13" rx="2.6" />
      <path d="M3.5 10.5h17" />
      <path d="M7.5 16.5v2.5M16.5 16.5v2.5" />
      <circle cx="7.8" cy="13.4" r=".9" />
      <circle cx="16.2" cy="13.4" r=".9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6" />
      <path d="M17.6 14.4A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2.5 9 4.8-9 4.8-9-4.8Z" />
      <path d="m3 12.4 9 4.8 9-4.8" />
      <path d="m3 17.2 9 4.8 9-4.8" />
    </>
  ),
  zap: <path d="M13.5 2.5 5 13.5h6.2l-1 8L19 10.5h-6.2Z" />,
  gauge: (
    <>
      <path d="M3.5 18a9 9 0 1 1 17 0" />
      <path d="M12 14.2 16.4 9" />
      <circle cx="12" cy="14.5" r="1.5" />
    </>
  ),
  flag: (
    <>
      <path d="M4.5 21V3.5" />
      <path d="M4.5 4.5h11l-1.9 3.6 1.9 3.6h-11" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
}

export default function Icon({ name, size = 18, stroke = 1.7, className = '', ...rest }) {
  const d = P[name]
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {d}
    </svg>
  )
}

export const iconNames = Object.keys(P)
