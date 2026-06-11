/**
 * Route middleware — requires authenticated session.
 * Applied to pages via definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (
    import.meta.dev
    && (
      to.query.e2eAuth === '1'
      || (import.meta.client && window.localStorage.getItem('radmaps:e2e-auth') === '1')
    )
  ) {
    return
  }

  const config = useRuntimeConfig()
  if (import.meta.dev && config.public.radmapsE2eAuth === '1') return

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
