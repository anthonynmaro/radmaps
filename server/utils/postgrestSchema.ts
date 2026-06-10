export const THEME_LOCATION_METADATA_COLUMNS = [
  'location_label',
  'location_city',
  'location_region',
  'location_country',
  'location_lng',
  'location_lat',
  'location_elevation_m',
  'location_metadata_source',
  'location_metadata_enriched_at',
] as const

export type ThemeLocationMetadataColumn = typeof THEME_LOCATION_METADATA_COLUMNS[number]

export function isMissingPostgrestSchemaColumnError(error: unknown, columns: readonly string[] = THEME_LOCATION_METADATA_COLUMNS) {
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : ''
  const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : ''
  const details = typeof (error as { details?: unknown })?.details === 'string' ? (error as { details: string }).details : ''
  const combined = `${message}\n${details}`

  if (code && code !== 'PGRST204') return false
  if (!combined.includes('schema cache')) return false
  return columns.some(column => combined.includes(`'${column}'`) || combined.includes(`"${column}"`) || combined.includes(column))
}

export function omitColumns<T extends Record<string, unknown>>(record: T, columns: readonly string[]) {
  const omitted = new Set(columns)
  return Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key))) as Partial<T>
}
