import type { PosterIconId } from '~/types'

export interface PosterIconDefinition {
  id: PosterIconId
  label: string
  viewBox: string
  paths: string[]
}

export const POSTER_ICONS: PosterIconDefinition[] = [
  {
    id: 'trailhead',
    label: 'Trailhead',
    viewBox: '0 0 24 24',
    paths: [
      'M12 3.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 5.5 11.5 5.5 11.5S17.5 13.1 17.5 9A5.5 5.5 0 0 0 12 3.5Zm0 7.75A2.25 2.25 0 1 1 12 6.75a2.25 2.25 0 0 1 0 4.5Z',
    ],
  },
  {
    id: 'mountain',
    label: 'Mountain',
    viewBox: '0 0 24 24',
    paths: [
      'M3 19.5 9.25 6.25l3.6 7.1 2.05-3.1L21 19.5H3Zm5.2-2h4.6L9.35 10.2 8.2 17.5Zm7.05 0h2.1l-2.55-3.85-1.05 1.6 1.5 2.25Z',
    ],
  },
  {
    id: 'compass',
    label: 'Compass',
    viewBox: '0 0 24 24',
    paths: [
      'M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm0 2a7.25 7.25 0 1 1 0 14.5 7.25 7.25 0 0 1 0-14.5Zm4.2 3.05-2.1 5.35-5.35 2.1 2.1-5.35 5.35-2.1Zm-4.15 3.05-.75 1.9 1.9-.75.75-1.9-1.9.75Z',
    ],
  },
  {
    id: 'star',
    label: 'Star',
    viewBox: '0 0 24 24',
    paths: [
      'm12 3 2.55 5.85 6.35.6-4.8 4.2 1.4 6.25L12 16.7l-5.5 3.2 1.4-6.25-4.8-4.2 6.35-.6L12 3Z',
    ],
  },
  {
    id: 'camp',
    label: 'Camp',
    viewBox: '0 0 24 24',
    paths: [
      'M4 20 11.15 4h1.7L20 20h-2.25l-1.2-2.7H7.45L6.25 20H4Zm4.35-4.7h7.3L12 7.15 8.35 15.3Zm3.65-2.05 1.9 4.25h-3.8L12 13.25Z',
    ],
  },
  {
    id: 'water',
    label: 'Water',
    viewBox: '0 0 24 24',
    paths: [
      'M12 3.25s6 6.7 6 11.05A6 6 0 1 1 6 14.3c0-4.35 6-11.05 6-11.05Zm0 3.2c-1.8 2.3-4 5.75-4 7.85a4 4 0 0 0 8 0c0-2.1-2.2-5.55-4-7.85Z',
    ],
  },
]

export function getPosterIcon(id: PosterIconId) {
  return POSTER_ICONS.find(icon => icon.id === id) ?? POSTER_ICONS[0]
}
