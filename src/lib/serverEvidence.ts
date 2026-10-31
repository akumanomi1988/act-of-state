/** Validate server-owned UTC calendar boundaries without forgiving JS date rollover. */
export function isUtcDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

/** PostgreSQL timestamptz JSON is timezone-qualified; reject local-time ambiguity. */
export function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !isUtcDay(value.slice(0, 10))) return false
  return Number.isFinite(Date.parse(value))
}

export const isNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const isCount = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= limit

export const isScore = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

export const daySpan = (from: string, to: string): number =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1
