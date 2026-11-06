'use server'

import { revalidatePath } from 'next/cache'
import { ALL_ACCESS_VIEWS } from '@/lib/access'
import { businessToday, describeError, digits, type AccessView } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type AccessState = { error: string; notice: string }

const empty: AccessState = { error: '', notice: '' }

function revalidateEquipo() {
  revalidatePath('/equipo')
}

function parseViews(formData: FormData): AccessView[] {
  const raw = formData.getAll('views').map(String) as AccessView[]
  return ALL_ACCESS_VIEWS.filter((view) => raw.includes(view))
}

function parseCompanyIds(formData: FormData): string[] {
  return [...new Set(formData.getAll('company_ids').map(String).filter(Boolean))]
}

async function requireOrg() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN'])
  return session
}

async function organizationId(session: Awaited<ReturnType<typeof requireOrg>>) {
  return session.primary.organization_id
}

export async function saveAccessRole(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const session = await requireOrg()
  const orgId = await organizationId(session)
  const roleId = String(formData.get('role_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const views = parseViews(formData)
  const companyIds = parseCompanyIds(formData)

  if (!name) return { ...empty, error: 'El nombre del rol es obligatorio.' }
  if (!views.length) return { ...empty, error: 'Elegí al menos una pantalla.' }
  if (!companyIds.length) return { ...empty, error: 'Elegí al menos una empresa.' }

  const supabase = await createClient()
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, business_space_id')
    .in('id', companyIds)
    .eq('active', true)
  if (companiesError) return { ...empty, error: describeError(companiesError) }
  if ((companies ?? []).length !== companyIds.length) {
    return { ...empty, error: 'Alguna empresa no está disponible.' }
  }
  const spaces = new Set((companies ?? []).map((company) => company.business_space_id))
  if (spaces.size !== 1) return { ...empty, error: 'Todas las empresas del rol tienen que ser del mismo espacio.' }

  if (roleId) {
    const { data: existing } = await supabase
      .from('access_roles')
      .select('id')
      .eq('id', roleId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!existing) return { ...empty, error: 'No encontramos ese rol.' }

    const { data: activeMembers } = await supabase
      .from('memberships')
      .select('business_space_id')
      .eq('access_role_id', roleId)
      .eq('role', 'SCOPED')
      .eq('status', 'ACTIVE')
    const memberSpace = activeMembers?.[0]?.business_space_id ?? null
    const nextSpace = [...spaces][0]
    if (memberSpace && memberSpace !== nextSpace) {
      return {
        ...empty,
        error: 'Hay personas con este rol. Las empresas tienen que seguir siendo del mismo espacio.',
      }
    }

    const { error: updateError } = await supabase
      .from('access_roles')
      .update({ name })
      .eq('id', roleId)
    if (updateError) return { ...empty, error: describeError(updateError) }

    const [{ error: clearViews }, { error: clearCompanies }] = await Promise.all([
      supabase.from('access_role_views').delete().eq('access_role_id', roleId),
      supabase.from('access_role_companies').delete().eq('access_role_id', roleId),
    ])
    if (clearViews) return { ...empty, error: describeError(clearViews) }
    if (clearCompanies) return { ...empty, error: describeError(clearCompanies) }

    const { error: viewsError } = await supabase
      .from('access_role_views')
      .insert(views.map((view_key) => ({ access_role_id: roleId, view_key })))
    if (viewsError) return { ...empty, error: describeError(viewsError) }

    const { error: companiesInsertError } = await supabase
      .from('access_role_companies')
      .insert(companyIds.map((company_id) => ({ access_role_id: roleId, company_id })))
    if (companiesInsertError) return { ...empty, error: describeError(companiesInsertError) }

    revalidateEquipo()
    return { ...empty, notice: 'Rol actualizado.' }
  }

  const { data: created, error: createError } = await supabase
    .from('access_roles')
    .insert({ organization_id: orgId, name })
    .select('id')
    .single()
  if (createError || !created) return { ...empty, error: describeError(createError) }

  const { error: viewsError } = await supabase
    .from('access_role_views')
    .insert(views.map((view_key) => ({ access_role_id: created.id, view_key })))
  if (viewsError) {
    await supabase.from('access_roles').delete().eq('id', created.id)
    return { ...empty, error: describeError(viewsError) }
  }

  const { error: companiesInsertError } = await supabase
    .from('access_role_companies')
    .insert(companyIds.map((company_id) => ({ access_role_id: created.id, company_id })))
  if (companiesInsertError) {
    await supabase.from('access_roles').delete().eq('id', created.id)
    return { ...empty, error: describeError(companiesInsertError) }
  }

  revalidateEquipo()
  return { ...empty, notice: 'Rol creado.' }
}

export async function deactivateAccessRole(formData: FormData) {
  const session = await requireOrg()
  const orgId = await organizationId(session)
  const roleId = String(formData.get('role_id') ?? '')
  const supabase = await createClient()
  const today = businessToday()

  const { error } = await supabase
    .from('access_roles')
    .update({ active: false })
    .eq('id', roleId)
    .eq('organization_id', orgId)
  if (error) return

  await supabase
    .from('memberships')
    .update({ status: 'ENDED', ended_at: today })
    .eq('access_role_id', roleId)
    .eq('role', 'SCOPED')
    .eq('status', 'ACTIVE')

  revalidateEquipo()
}

export async function addScopedPerson(_prev: AccessState, formData: FormData): Promise<AccessState> {
  const session = await requireOrg()
  const orgId = await organizationId(session)
  const accessRoleId = String(formData.get('access_role_id') ?? '')
  const dni = digits(String(formData.get('dni') ?? ''))
  const nombre = String(formData.get('nombre') ?? '').trim()
  const apellido = String(formData.get('apellido') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!/^[0-9]{7,8}$/.test(dni)) return { ...empty, error: 'El DNI tiene que tener 7 u 8 dígitos.' }
  if (!nombre || !apellido) return { ...empty, error: 'Nombre y apellido son obligatorios.' }
  if (!email || !email.includes('@')) return { ...empty, error: 'Indicá un email válido.' }
  if (password.length < 6) return { ...empty, error: 'La contraseña tiene que tener al menos 6 caracteres.' }
  if (!accessRoleId) return { ...empty, error: 'Elegí un rol.' }

  const supabase = await createClient()
  const { data: role } = await supabase
    .from('access_roles')
    .select('id, organization_id, active')
    .eq('id', accessRoleId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!role || !role.active) return { ...empty, error: 'Ese rol no está disponible.' }

  const { data: roleCompanies } = await supabase
    .from('access_role_companies')
    .select('company_id')
    .eq('access_role_id', accessRoleId)
  const companyIds = (roleCompanies ?? []).map((row) => row.company_id)
  if (!companyIds.length) return { ...empty, error: 'El rol no tiene empresas asignadas.' }

  const { data: companyRows } = await supabase
    .from('companies')
    .select('id, business_space_id')
    .in('id', companyIds)
  const spaceId = companyRows?.[0]?.business_space_id ?? null
  if (!spaceId) return { ...empty, error: 'El rol no tiene empresas asignadas.' }

  const { data: foundRows, error: findError } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
  if (findError) return { ...empty, error: describeError(findError) }
  const found = foundRows?.[0] ?? null

  let userId = found?.profile_id ?? null
  const admin = createAdminClient()

  if (!found) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        dni,
        nombre,
        apellido,
        email_contacto: email,
      },
    })
    if (createError || !created.user) return { ...empty, error: describeError(createError) }
    userId = created.user.id
    await admin.from('profiles').update({ email }).eq('id', userId)
  } else {
    if (!found.activo) return { ...empty, error: 'Esa persona está inactiva.' }
    const { data: activeScoped } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', found.profile_id)
      .eq('role', 'SCOPED')
      .eq('status', 'ACTIVE')
      .maybeSingle()
    if (activeScoped) return { ...empty, error: 'Esa persona ya tiene un acceso limitado vigente.' }

    const { error: authError } = await admin.auth.admin.updateUserById(found.profile_id, {
      email,
      password,
      email_confirm: true,
    })
    if (authError) return { ...empty, error: describeError(authError) }
    await admin.from('profiles').update({ email, nombre, apellido }).eq('id', found.profile_id)
    userId = found.profile_id
  }

  if (!userId) return { ...empty, error: 'No se pudo crear la persona.' }

  const { error: membershipError } = await supabase.from('memberships').insert({
    user_id: userId,
    organization_id: orgId,
    business_space_id: spaceId,
    company_id: null,
    role: 'SCOPED',
    access_role_id: accessRoleId,
    status: 'ACTIVE',
    started_at: businessToday(),
  })
  if (membershipError) return { ...empty, error: describeError(membershipError) }

  revalidateEquipo()
  return { ...empty, notice: 'Persona sumada al equipo.' }
}

export async function endScopedMembership(formData: FormData) {
  await requireOrg()
  const membershipId = String(formData.get('membership_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('end_membership', {
    p_membership_id: membershipId,
    p_ended_at: businessToday(),
  })
  if (error) return
  revalidateEquipo()
}

export async function resetScopedPassword(_prev: AccessState, formData: FormData): Promise<AccessState> {
  await requireOrg()
  const userId = String(formData.get('user_id') ?? '')
  const password = String(formData.get('password') ?? '')
  if (password.length < 6) return { ...empty, error: 'La contraseña tiene que tener al menos 6 caracteres.' }

  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'SCOPED')
    .eq('status', 'ACTIVE')
    .maybeSingle()
  if (!membership) return { ...empty, error: 'No hay un acceso limitado vigente para esa persona.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { ...empty, error: describeError(error) }
  revalidateEquipo()
  return { ...empty, notice: 'Contraseña actualizada.' }
}
