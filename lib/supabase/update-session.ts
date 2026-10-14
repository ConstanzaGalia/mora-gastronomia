import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { AuthError } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const STALE_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
  'session_not_found',
  'validation_failed',
])

function isAuthCookie(name: string) {
  return name.startsWith('sb-') && name.includes('auth-token')
}

function isStaleSession(error: AuthError | null) {
  if (!error) return false
  if (error.name === 'AuthSessionMissingError') return true
  return STALE_SESSION_CODES.has(error.code ?? '')
}

function withoutAuthCookies(response: NextResponse, names: string[]) {
  for (const name of names) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
  return response
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const authCookieNames = request.cookies.getAll().map(({ name }) => name).filter(isAuthCookie)
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isLogin = path.startsWith('/login')
  const isPublicHome = path === '/'
  const isLoginPost = isLogin && request.method === 'POST'
  const dropSession = authCookieNames.length > 0 && !user && !isLoginPost && isStaleSession(error)

  if (!user && !isLogin && !isPublicHome) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    return dropSession ? withoutAuthCookies(redirect, authCookieNames) : redirect
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return dropSession ? withoutAuthCookies(supabaseResponse, authCookieNames) : supabaseResponse
}
