import {
  parseBboxParam,
  parseLngLatParam,
  parseLocationCountry,
  parseLocationSearchText,
  parseMapboxSessionToken,
  suggestLocations,
} from '~/server/utils/locationSearch'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, max-age=60')
  const query = getQuery(event)
  const q = parseLocationSearchText(query.q, 120)
  if (!q || q.length < 2) return { results: [] }

  const results = await suggestLocations({
    q,
    sessionToken: parseMapboxSessionToken(query.session_token),
    country: parseLocationCountry(query.country),
    proximity: parseLngLatParam(query.proximity),
    bbox: parseBboxParam(query.bbox),
  })

  return { results }
})
