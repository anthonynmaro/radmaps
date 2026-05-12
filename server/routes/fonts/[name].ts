import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createError, getRouterParam, sendStream, setHeader } from 'h3'
import { listAllFontFiles } from '~/utils/render/fontRegistry'

const allowedFontNames = new Set(
  listAllFontFiles().map(path => basename(path)),
)

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''
  if (!allowedFontNames.has(name)) {
    throw createError({ statusCode: 404, message: 'Font not found' })
  }

  const filePath = resolve(process.cwd(), 'fonts', name)
  await stat(filePath).catch(() => {
    throw createError({ statusCode: 404, message: 'Font not found' })
  })

  setHeader(event, 'content-type', 'font/ttf')
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')

  return sendStream(event, createReadStream(filePath))
})
