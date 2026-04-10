/**
 * Route middleware — requires authenticated session.
 * Applied to pages via definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/auth/login')
  }
})
