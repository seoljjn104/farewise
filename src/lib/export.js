/**
 * Export helpers. CSV is the format a student actually opens in a spreadsheet,
 * so it has to survive commas, quotes, newlines, and formula injection.
 */

const HEADER = 'date,from,to,mode,role,distance_km,gross,discount,fare'

const money = (value) => (Number(value) || 0).toFixed(2)

/**
 * RFC 4180 quoting plus a leading apostrophe for anything a spreadsheet would
 * treat as a formula. The apostrophe is the standard defence and stays visible
 * in the cell, which is honest about what the text was.
 */
export function csvEscape(value) {
  const text = value === undefined || value === null ? '' : String(value)
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /["\n\r,]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded
}

/** Header plus one row per trip, oldest data first as stored. */
export function toCsv(trips = []) {
  const rows = (Array.isArray(trips) ? trips : []).map((trip) =>
    [
      csvEscape(trip.createdAt),
      csvEscape(trip.fromName),
      csvEscape(trip.toName),
      csvEscape(trip.modeName),
      csvEscape(trip.roleLabel),
      money(trip.distanceKm),
      money(trip.gross),
      money(trip.discount),
      money(trip.fare),
    ].join(',')
  )
  return [HEADER, ...rows].join('\n')
}

/** Full backup, readable, with the export time recorded. */
export function toJson(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}
