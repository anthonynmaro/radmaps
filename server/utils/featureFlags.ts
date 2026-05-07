import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import type { FeatureFlag, FeatureFlagContext, FeatureFlagEnvironment } from '~/types'
import { evaluateFeatureFlag, normalizeFlagRules } from '~/utils/featureFlags'
import type { KnownFlagKey } from '~/utils/knownFlags'
import { getStaffSession, type StaffSession } from './adminAuth'

const CACHE_TTL_MS = 30_000

type CacheEntry = {
  data: FeatureFlag[]
  expires: number
}

const flagCache = new Map<FeatureFlagEnvironment, CacheEntry>()

function normalizeEnvironment(value: unknown): FeatureFlagEnvironment {
  const env = String(value || '').trim().toLowerCase()
  if (env === 'prod') return 'production'
  if (env === 'dev' || env === 'test') return 'development'
  if (env === 'preview' || env === 'production' || env === 'development' || env === 'all') return env
  return 'development'
}

export function currentFeatureFlagEnvironment(): FeatureFlagEnvironment {
  const config = useRuntimeConfig()
  return normalizeEnvironment(
    config.featureFlagEnvironment
    || process.env.FEATURE_FLAG_ENV
    || process.env.VERCEL_ENV
    || process.env.NODE_ENV,
  )
}

export function invalidateFeatureFlagCache(environment?: FeatureFlagEnvironment) {
  if (environment) flagCache.delete(environment)
  else flagCache.clear()
}

function normalizeFlagRow(row: any): FeatureFlag {
  return {
    ...row,
    rules: normalizeFlagRules(row.rules),
  } as FeatureFlag
}

function collapseEnvironmentRows(rows: FeatureFlag[], environment: FeatureFlagEnvironment): FeatureFlag[] {
  const byKey = new Map<string, FeatureFlag>()
  for (const row of rows) {
    if (row.environment === 'all' && !byKey.has(row.key)) byKey.set(row.key, row)
  }
  for (const row of rows) {
    if (row.environment === environment) byKey.set(row.key, row)
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export async function getActiveFeatureFlags(event: H3Event, environment = currentFeatureFlagEnvironment()): Promise<FeatureFlag[]> {
  const cached = flagCache.get(environment)
  if (cached && Date.now() < cached.expires) return cached.data

  const supabase = await serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .in('environment', ['all', environment])
    .is('archived_at', null)
    .order('key')
    .order('environment')

  if (error) throw createError({ statusCode: 500, message: error.message })

  const flags = collapseEnvironmentRows((data || []).map(normalizeFlagRow), environment)
  flagCache.set(environment, { data: flags, expires: Date.now() + CACHE_TTL_MS })
  return flags
}

export async function buildFeatureFlagContext(event: H3Event, opts?: { staffSession?: StaffSession | null }): Promise<FeatureFlagContext> {
  const [user, staff] = await Promise.all([
    serverSupabaseUser(event).catch(() => null),
    opts && 'staffSession' in opts ? Promise.resolve(opts.staffSession) : getStaffSession(event).catch(() => null),
  ])

  return {
    userId: user?.id,
    email: user?.email?.toLowerCase(),
    adminRole: staff?.role ?? null,
    isStaff: Boolean(staff),
  }
}

export async function isFeatureEnabled(
  event: H3Event,
  flagKey: KnownFlagKey | string,
  opts?: { context?: FeatureFlagContext; staffSession?: StaffSession | null },
): Promise<boolean> {
  try {
    const environment = currentFeatureFlagEnvironment()
    const flags = await getActiveFeatureFlags(event, environment)
    const flag = flags.find(item => item.key === flagKey)
    if (!flag) return false
    const context = opts?.context ?? await buildFeatureFlagContext(event, { staffSession: opts?.staffSession })
    return evaluateFeatureFlag(flag, context)
  } catch {
    return false
  }
}

export async function getEnabledFeatureFlags(event: H3Event): Promise<Record<string, true>> {
  try {
    const flags = await getActiveFeatureFlags(event)
    const context = await buildFeatureFlagContext(event)
    return flags.reduce<Record<string, true>>((acc, flag) => {
      if (evaluateFeatureFlag(flag, context)) acc[flag.key] = true
      return acc
    }, {})
  } catch {
    return {}
  }
}
