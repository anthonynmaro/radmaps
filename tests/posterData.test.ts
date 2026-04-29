import { describe, it, expect } from 'vitest'
import { toFontStack, getPosterTypography, getPosterLayout, SERIF_FONTS } from '../utils/posterData'
import type { ColorTheme, FontFamily } from '../types'

// ── toFontStack ───────────────────────────────────────────────────────────────

describe('toFontStack', () => {
  it('wraps a font name in single quotes', () => {
    expect(toFontStack('DM Sans')).toContain("'DM Sans'")
  })

  it('returns serif fallback for Playfair Display', () => {
    expect(toFontStack('Playfair Display')).toBe("'Playfair Display', serif")
  })

  it('returns sans-serif fallback for DM Sans', () => {
    expect(toFontStack('DM Sans')).toBe("'DM Sans', sans-serif")
  })

  it('all SERIF_FONTS use serif fallback', () => {
    for (const font of SERIF_FONTS) {
      expect(toFontStack(font)).toMatch(/serif$/)
      expect(toFontStack(font)).not.toMatch(/sans-serif$/)
    }
  })

  it('non-serif fonts use sans-serif fallback', () => {
    const nonSerif: FontFamily[] = ['Big Shoulders Display', 'Oswald', 'DM Sans', 'Bebas Neue']
    for (const font of nonSerif) {
      expect(toFontStack(font)).toMatch(/sans-serif$/)
    }
  })
})

// ── getPosterTypography ───────────────────────────────────────────────────────

const ALL_THEMES: ColorTheme[] = [
  'chalk', 'topaz', 'dusk', 'obsidian', 'forest', 'midnight',
  'editorial', 'bauhaus', 'vintage', 'brutalist', 'risograph',
  'blueprint', 'kertok', 'mid-century', 'topo-art', 'dark-sky',
]

describe('getPosterTypography', () => {
  it('returns a profile for all 16 themes', () => {
    for (const theme of ALL_THEMES) {
      const p = getPosterTypography({ color_theme: theme, font_family: undefined, body_font_family: undefined })
      expect(p).toBeDefined()
      expect(typeof p.titleFont).toBe('string')
      expect(typeof p.titleSize).toBe('number')
    }
  })

  it('falls back to chalk when theme is unknown', () => {
    const chalk = getPosterTypography({ color_theme: 'chalk', font_family: undefined, body_font_family: undefined })
    const unknown = getPosterTypography({ color_theme: 'nonexistent' as ColorTheme, font_family: undefined, body_font_family: undefined })
    expect(unknown.titleFont).toBe(chalk.titleFont)
    expect(unknown.titleSize).toBe(chalk.titleSize)
  })

  it('font_family override replaces titleFont', () => {
    const base = getPosterTypography({ color_theme: 'chalk', font_family: undefined, body_font_family: undefined })
    const override = getPosterTypography({ color_theme: 'chalk', font_family: 'Oswald', body_font_family: undefined })
    expect(override.titleFont).toBe("'Oswald', sans-serif")
    expect(override.titleFont).not.toBe(base.titleFont)
  })

  it('body_font_family override replaces subFont and statsFont', () => {
    const p = getPosterTypography({ color_theme: 'chalk', font_family: 'Oswald', body_font_family: 'Playfair Display' })
    expect(p.subFont).toBe("'Playfair Display', serif")
    expect(p.statsFont).toBe("'Playfair Display', serif")
  })

  it('font override preserves weight and tracking from theme', () => {
    const base = getPosterTypography({ color_theme: 'chalk', font_family: undefined, body_font_family: undefined })
    const override = getPosterTypography({ color_theme: 'chalk', font_family: 'Oswald', body_font_family: undefined })
    expect(override.titleWeight).toBe(base.titleWeight)
    expect(override.titleTracking).toBe(base.titleTracking)
  })

  it('all profiles have positive titleSize', () => {
    for (const theme of ALL_THEMES) {
      const p = getPosterTypography({ color_theme: theme, font_family: undefined, body_font_family: undefined })
      expect(p.titleSize).toBeGreaterThan(0)
    }
  })
})

// ── getPosterLayout ───────────────────────────────────────────────────────────

describe('getPosterLayout', () => {
  it('returns a layout profile for all 16 themes', () => {
    for (const theme of ALL_THEMES) {
      const l = getPosterLayout({ color_theme: theme })
      expect(['left', 'center']).toContain(l.titleAlign)
      expect(['top', 'bottom']).toContain(l.titlePosition)
    }
  })

  it('chalk has titlePosition top and titleAlign center', () => {
    const l = getPosterLayout({ color_theme: 'chalk' })
    expect(l.titlePosition).toBe('top')
    expect(l.titleAlign).toBe('center')
  })

  it('bauhaus has titlePosition bottom', () => {
    expect(getPosterLayout({ color_theme: 'bauhaus' }).titlePosition).toBe('bottom')
  })

  it('editorial has titleAlign left', () => {
    expect(getPosterLayout({ color_theme: 'editorial' }).titleAlign).toBe('left')
  })

  it('falls back to chalk layout for unknown theme', () => {
    const chalk = getPosterLayout({ color_theme: 'chalk' })
    const unknown = getPosterLayout({ color_theme: 'nonexistent' as ColorTheme })
    expect(unknown.titleAlign).toBe(chalk.titleAlign)
    expect(unknown.titlePosition).toBe(chalk.titlePosition)
  })
})
