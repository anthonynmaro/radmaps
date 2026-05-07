import { getEnabledFeatureFlags } from '~/server/utils/featureFlags'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { flags: await getEnabledFeatureFlags(event) }
})
