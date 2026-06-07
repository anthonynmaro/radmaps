import manifest from './screenshotManifest.json'
import type { ColorTheme, CompositionId } from '~/types'

export type ThemeParityTrack = 'image-gated' | 'spec-gated'
export type ThemeVisualReviewStatus = 'pending' | 'approved' | 'needs-work'

export interface ThemeVisualReview {
  status: ThemeVisualReviewStatus
  reviewer?: string | null
  reviewedAt?: string | null
  notes?: string
}

export interface ThemeScreenshotManifestEntry {
  themeId: ColorTheme
  displayName: string
  composition: CompositionId
  contentFixture: string
  routeFixture?: string
  referencePath: string | null
  track: ThemeParityTrack
  visualReview?: ThemeVisualReview
  fixtureOverrides?: {
    title?: string
    location?: string
    occasion?: string
    compositionMeta?: string
    distanceKm?: number
    gainM?: number
    durationSeconds?: number
    date?: string
  }
}

export const THEME_SCREENSHOT_MANIFEST = manifest as ThemeScreenshotManifestEntry[]

export const IMAGE_GATED_THEME_IDS = THEME_SCREENSHOT_MANIFEST
  .filter(entry => entry.track === 'image-gated')
  .map(entry => entry.themeId)

export const SPEC_GATED_THEME_IDS = THEME_SCREENSHOT_MANIFEST
  .filter(entry => entry.track === 'spec-gated')
  .map(entry => entry.themeId)

export function getThemeScreenshotManifestEntry(themeId: ColorTheme | string): ThemeScreenshotManifestEntry | undefined {
  return THEME_SCREENSHOT_MANIFEST.find(entry => entry.themeId === themeId)
}

export function isManifestRefinedTheme(themeId: ColorTheme | string): boolean {
  return Boolean(getThemeScreenshotManifestEntry(themeId))
}
