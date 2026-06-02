import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { getProduct } from '~/utils/products'
import { getProductMockupTemplate, isMockupSupportedProduct } from '~/utils/productMockups'

const querySchema = z.object({
  product_uid: z.string().min(1),
  mockup_template_id: z.string().min(1).max(360),
})

export default defineEventHandler((event) => {
  const query = querySchema.parse(getQuery(event))
  const product = getProduct(query.product_uid)
  if (!isMockupSupportedProduct(product)) {
    throw createError({ statusCode: 400, message: 'A physical product_uid is required for mockup templates' })
  }

  const template = getProductMockupTemplate(product, query.mockup_template_id)
  if (!template) {
    throw createError({ statusCode: 404, message: 'Mockup template not found' })
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(join(process.cwd(), template.relativePath)))
})
