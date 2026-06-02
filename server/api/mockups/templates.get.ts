import { z } from 'zod'
import { getProduct } from '~/utils/products'
import { getProductMockupChromeBoxes } from '~/utils/productMockupChrome'
import { getProductMockupTemplates, isMockupSupportedProduct } from '~/utils/productMockups'

const querySchema = z.object({
  product_uid: z.string().min(1),
})

export default defineEventHandler((event) => {
  const query = querySchema.parse(getQuery(event))
  const product = getProduct(query.product_uid)
  if (!isMockupSupportedProduct(product)) {
    throw createError({ statusCode: 400, message: 'A physical product_uid is required for mockup templates' })
  }

  return {
    product_uid: product.product_uid,
    templates: getProductMockupTemplates(product).map(template => ({
      id: template.id,
      label: template.sceneLabel,
      scene_file: template.sceneFile,
      finish: template.finish,
      asset_product_uid: template.assetProductUid,
      artwork_box: template.artworkBox,
      chrome_boxes: getProductMockupChromeBoxes(template),
      template_image_url: `/api/mockups/template-image?product_uid=${encodeURIComponent(product.product_uid)}&mockup_template_id=${encodeURIComponent(template.id)}`,
      is_default: template.isDefault,
    })),
  }
})
