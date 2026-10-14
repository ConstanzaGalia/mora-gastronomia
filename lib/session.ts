import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { homePath, pickPrimaryRole, type AppRole } from '@/lib/format'
import type { Database } from '@/lib/database.types'

export type RoleMembership = Database['public']['Functions']['get_my_roles']['Returns'][number]

export type SessionContext = {
  userId: string
  profile: { nombre: string; apellido: string; dni: string } | null
  roles: RoleMembership[]
  primary: RoleMembership
  spaceId: string
  spaceName: string
  companyId: string | null
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.rpc('get_my_roles'),
    supabase.from('profiles').select('nombre, apellido, dni').eq('id', user.id).maybeSingle(),
  ])

  const primary = pickPrimaryRole(roles ?? [])
  if (!primary) return null

  const space = await resolveSpace(supabase, primary)
  if (!space) return null

  return {
    userId: user.id,
    profile,
    roles: roles ?? [],
    primary,
    spaceId: space.id,
    spaceName: space.name,
    companyId: primary.company_id,
  }
}

async function resolveSpace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  primary: RoleMembership,
) {
  if (primary.business_space_id) {
    const { data } = await supabase
      .from('business_spaces')
      .select('id, name')
      .eq('id', primary.business_space_id)
      .maybeSingle()
    return data
  }
  const { data } = await supabase.from('business_spaces').select('id, name').eq('slug', 'balcarce').maybeSingle()
  return data
}

export async function requireSession() {
  const session = await getSessionContext()
  if (!session) redirect('/login')
  return session
}

export function assertRole(session: SessionContext, roles: AppRole[]) {
  if (!roles.includes(session.primary.role)) redirect(homePath(session.primary.role))
}
