import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname !== '/auth/confirm') return
  if (event.method !== 'GET') return

  const code = url.searchParams.get('code')
  if (!code) return

  const supabase = await serverSupabaseClient(event)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/confirm] PKCE code exchange failed:', error.message)
    const params = new URLSearchParams({
      error_description: error.message,
    })
    return sendRedirect(event, `/auth/confirm?${params.toString()}`, 302)
  }

  return sendRedirect(event, '/', 302)
})
