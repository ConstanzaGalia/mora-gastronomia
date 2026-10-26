import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { homePath, pickPrimaryRole, type AppRole } from '@/lib/format'
import { SPACE_COOKIE, isEventosSlug, type SpaceOption } from '@/lib/space'
import type { Database } from '@/lib/database.types'

export type RoleMembership = Database['public']['Functions']['get_my_roles']['Returns'][number]

export type SessionContext = {
  userId: string
  profile: { nombre: string; apellido: string; dni: string } | null
  roles: RoleMembership[]
  primary: RoleMembership
  spaceId: string
  spaceName: string
  spaceSlug: string
  spaces: SpaceOption[]
  companyId: string | null
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: roles }, { data: profile }, { data: spaceRows }] = await Promise.all([
    supabase.rpc('get_my_roles'),
    supabase.from('profiles').select('nombre, apellido, dni').eq('id', user.id).maybeSingle(),
    supabase.from('business_spaces').select('id, name, slug').eq('active', true).order('name'),
  ])

  const primary = pickPrimaryRole(roles ?? [])
  if (!primary) return null

  const spaces = spaceRows ?? []
  const space = await resolveSpace(supabase, primary, spaces)
  if (!space) return null

  return {
    userId: user.id,
    profile,
    roles: roles ?? [],
    primary,
    spaceId: space.id,
    spaceName: space.name,
    spaceSlug: space.slug,
    spaces,
    companyId: primary.company_id,
  }
}

async function resolveSpace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  primary: RoleMembership,
  spaces: SpaceOption[],
) {
  if (primary.role !== 'ORG_ADMIN' && primary.business_space_id) {
    return spaces.find((space) => space.id === primary.business_space_id)
      ?? (await supabase.from('business_spaces').select('id, name, slug').eq('id', primary.business_space_id).maybeSingle()).data
  }

  const cookieStore = await cookies()
  const preferred = cookieStore.get(SPACE_COOKIE)?.value
  const fromCookie = preferred ? spaces.find((space) => space.id === preferred) : null
  if (fromCookie) return fromCookie

  return spaces.find((space) => space.slug === 'balcarce') ?? spaces[0] ?? null
}

export async function requireSession() {
  const session = await getSessionContext()
  if (!session) redirect('/login')
  return session
}

export function assertRole(session: SessionContext, roles: AppRole[]) {
  if (!roles.includes(session.primary.role)) redirect(homePath(session.primary.role))
}

export function isEventosSpace(session: SessionContext) {
  return isEventosSlug(session.spaceSlug)
}

export function assertEventosSpace(session: SessionContext) {
  if (!isEventosSpace(session)) redirect('/inicio')
}

export function assertViandasSpace(session: SessionContext) {
  if (isEventosSpace(session)) redirect('/inicio')
}
