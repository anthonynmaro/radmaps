import { describe, expect, it } from 'vitest'
import {
  isUsablePosterThumbnailUrl,
  posterThumbnailFailureKey,
  posterThumbnailUrl,
} from '../utils/posterThumbnail'

describe('poster thumbnail URL resolution', () => {
  it('prefers proof, thumbnail, then render URLs', () => {
    expect(posterThumbnailUrl({
      id: 'map-1',
      proof_render_url: 'https://example.com/proof.jpg',
      thumbnail_url: 'https://example.com/thumb.jpg',
      render_url: 'https://example.com/render.jpg',
    })).toBe('https://example.com/proof.jpg')
  })

  it('ignores renderer error sentinels instead of treating them as images', () => {
    expect(isUsablePosterThumbnailUrl('error: AWS renderer timeout')).toBe(false)
    expect(posterThumbnailUrl({
      id: 'map-1',
      proof_render_url: 'error: AWS renderer timeout',
      thumbnail_url: null,
      render_url: 'https://example.com/render.jpg',
    })).toBe('https://example.com/render.jpg')
  })

  it('falls through when the browser reports a URL failed to load', () => {
    const failed = {
      [posterThumbnailFailureKey('map-1', 'https://example.com/proof.jpg')]: true,
    }

    expect(posterThumbnailUrl({
      id: 'map-1',
      proof_render_url: 'https://example.com/proof.jpg',
      thumbnail_url: 'https://example.com/thumb.jpg',
      render_url: 'https://example.com/render.jpg',
    }, failed)).toBe('https://example.com/thumb.jpg')
  })

  it('returns null when every candidate is missing, errored, or failed', () => {
    const failed = {
      [posterThumbnailFailureKey('map-1', 'https://example.com/render.jpg')]: true,
    }

    expect(posterThumbnailUrl({
      id: 'map-1',
      proof_render_url: 'error: failed',
      thumbnail_url: '',
      render_url: 'https://example.com/render.jpg',
    }, failed)).toBeNull()
  })
})
