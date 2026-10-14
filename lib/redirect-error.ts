import { redirect } from 'next/navigation'

export function redirectWithError(path: string, message: string): never {
  const url = new URL(path, 'http://local')
  url.searchParams.set('error', message)
  redirect(`${url.pathname}${url.search}`)
}

export function sameOriginPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? '')
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
