export type CheckoutAddress = {
  name: string
  email: string
  address1: string
  address2?: string
  city: string
  state_code: string
  country_code: string
  zip: string
  phone?: string
}

export const CHECKOUT_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'IE', label: 'Ireland' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'JP', label: 'Japan' },
] as const

export const CHECKOUT_COUNTRY_CODES = new Set(CHECKOUT_COUNTRIES.map(country => country.code))

export type CheckoutAddressField = keyof CheckoutAddress

const REQUIRED_ADDRESS_FIELDS: CheckoutAddressField[] = [
  'name',
  'email',
  'address1',
  'city',
  'state_code',
  'country_code',
  'zip',
]

function normalizeCountryCode(value: unknown): string {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  const byLabel = CHECKOUT_COUNTRIES.find(country => country.label.toUpperCase() === raw)
  if (byLabel) return byLabel.code
  const primary = raw.split('-')[0]?.toUpperCase() || raw
  return CHECKOUT_COUNTRY_CODES.has(primary as typeof CHECKOUT_COUNTRIES[number]['code'])
    ? primary
    : raw.slice(0, 2)
}

export function normalizeCheckoutAddress(address: Partial<CheckoutAddress>): CheckoutAddress {
  return {
    name: String(address.name || '').trim(),
    email: String(address.email || '').trim().toLowerCase(),
    address1: String(address.address1 || '').trim(),
    address2: String(address.address2 || '').trim(),
    city: String(address.city || '').trim(),
    state_code: String(address.state_code || '').trim().toUpperCase(),
    country_code: normalizeCountryCode(address.country_code || 'US'),
    zip: String(address.zip || '').trim(),
    phone: String(address.phone || '').trim(),
  }
}

export function missingCheckoutAddressFields(address: Partial<CheckoutAddress>): CheckoutAddressField[] {
  const normalized = normalizeCheckoutAddress(address)
  return REQUIRED_ADDRESS_FIELDS.filter((field) => {
    if (field === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
    return !normalized[field]
  })
}

export function checkoutAddressFingerprint(
  address: Partial<CheckoutAddress>,
  productUid: string,
  quantity: number,
): string {
  const normalized = normalizeCheckoutAddress(address)
  return JSON.stringify({
    product_uid: productUid,
    quantity,
    name: normalized.name.toLowerCase(),
    email: normalized.email,
    address1: normalized.address1.toLowerCase(),
    address2: (normalized.address2 || '').toLowerCase(),
    city: normalized.city.toLowerCase(),
    state_code: normalized.state_code.toLowerCase(),
    country_code: normalized.country_code.toLowerCase(),
    zip: normalized.zip.toLowerCase(),
    phone: normalized.phone?.replace(/\D/g, '') || '',
  })
}

function objectValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function contextValue(context: unknown, prefixes: string[]): string {
  if (!Array.isArray(context)) return ''
  for (const prefix of prefixes) {
    const item = context.find((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const id = String((entry as Record<string, unknown>).id || '').toLowerCase()
      return id.startsWith(`${prefix}.`)
    })
    const text = item && typeof item === 'object' ? (item as Record<string, unknown>).text : ''
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return ''
}

export function mapMapboxAutofillToAddressPatch(result: unknown): Partial<CheckoutAddress> {
  const raw = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const properties = raw.properties && typeof raw.properties === 'object'
    ? raw.properties as Record<string, unknown>
    : raw
  const metadata = properties.metadata && typeof properties.metadata === 'object'
    ? properties.metadata as Record<string, unknown>
    : {}
  const countryCode = objectValue(properties, ['country_code'])
    || objectValue(metadata, ['iso_3166_1'])
    || contextValue(properties.context, ['country'])

  return {
    address1: objectValue(properties, ['address_line1', 'feature_name', 'matching_name', 'address']),
    address2: objectValue(properties, ['address_line2', 'address_line3']),
    city: objectValue(properties, ['address_level2'])
      || contextValue(properties.context, ['place', 'locality', 'district']),
    state_code: objectValue(properties, ['address_level1'])
      || contextValue(properties.context, ['region']),
    country_code: normalizeCountryCode(countryCode),
    zip: objectValue(properties, ['postcode'])
      || contextValue(properties.context, ['postcode']),
  }
}
