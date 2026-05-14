import { serverSupabaseClient } from '#supabase/server'

function safeNextPath(value: string | null): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

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
      next: safeNextPath(url.searchParams.get('next')),
    })
    return sendRedirect(event, `/auth/confirm?${params.toString()}`, 302)
  }

  return sendRedirect(event, safeNextPath(url.searchParams.get('next')), 302)
})
