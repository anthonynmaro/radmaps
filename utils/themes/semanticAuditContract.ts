import semanticAuditContract from './semanticAuditContract.json'
import type { ColorTheme, CompositionId, StylePreset } from '~/types'

export interface ThemeTypographySemanticContract {
  titleFont: string
  bodyFont: string
}

export interface ThemeLayoutSemanticContract {
  composition: CompositionId
}

export interface ThemePaletteSemanticContract {
  backgroundColor: string
  labelBackgroundColor: string
  labelTextColor: string
  routeColor: string
}

export interface ThemeMapSemanticContract {
  preset: StylePreset
  showContours: boolean
  showHillshade: boolean
  showRoads: boolean
  showPlaceLabels: boolean
  showPoiLabels: boolean
  showGrid: boolean
  gridScope?: 'poster' | 'map'
  gridOpacity?: number
  gridSpacing?: number
  gridWeight?: number
  tileEffect?: string
  tileGrain?: number
  showElevationProfile?: boolean
}

export interface ThemeRouteSemanticContract {
  color: string
  width: number
  opacity: number
  startPin: boolean
  finishPin: boolean
}

export interface ThemeSemanticAuditContract {
  themeId: ColorTheme
  typography: ThemeTypographySemanticContract
  layout: ThemeLayoutSemanticContract
  palette: ThemePaletteSemanticContract
  map: ThemeMapSemanticContract
  route: ThemeRouteSemanticContract
}

export const THEME_SEMANTIC_AUDIT_CONTRACTS = semanticAuditContract as ThemeSemanticAuditContract[]

export function getThemeSemanticAuditContract(themeId: ColorTheme | string): ThemeSemanticAuditContract | undefined {
  return THEME_SEMANTIC_AUDIT_CONTRACTS.find(contract => contract.themeId === themeId)
}
