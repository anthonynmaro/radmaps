import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FONT_REGISTRY, generateFontFaceCss, listAllFontFiles } from '../utils/render/fontRegistry'
import { REFINED_THEMES } from '../utils/themes/refined'
import { THEME_SEMANTIC_AUDIT_CONTRACTS } from '../utils/themes/semanticAuditContract'

describe('font registry', () => {
  it('registers every refined theme headline and body font', () => {
    for (const theme of REFINED_THEMES) {
      expect(theme.font_family, theme.id).toBeTruthy()
      expect(theme.body_font_family, theme.id).toBeTruthy()
      if (theme.font_family) expect(FONT_REGISTRY[theme.font_family], theme.font_family).toBeTruthy()
      if (theme.body_font_family) expect(FONT_REGISTRY[theme.body_font_family], theme.body_font_family).toBeTruthy()
    }
  })

  it('generates self-hosted font-face CSS for the registered files', () => {
    const css = generateFontFaceCss({ fontsUrlBase: '/fonts' })

    expect(css).toContain("@font-face")
    expect(css).toContain("font-family: 'Source Sans 3'")
    expect(css).toContain("url('/fonts/Source_Sans_3.ttf')")
    expect(css).toContain("font-family: 'Newsreader'")
    expect(css).toContain("font-family: 'IBM Plex Mono'")
    expect(css).toContain("font-family: 'Bebas Neue'")
    expect(css).toContain("url('/fonts/IBM_Plex_Mono.ttf')")
    expect(css).toContain("url('/fonts/Bebas_Neue-400.ttf')")
    expect(css).toContain("url('/fonts/Big_Shoulders_Display-800.ttf')")
    expect(css).toContain("url('/fonts/Playfair_Display-800.ttf')")
    expect(css).toContain(`font-weight: 800`)
    expect(listAllFontFiles().length).toBeGreaterThan(0)
  })

  it('emits every semantic parity font in the self-hosted AWS renderer CSS bundle', () => {
    const css = generateFontFaceCss({ fontsUrlBase: '/fonts' })
    const contractFonts = new Set(THEME_SEMANTIC_AUDIT_CONTRACTS.flatMap(contract => [
      contract.typography.titleFont,
      contract.typography.bodyFont,
    ]))

    for (const font of contractFonts) {
      expect(FONT_REGISTRY[font as keyof typeof FONT_REGISTRY], font).toBeTruthy()
      expect(css, font).toContain(`font-family: '${font}'`)
    }
  })

  it('self-hosts every literal font family referenced by posterData and spec contracts', () => {
    const css = generateFontFaceCss({ fontsUrlBase: '/fonts' })
    const sources = [
      readFileSync(resolve(process.cwd(), 'utils/posterData.ts'), 'utf8'),
      readFileSync(resolve(process.cwd(), 'utils/themes/specContract.ts'), 'utf8'),
    ].join('\n')
    const referenced = new Set<string>()
    for (const match of sources.matchAll(/'([^']+)'/g)) {
      const value = match[1]
      if (FONT_REGISTRY[value as keyof typeof FONT_REGISTRY]) referenced.add(value)
    }

    expect(referenced).toContain('IBM Plex Mono')
    for (const font of referenced) {
      expect(FONT_REGISTRY[font as keyof typeof FONT_REGISTRY], font).toBeTruthy()
      expect(css, font).toContain(`font-family: '${font}'`)
    }
  })

  it('publishes the font directory at the same URL used by font-face CSS', () => {
    const nuxtConfig = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')

    expect(nuxtConfig).toContain("new URL('./fonts'")
    expect(nuxtConfig).toContain("baseURL: '/fonts'")
    expect(nuxtConfig).not.toContain('fonts.googleapis.com')
    expect(nuxtConfig).not.toContain('fonts.gstatic.com')
    expect(nuxtConfig).not.toContain('https://fonts.')
  })

  it('has every registered print font file available locally', () => {
    for (const filePath of listAllFontFiles()) {
      const absolutePath = resolve(process.cwd(), filePath)
      const bytes = readFileSync(absolutePath)

      expect(bytes.byteLength, filePath).toBeGreaterThan(1024)
    }
  })
})
