/**
 * Route middleware — requires authenticated session.
 * Applied to pages via definePageMeta({ middleware: 'auth' })
 */
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (user.value) return

  // On the client, the SSR-prefetched user can lag the cookie. Re-check
  // directly, but never let a hung auth call block navigation — fall
  // through to the login redirect on timeout.
  if (import.meta.client) {
    try {
      const supabase = useSupabaseClient()
      const result = await Promise.race([
        supabase.auth.getUser(),
        new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('auth timeout')), 3000),
        ),
      ])
      if (!result.error && result.data.user) return
    } catch {
      // fall through to redirect
    }
  }

  return navigateTo('/auth/login')
})
