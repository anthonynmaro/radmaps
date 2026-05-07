/**
 * Route middleware — requires authenticated session.
 * Applied to pages via definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (user.value) return

  if (import.meta.client) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) {
      return
    }
  }

  return navigateTo('/auth/login')
})
