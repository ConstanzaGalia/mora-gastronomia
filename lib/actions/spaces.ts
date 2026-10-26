'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { SPACE_COOKIE } from '@/lib/space'

export async function switchSpace(formData: FormData) {
  const session = await requireSession()
  const spaceId = String(formData.get('space_id') ?? '')
  if (!session.spaces.some((space) => space.id === spaceId)) redirect('/inicio')

  const cookieStore = await cookies()
  cookieStore.set(SPACE_COOKIE, spaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  redirect('/inicio')
}
