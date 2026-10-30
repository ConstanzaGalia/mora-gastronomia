'use server'

import { revalidatePath } from 'next/cache'
import { redirectWithError, sameOriginPath } from '@/lib/redirect-error'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/session'
import { businessToday, describeError, digits, employeeAuthEmail } from '@/lib/format'
import type { AppRole } from '@/lib/format'
import { matchSector, type CompanySector } from '@/lib/sectors'

export type OpenSelection = { service_date: string; company_name: string }

export type PeopleState = {
  error: string
  notice: string
  found: { profile_id: string; nombre: string; apellido: string; activo: boolean } | null
  openSelections: OpenSelection[]
  needsConfirm: boolean
}

const emptyState: PeopleState = {
  error: '',
  notice: '',
  found: null,
  openSelections: [],
  needsConfirm: false,
}

export async function lookupPerson(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  await requireSession()
  const dni = digits(String(formData.get('dni') ?? ''))
  if (!/^[0-9]{7,8}$/.test(dni)) return { ...emptyState, error: 'El DNI tiene que tener 7 u 8 dígitos.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
  if (error) return { ...emptyState, error: describeError(error) }
  const found = data?.[0] ?? null
  if (!found) return { ...emptyState, notice: 'No hay una persona con ese DNI. Podés crearla.' }

  const startedAt = String(formData.get('started_at') ?? '')
  const openSelections = await listOpenSelections(found.profile_id, startedAt)
  return {
    ...emptyState,
    found,
    openSelections,
    notice: `${found.apellido}, ${found.nombre} ya existe. Se va a reutilizar la misma cuenta.`,
  }
}

export async function addPerson(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const session = await requireSession()
  const companyId = String(formData.get('company_id') ?? '')
  const dni = digits(String(formData.get('dni') ?? ''))
  const role = String(formData.get('role') ?? 'EMPLOYEE') as AppRole
  const nombre = String(formData.get('nombre') ?? '').trim()
  const apellido = String(formData.get('apellido') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const startedAt = String(formData.get('started_at') ?? '') || null
  const confirmed = formData.get('confirm') === '1'

  if (!/^[0-9]{7,8}$/.test(dni)) return { ...emptyState, error: 'El DNI tiene que tener 7 u 8 dígitos.' }
  if (role !== 'EMPLOYEE' && role !== 'COMPANY_ADMIN') return { ...emptyState, error: 'Ese rol no se puede asignar desde acá.' }
  if (role === 'COMPANY_ADMIN' && session.primary.role === 'COMPANY_ADMIN') {
    return { ...emptyState, error: 'Solo Mora puede designar encargados.' }
  }

  const supabase = await createClient()
  const { data: foundRows, error: findError } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
  if (findError) return { ...emptyState, error: describeError(findError) }
  const found = foundRows?.[0] ?? null

  if (found && !found.activo) return { ...emptyState, found, error: 'Esa persona está inactiva.' }

  const openSelections = found ? await listOpenSelections(found.profile_id, startedAt ?? '') : []
  if (found && role === 'EMPLOYEE' && openSelections.length > 0 && !confirmed) {
    return {
      ...emptyState,
      found,
      openSelections,
      needsConfirm: true,
      notice: 'Esta persona ya existe. Las elecciones abiertas de días posteriores se cancelan. Las ya cerradas quedan en la empresa anterior.',
    }
  }

  if (!found) {
    if (!nombre || !apellido) return { ...emptyState, error: 'Para una persona nueva, nombre y apellido son obligatorios.' }
    if (role === 'COMPANY_ADMIN' && (!email || password.length < 6)) {
      return { ...emptyState, error: 'El encargado necesita un email y una contraseña de al menos 6 caracteres.' }
    }
    const created = await createIdentity({ dni, nombre, apellido, role, email, password })
    if (created.error) return { ...emptyState, error: created.error }
  } else if (role === 'COMPANY_ADMIN') {
    if (!email || password.length < 6) {
      return { ...emptyState, found, error: 'Para dejarla como encargada, indicá el email y una contraseña nueva.' }
    }
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(found.profile_id, {
      email,
      password,
      email_confirm: true,
    })
    if (error) return { ...emptyState, found, error: describeError(error) }
  }

  const { error } = await supabase.rpc('add_company_member', {
    p_company_id: companyId,
    p_dni: dni,
    p_role: role,
    p_started_at: startedAt ?? undefined,
  })
  if (error) return { ...emptyState, found, openSelections, error: describeError(error) }

  if (role === 'COMPANY_ADMIN' && email) {
    const contactError = await setProfileContactEmail(dni, email)
    if (contactError) return { ...emptyState, found, openSelections, error: contactError }
  }

  if (role === 'EMPLOYEE' && formData.has('sector_id')) {
    const { data: rows } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
    const userId = rows?.[0]?.profile_id
    if (userId) {
      const sectorError = await setEmployeeSector(supabase, companyId, userId, String(formData.get('sector_id') ?? ''))
      if (sectorError) return { ...emptyState, found, openSelections, error: sectorError }
    }
  }

  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empresas')
  revalidatePath('/empleados')
  revalidatePath('/reportes')
  revalidatePath('/comensales')
  return {
    ...emptyState,
    notice: found
      ? 'La persona quedó vinculada. Sigue entrando con sus credenciales anteriores, salvo que la hayas pasado a encargada.'
      : role === 'EMPLOYEE'
        ? 'Empleado creado. Entra con su DNI como usuario y contraseña.'
        : 'Encargado creado. Entra con el email y la contraseña que indicaste.',
  }
}

export async function updatePerson(_prev: { error: string; saved: boolean }, formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()
  const apellido = String(formData.get('apellido') ?? '').trim()
  if (!nombre || !apellido) return { error: 'Nombre y apellido son obligatorios.', saved: false }

  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').update({ nombre, apellido }).eq('id', id).select('id')
  if (error) return { error: describeError(error), saved: false }
  if (!data?.length) return { error: 'No se pudo guardar el nombre.', saved: false }
  if (formData.has('sector_id')) {
    const sectorError = await setEmployeeSector(supabase, companyId, id, String(formData.get('sector_id') ?? ''))
    if (sectorError) return { error: sectorError, saved: false }
  }
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empleados')
  revalidatePath('/comensales')
  return { error: '', saved: true }
}

export async function deleteMembership(formData: FormData) {
  await requireSession()
  const membershipId = String(formData.get('membership_id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const next = sameOriginPath(formData.get('next'), companyId ? `/empresas/${companyId}` : '/empleados')
  const supabase = await createClient()

  const { count } = await supabase
    .from('employee_selections')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', membershipId)
  if (count) {
    redirectWithError(next, 'No se puede eliminar: tiene elecciones. Usá Dar de baja para cerrar la relación y conservar el historial.')
  }

  const { data, error } = await supabase.from('memberships').delete().eq('id', membershipId).select('id')
  if (error) redirectWithError(next, describeError(error))
  if (!data?.length) redirectWithError(next, 'No se pudo eliminar a esa persona.')
  revalidatePath(next)
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empresas')
  revalidatePath('/empleados')
}

export async function endPersonMembership(formData: FormData) {
  await requireSession()
  const membershipId = String(formData.get('membership_id') ?? '')
  const endedAt = String(formData.get('ended_at') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('end_membership', {
    p_membership_id: membershipId,
    p_ended_at: endedAt || undefined,
  })
  if (error) return
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empresas')
  revalidatePath('/empleados')
}

export type ImportIssue = { line: number; dni: string; message: string }

export type ImportState = {
  error: string
  created: number
  linked: number
  skipped: number
  issues: ImportIssue[]
}

const emptyImport: ImportState = { error: '', created: 0, linked: 0, skipped: 0, issues: [] }

export async function importEmployees(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const session = await requireSession()
  if (!['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'].includes(session.primary.role)) {
    return { ...emptyImport, error: 'No tenés permiso para importar empleados.' }
  }

  const companyId = String(formData.get('company_id') ?? '')
  if (!companyId) return { ...emptyImport, error: 'Falta la empresa.' }
  if (session.primary.role === 'COMPANY_ADMIN' && session.companyId !== companyId) {
    return { ...emptyImport, error: 'Solo podés importar empleados de tu empresa.' }
  }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, business_space_id')
    .eq('id', companyId)
    .maybeSingle()
  if (!company || company.business_space_id !== session.spaceId) {
    return { ...emptyImport, error: 'No encontramos esa empresa.' }
  }

  const { data: sectorRows } = await supabase
    .from('company_sectors')
    .select('id, name, sort_order')
    .eq('company_id', companyId)
    .order('sort_order')
  const sectors = (sectorRows ?? []) as CompanySector[]

  let parsed: { apellido?: string; nombre?: string; dni?: string; sector?: string; line?: number }[] = []
  try {
    parsed = JSON.parse(String(formData.get('rows') ?? '[]'))
  } catch {
    return { ...emptyImport, error: 'No se pudieron leer las filas del archivo.' }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ...emptyImport, error: 'No hay empleados para importar.' }
  }
  if (parsed.length > 400) return { ...emptyImport, error: 'El archivo no puede tener más de 400 empleados.' }

  const startedAt = businessToday()
  const seen = new Set<string>()
  const issues: ImportIssue[] = []
  let created = 0
  let linked = 0
  let skipped = 0

  for (const item of parsed) {
    const line = Number(item.line) || 0
    const nombre = String(item.nombre ?? '').trim()
    const apellido = String(item.apellido ?? '').trim()
    const dni = digits(String(item.dni ?? ''))
    if (!nombre || !apellido) {
      issues.push({ line, dni, message: 'Faltan nombre o apellido.' })
      continue
    }
    if (!/^[0-9]{7,8}$/.test(dni)) {
      issues.push({ line, dni, message: 'El DNI tiene que tener 7 u 8 dígitos.' })
      continue
    }
    if (seen.has(dni)) {
      issues.push({ line, dni, message: 'DNI repetido en el archivo.' })
      continue
    }
    seen.add(dni)

    const sectorName = String(item.sector ?? '').trim()
    let sectorId: string | null = null
    if (sectorName) {
      if (sectors.length === 0) {
        issues.push({ line, dni, message: 'Esta empresa no tiene sectores. Cargalos en la ficha y volvé a importar.' })
        continue
      }
      const matched = matchSector(sectorName, sectors)
      if (!matched) {
        issues.push({ line, dni, message: `El sector ${sectorName} no está cargado en esta empresa.` })
        continue
      }
      sectorId = matched.id
    }

    const { data: foundRows, error: findError } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
    if (findError) {
      issues.push({ line, dni, message: describeError(findError) })
      continue
    }
    const found = foundRows?.[0] ?? null
    if (found && !found.activo) {
      issues.push({ line, dni, message: 'Esa persona está inactiva.' })
      continue
    }

    if (found) {
      const { data: current } = await supabase
        .from('memberships')
        .select('id')
        .eq('company_id', companyId)
        .eq('user_id', found.profile_id)
        .eq('role', 'EMPLOYEE')
        .eq('status', 'ACTIVE')
        .maybeSingle()
      if (current) {
        if (sectorId) {
          const sectorError = await setEmployeeSector(supabase, companyId, found.profile_id, sectorId)
          if (sectorError) {
            issues.push({ line, dni, message: sectorError })
            continue
          }
        }
        skipped += 1
        continue
      }
    } else {
      const createdUser = await createIdentity({ dni, nombre, apellido, role: 'EMPLOYEE', email: '', password: '' })
      if (createdUser.error) {
        issues.push({ line, dni, message: createdUser.error })
        continue
      }
    }

    const { error } = await supabase.rpc('add_company_member', {
      p_company_id: companyId,
      p_dni: dni,
      p_role: 'EMPLOYEE',
      p_started_at: startedAt,
    })
    if (error) {
      issues.push({ line, dni, message: describeError(error) })
      continue
    }
    if (sectorId) {
      const { data: rows } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
      const userId = rows?.[0]?.profile_id
      if (userId) {
        const sectorError = await setEmployeeSector(supabase, companyId, userId, sectorId)
        if (sectorError) {
          issues.push({ line, dni, message: sectorError })
          continue
        }
      }
    }
    if (found) linked += 1
    else created += 1
  }

  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empresas')
  revalidatePath('/empleados')
  revalidatePath('/reportes')
  revalidatePath('/comensales')

  if (created + linked + skipped === 0 && issues.length > 0) {
    return { ...emptyImport, issues, error: 'No se pudo importar ningún empleado. Revisá las filas con error.' }
  }

  return { error: '', created, linked, skipped, issues }
}

async function listOpenSelections(profileId: string, startedAt: string): Promise<OpenSelection[]> {
  const supabase = await createClient()
  const cutoff = startedAt || new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('employee_selections')
    .select('service_date, locked_at, companies(nombre_comercial)')
    .eq('employee_id', profileId)
    .eq('status', 'SUBMITTED')
    .gte('service_date', cutoff)

  const now = Date.now()
  return (data ?? [])
    .filter((row) => new Date(row.locked_at).getTime() > now && row.service_date >= cutoff)
    .map((row) => ({
      service_date: row.service_date,
      company_name: row.companies?.nombre_comercial ?? 'Empresa anterior',
    }))
}

async function setEmployeeSector(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string,
  rawSectorId: string,
) {
  const sectorId = rawSectorId.trim() || null
  if (sectorId) {
    const { data: sector } = await supabase
      .from('company_sectors')
      .select('id')
      .eq('id', sectorId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!sector) return 'Ese sector no pertenece a esta empresa.'
  }
  const { error } = await supabase
    .from('memberships')
    .update({ sector_id: sectorId })
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('role', 'EMPLOYEE')
    .eq('status', 'ACTIVE')
  if (error) return describeError(error)
  return ''
}

async function createIdentity(input: {
  dni: string
  nombre: string
  apellido: string
  role: AppRole
  email: string
  password: string
}) {
  const admin = createAdminClient()
  const email = input.role === 'EMPLOYEE' ? employeeAuthEmail(input.dni) : input.email
  const password = input.role === 'EMPLOYEE' ? input.dni : input.password
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      dni: input.dni,
      nombre: input.nombre,
      apellido: input.apellido,
      email_contacto: input.role === 'COMPANY_ADMIN' ? input.email : undefined,
    },
  })
  if (!error) return { error: '' }
  return { error: describeError(error) }
}

async function setProfileContactEmail(dni: string, email: string) {
  const supabase = await createClient()
  const { data: rows } = await supabase.rpc('find_profile_by_dni', { p_dni: dni })
  const userId = rows?.[0]?.profile_id
  if (!userId) return 'No encontramos el perfil para guardar el email.'
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ email }).eq('id', userId)
  return error ? describeError(error) : ''
}
