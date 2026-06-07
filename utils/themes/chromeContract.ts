import chromeContract from './chromeContract.json'
import type { ColorTheme } from '~/types'

export interface ThemeChromeContract {
  themeId: ColorTheme
  typography?: {
    titleFont: string
    titleCase: 'uppercase' | 'none'
  }
  layout?: {
    titlePosition: 'top' | 'bottom'
    titleAlign: 'left' | 'center'
    footerVariant: 'standard' | 'compact' | 'data' | 'bib' | 'hidden'
  }
  requiredTestIds?: string[]
  forbiddenTestIds?: string[]
  requiredSelectors?: string[]
  forbiddenSelectors?: string[]
  requiredRouteLayers?: string[]
  forbiddenRouteLayers?: string[]
}

export const THEME_CHROME_CONTRACTS = chromeContract as ThemeChromeContract[]

export function getThemeChromeContract(themeId: ColorTheme | string): ThemeChromeContract | undefined {
  return THEME_CHROME_CONTRACTS.find(contract => contract.themeId === themeId)
}
