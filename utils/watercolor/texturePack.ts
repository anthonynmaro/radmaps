import { join } from 'node:path'
import type { WatercolorTexturePack } from './types'

export function defaultWatercolorTexturePack(): WatercolorTexturePack {
  const root = join(process.cwd(), 'assets/watercolor/v2-dev')
  return {
    paperClean: join(root, 'paper-coldpress-clean.png'),
    paperAged: join(root, 'paper-coldpress-aged.png'),
    stains: join(root, 'damp-paper-stains.png'),
    blueWash: join(root, 'wash-blue.png'),
    greenWash: join(root, 'wash-green.png'),
    granulation: join(root, 'granulation.png'),
    roadMajor: join(root, 'drybrush-road-major.png'),
    roadMinor: join(root, 'drybrush-road-minor.png'),
    trailWaterway: join(root, 'drybrush-trail-waterway.png'),
    blooms: join(root, 'bloom-sparse.png'),
  }
}
