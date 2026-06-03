import { describe, expect, it } from 'vitest'
import { PREMADE_MAPS } from '~/data/premade-maps'
import { buildPremadePosterFallbackDataUrl, buildPremadePosterFallbackSvg } from '~/utils/premadePosterFallback'

describe('premade poster fallback', () => {
  it('renders a full poster-style SVG from static premade map data', () => {
    const jmt = PREMADE_MAPS.find(map => map.slug === 'john-muir-trail')
    expect(jmt).toBeTruthy()

    const svg = buildPremadePosterFallbackSvg(jmt!)

    expect(svg).toContain('John Muir Trail')
    expect(svg).toContain('DISTANCE')
    expect(svg).toContain('RADMAPS')
    expect(svg).toContain('<clipPath id="mapClip">')
    expect(svg).toContain('stroke="#C1121F"')
  })

  it('returns a data URL that can be used as checkout artwork', () => {
    const jmt = PREMADE_MAPS.find(map => map.slug === 'john-muir-trail')!
    const url = buildPremadePosterFallbackDataUrl(jmt)

    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(decodeURIComponent(url!.split(',')[1])).toContain('Happy Isles to Mount Whitney')
  })

  it('does not render without route geometry', () => {
    const jmt = PREMADE_MAPS.find(map => map.slug === 'john-muir-trail')!
    expect(buildPremadePosterFallbackSvg({ ...jmt, geojson: { type: 'FeatureCollection', features: [] } })).toBeNull()
  })
})
