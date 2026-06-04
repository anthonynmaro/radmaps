import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FONT_REGISTRY, generateFontFaceCss, listAllFontFiles } from '../utils/render/fontRegistry'
import { REFINED_THEMES } from '../utils/themes/refined'

describe('font registry', () => {
  it('registers every refined theme headline and body font', () => {
    for (const theme of REFINED_THEMES) {
      expect(FONT_REGISTRY[theme.font_family], theme.font_family).toBeTruthy()
      expect(FONT_REGISTRY[theme.body_font_family], theme.body_font_family).toBeTruthy()
    }
  })

  it('generates self-hosted font-face CSS for the registered files', () => {
    const css = generateFontFaceCss({ fontsUrlBase: '/fonts' })

    expect(css).toContain("@font-face")
    expect(css).toContain("font-family: 'Source Sans 3'")
    expect(css).toContain("url('/fonts/Source_Sans_3.ttf')")
    expect(css).toContain("font-family: 'Newsreader'")
    expect(css).toContain("font-family: 'Bebas Neue'")
    expect(css).toContain("url('/fonts/Bebas_Neue-400.ttf')")
    expect(css).toContain("url('/fonts/Big_Shoulders_Display-800.ttf')")
    expect(css).toContain("url('/fonts/Playfair_Display-800.ttf')")
    expect(css).toContain(`font-weight: 800`)
    expect(listAllFontFiles().length).toBeGreaterThan(0)
  })

  it('publishes the font directory at the same URL used by font-face CSS', () => {
    const nuxtConfig = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')

    expect(nuxtConfig).toContain("new URL('./fonts'")
    expect(nuxtConfig).toContain("baseURL: '/fonts'")
  })
})
