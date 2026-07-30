export function toLocalDateStamp(value?: string | Date | null) {
  if (!value) {
    const now = new Date()
    return formatLocalDateParts(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return toLocalDateStamp()

  return formatLocalDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function formatLocalDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
