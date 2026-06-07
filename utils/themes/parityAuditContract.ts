import type { ColorTheme } from '~/types'
import { THEME_CHROME_CONTRACTS, getThemeChromeContract } from './chromeContract'
import {
  THEME_SCREENSHOT_MANIFEST,
  getThemeScreenshotManifestEntry,
  type ThemeParityTrack,
} from './screenshotManifest'
import { getThemeSemanticAuditContract } from './semanticAuditContract'
import { getThemeSpecContract } from './specContract'

export const THEME_PARITY_SEMANTIC_GROUPS = [
  'typography',
  'layout',
  'palette',
  'mapLayers',
  'routeStyling',
  'motifs',
  'routeLayers',
  'print',
] as const

export type ThemeParitySemanticGroup = typeof THEME_PARITY_SEMANTIC_GROUPS[number]

export const THEME_SEMANTIC_PARITY_THRESHOLD = 0.94

export interface ThemeParityAuditContract {
  themeId: ColorTheme
  track: ThemeParityTrack
  requiredSemanticGroups: ThemeParitySemanticGroup[]
  requiresVisualReview: true
  requiresRendererReadiness: true
  requiresEditableAllowlist: true
  requiresDynamicRouteGeometry: true
  pixelScoreIsGate: false
}

export interface ThemeParityApprovalState {
  themeId: ColorTheme
  semanticContractExists: boolean
  chromeContractExists: boolean
  specContractExists: boolean
  semanticRuntimePassed: boolean
  semanticGroupsPassed: boolean
  semanticScore: number
  visualReviewApproved: boolean
  notImplementedCleared: boolean
  canMarkDone: boolean
}

export interface ThemeSemanticSummaryLike {
  passed?: number
  total?: number
  pass?: boolean
  summary?: {
    passed?: number
    total?: number
    pass?: boolean
  }
  groups?: Partial<Record<ThemeParitySemanticGroup, ThemeSemanticGroupLike>>
}

export type ThemeSemanticCheckLike = {
  pass?: boolean
}

export type ThemeSemanticGroupLike =
  | readonly ThemeSemanticCheckLike[]
  | {
    passed?: number
    total?: number
    pass?: boolean
  }

export function scoreThemeSemanticParity(summary: ThemeSemanticSummaryLike | undefined): number {
  const scalar = semanticRuntimeScalar(summary)
  if (!scalar?.total) return 0
  return Number(Math.max(0, Math.min(1, scalar.passed / scalar.total)).toFixed(4))
}

export function meetsThemeSemanticParityThreshold(
  summary: ThemeSemanticSummaryLike | undefined,
  threshold = THEME_SEMANTIC_PARITY_THRESHOLD,
): boolean {
  return scoreThemeSemanticParity(summary) >= threshold
}

export function passesThemeSemanticRuntimeGate(summary: ThemeSemanticSummaryLike | undefined): boolean {
  const scalar = semanticRuntimeScalar(summary)
  return scalar?.pass === true
    && meetsThemeSemanticParityThreshold(summary)
    && hasRequiredSemanticRuntimeGroups(summary)
}

export function hasRequiredSemanticRuntimeGroups(
  summary: ThemeSemanticSummaryLike | undefined,
  groups: readonly ThemeParitySemanticGroup[] = THEME_PARITY_SEMANTIC_GROUPS,
): boolean {
  if (!summary?.groups) return false
  return groups.every(group => semanticGroupPassed(summary.groups?.[group]))
}

function semanticGroupPassed(group: ThemeSemanticGroupLike | undefined): boolean {
  if (!group) return false
  if (Array.isArray(group)) return group.length > 0 && group.every(check => check.pass === true)
  const aggregate = group as Exclude<ThemeSemanticGroupLike, readonly ThemeSemanticCheckLike[]>
  if (typeof aggregate.pass === 'boolean') return aggregate.pass === true
  if (typeof aggregate.passed === 'number' && typeof aggregate.total === 'number') {
    return aggregate.total > 0 && aggregate.passed === aggregate.total
  }
  return false
}

function semanticRuntimeScalar(summary: ThemeSemanticSummaryLike | undefined): { passed: number; total: number; pass?: boolean } | undefined {
  const passed = typeof summary?.passed === 'number' ? summary.passed : summary?.summary?.passed
  const total = typeof summary?.total === 'number' ? summary.total : summary?.summary?.total
  const pass = typeof summary?.pass === 'boolean' ? summary.pass : summary?.summary?.pass
  if (typeof passed !== 'number' || typeof total !== 'number') return undefined
  return { passed, total, pass }
}

export const THEME_PARITY_AUDIT_CONTRACTS: ThemeParityAuditContract[] = THEME_SCREENSHOT_MANIFEST.map(entry => ({
  themeId: entry.themeId,
  track: entry.track,
  requiredSemanticGroups: [...THEME_PARITY_SEMANTIC_GROUPS],
  requiresVisualReview: true,
  requiresRendererReadiness: true,
  requiresEditableAllowlist: true,
  requiresDynamicRouteGeometry: true,
  pixelScoreIsGate: false,
}))

export function getThemeParityAuditContract(themeId: ColorTheme | string): ThemeParityAuditContract | undefined {
  return THEME_PARITY_AUDIT_CONTRACTS.find(contract => contract.themeId === themeId)
}

export function getThemeParityApprovalState(
  themeId: ColorTheme | string,
  semanticSummary?: ThemeSemanticSummaryLike,
): ThemeParityApprovalState {
  const entry = getThemeScreenshotManifestEntry(themeId)
  const spec = getThemeSpecContract(themeId)
  const chrome = getThemeChromeContract(themeId)
  const semantic = getThemeParityAuditContract(themeId)
  const semanticTokens = getThemeSemanticAuditContract(themeId)
  const semanticGroupsPassed = hasRequiredSemanticRuntimeGroups(semanticSummary)
  const semanticRuntimePassed = passesThemeSemanticRuntimeGate(semanticSummary)
  const semanticScore = scoreThemeSemanticParity(semanticSummary)
  const visualReviewApproved = entry?.visualReview?.status === 'approved'
  const notImplementedCleared = Array.isArray(spec?.notImplemented) && spec.notImplemented.length === 0

  return {
    themeId: themeId as ColorTheme,
    semanticContractExists: Boolean(semantic && semanticTokens),
    chromeContractExists: Boolean(chrome),
    specContractExists: Boolean(spec),
    semanticRuntimePassed,
    semanticGroupsPassed,
    semanticScore,
    visualReviewApproved,
    notImplementedCleared,
    canMarkDone: Boolean(semantic && semanticTokens && chrome && spec && semanticRuntimePassed && visualReviewApproved && notImplementedCleared),
  }
}

export function getParityApprovedThemeIds(
  semanticSummariesByTheme: Partial<Record<ColorTheme, ThemeSemanticSummaryLike>> = {},
): ColorTheme[] {
  return THEME_SCREENSHOT_MANIFEST
    .filter(entry => getThemeParityApprovalState(entry.themeId, semanticSummariesByTheme[entry.themeId]).canMarkDone)
    .map(entry => entry.themeId)
}

export function getThemesMissingChromeContract(): ColorTheme[] {
  const chromeThemeIds = new Set(THEME_CHROME_CONTRACTS.map(contract => contract.themeId))
  return THEME_SCREENSHOT_MANIFEST
    .filter(entry => !chromeThemeIds.has(entry.themeId))
    .map(entry => entry.themeId)
}
