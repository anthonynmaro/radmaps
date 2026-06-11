import {
  parseMapboxSessionToken,
  retrieveLocation,
} from '~/server/utils/locationSearch'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, max-age=86400')
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing location result id' })
  }

  const query = getQuery(event)
  const result = await retrieveLocation({
    id,
    sessionToken: parseMapboxSessionToken(query.session_token),
  })

  if (!result) {
    throw createError({ statusCode: 404, message: 'Location result not found' })
  }

  return result
})
