import { z } from 'zod'
import type {
  AdminRole,
  FeatureFlag,
  FeatureFlagContext,
  FeatureFlagEnvironment,
  FeatureFlagRule,
  FeatureFlagRuleType,
} from '~/types'
import { ADMIN_ROLES } from '~/utils/adminPermissions'

export const FEATURE_FLAG_ENVIRONMENTS: FeatureFlagEnvironment[] = ['development', 'preview', 'production', 'all']
export const FEATURE_FLAG_RULE_TYPES: FeatureFlagRuleType[] = ['user_list', 'admin_role', 'all_staff', 'percentage', 'everyone']

export const FeatureFlagKeySchema = z.string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase snake_case flag keys')

export const FeatureFlagEnvironmentSchema = z.enum(['development', 'preview', 'production', 'all'])

const uuidSchema = z.string().uuid()
const adminRoleSchema = z.string().refine((value): value is AdminRole => ADMIN_ROLES.includes(value as AdminRole), 'Invalid admin role')

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export const FeatureFlagRuleSchema = z.object({
  type: z.enum(['user_list', 'admin_role', 'all_staff', 'percentage', 'everyone']),
  enabled: z.boolean(),
  roles: z.array(adminRoleSchema).max(ADMIN_ROLES.length).optional(),
  user_ids: z.array(uuidSchema).max(100).optional(),
  emails: z.array(z.string().trim().email().transform(normalizeEmail)).max(100).optional(),
  percentage: z.number().min(0).max(100).optional(),
}).superRefine((rule, ctx) => {
  if (rule.type === 'admin_role' && (!rule.roles || rule.roles.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['roles'], message: 'Choose at least one role' })
  }
  if (rule.type === 'user_list' && (!rule.user_ids?.length && !rule.emails?.length)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['emails'], message: 'Add at least one user ID or email' })
  }
  if (rule.type === 'percentage' && typeof rule.percentage !== 'number') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['percentage'], message: 'Percentage is required' })
  }
})

export const FeatureFlagRulesSchema = z.array(FeatureFlagRuleSchema).max(10)

export const FeatureFlagWriteSchema = z.object({
  key: FeatureFlagKeySchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  environment: FeatureFlagEnvironmentSchema.default('all'),
  enabled: z.boolean().default(false),
  rules: FeatureFlagRulesSchema.default([]),
})

export const FeatureFlagUpdateSchema = z.object({
  key: FeatureFlagKeySchema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  environment: FeatureFlagEnvironmentSchema.optional(),
  enabled: z.boolean().optional(),
  rules: FeatureFlagRulesSchema.optional(),
  archived: z.boolean().optional(),
})

export function normalizeFlagRules(rules: unknown): FeatureFlagRule[] {
  const parsed = FeatureFlagRulesSchema.safeParse(Array.isArray(rules) ? rules : [])
  if (!parsed.success) return []
  return parsed.data.map(rule => ({
    ...rule,
    emails: rule.emails?.map(normalizeEmail),
  }))
}

function stableBucket(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100
}

export function isInPercentageRollout(userId: string | undefined, flagKey: string, percentage: number): boolean {
  if (!userId || percentage <= 0) return false
  if (percentage >= 100) return true
  return stableBucket(`${flagKey}:${userId}`) < percentage
}

function matchesRule(rule: FeatureFlagRule, flagKey: string, context: FeatureFlagContext): boolean {
  const email = context.email?.trim().toLowerCase()

  if (rule.type === 'user_list') {
    return Boolean(
      (context.userId && rule.user_ids?.includes(context.userId))
      || (email && rule.emails?.includes(email)),
    )
  }

  if (rule.type === 'admin_role') {
    return Boolean(context.isStaff && context.adminRole && rule.roles?.includes(context.adminRole))
  }

  if (rule.type === 'all_staff') {
    return Boolean(context.isStaff)
  }

  if (rule.type === 'percentage') {
    return isInPercentageRollout(context.userId, flagKey, rule.percentage ?? 0)
  }

  return rule.type === 'everyone'
}

export function evaluateFeatureFlag(flag: Pick<FeatureFlag, 'key' | 'enabled' | 'rules' | 'archived_at'>, context: FeatureFlagContext): boolean {
  if (!flag.enabled || flag.archived_at) return false

  const rules = normalizeFlagRules(flag.rules)
  for (const type of FEATURE_FLAG_RULE_TYPES) {
    const matchingRules = rules.filter(rule => rule.type === type && matchesRule(rule, flag.key, context))
    if (!matchingRules.length) continue
    if (matchingRules.some(rule => !rule.enabled)) return false
    if (matchingRules.some(rule => rule.enabled)) return true
  }

  return false
}
