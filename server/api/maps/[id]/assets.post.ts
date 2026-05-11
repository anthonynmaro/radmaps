import { handleMapAssetUpload } from '~/server/utils/mapAssetUpload'

export default defineEventHandler(async (event) => {
  return handleMapAssetUpload(event)
})
