'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { DEFAULT_SELECTION_CLOSE, describeError, digits, selectionCloseInput } from '@/lib/format'
import { redirectWithError, sameOriginPath } from '@/lib/redirect-error'

async function requireCompanyAdmin() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  return session
}

async function loadOwnedCompany(companyId: string, spaceId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, business_space_id')
    .eq('id', companyId)
    .eq('business_space_id', spaceId)
    .maybeSingle()
  return { supabase, company: data }
}

export async function saveCompany(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])

  const id = String(formData.get('id') ?? '')
  const nombre = String(formData.get('nombre_comercial') ?? '').trim()
  const razon = String(formData.get('razon_social') ?? '').trim()
  const cuit = digits(String(formData.get('cuit') ?? ''))
  const active = formData.get('active') === 'on'
  const specialClose = formData.get('special_close') === 'on'
  const closeTime = specialClose ? selectionCloseInput(String(formData.get('selection_close_time') ?? '')) : DEFAULT_SELECTION_CLOSE

  if (!nombre) return { error: 'El nombre comercial es obligatorio.' }
  if (cuit && !/^[0-9]{11}$/.test(cuit)) return { error: 'El CUIT tiene que tener 11 dígitos, sin guiones.' }
  if (specialClose && !/^([01]\d|2[0-3]):[0-5]\d$/.test(closeTime)) return { error: 'Elegí una hora de cierre válida.' }

  const supabase = await createClient()
  const payload = {
    nombre_comercial: nombre,
    razon_social: razon || null,
    cuit: cuit || null,
    active,
    selection_close_time: closeTime,
    business_space_id: session.spaceId,
  }

  if (id) {
    const { error } = await supabase.from('companies').update({
      nombre_comercial: payload.nombre_comercial,
      razon_social: payload.razon_social,
      cuit: payload.cuit,
      active: payload.active,
      selection_close_time: payload.selection_close_time,
    }).eq('id', id)
    if (error) return { error: describeError(error) }
    revalidatePath('/empresas')
    revalidatePath(`/empresas/${id}`)
    revalidatePath('/mi-menu')
    revalidatePath('/elecciones')
    redirect(`/empresas/${id}`)
  }

  const { error } = await supabase.from('companies').insert(payload)
  if (error) return { error: describeError(error) }

  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('business_space_id', session.spaceId)
    .eq('nombre_comercial', nombre)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  revalidatePath('/empresas')
  revalidatePath('/mi-menu')
  redirect(`/empresas/${data?.id ?? ''}`)
}

export async function deleteCompany(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const from = sameOriginPath(formData.get('from'), `/empresas/${id}`)
  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!company) redirectWithError(from, 'No encontramos esa empresa.')

  const [{ count: people }, { count: selections }] = await Promise.all([
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('company_id', id),
    supabase.from('employee_selections').select('id', { count: 'exact', head: true }).eq('company_id', id),
  ])
  if ((people ?? 0) > 0 || (selections ?? 0) > 0) {
    redirectWithError(from, 'No se puede eliminar: tiene personas o elecciones. Podés desactivarla.')
  }

  const { error: linksError } = await supabase.from('company_gastronomic_categories').delete().eq('company_id', id)
  if (linksError) redirectWithError(from, describeError(linksError))
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) redirectWithError(from, describeError(error))
  revalidatePath('/empresas')
  redirect('/empresas')
}

export async function saveSector(_prev: { error: string; saved: boolean }, formData: FormData) {
  const session = await requireCompanyAdmin()
  const companyId = String(formData.get('company_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Poné el nombre del sector.', saved: false }

  const { supabase, company } = await loadOwnedCompany(companyId, session.spaceId)
  if (!company) return { error: 'No encontramos esa empresa.', saved: false }

  const { data: last } = await supabase
    .from('company_sectors')
    .select('sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('company_sectors').insert({
    company_id: companyId,
    business_space_id: session.spaceId,
    name,
    sort_order: (last?.sort_order ?? -1) + 1,
  })
  if (error) return { error: describeError(error), saved: false }
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/comensales')
  return { error: '', saved: true }
}

export async function updateSector(_prev: { error: string }, formData: FormData) {
  const session = await requireCompanyAdmin()
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Poné el nombre del sector.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_sectors')
    .update({ name })
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .select('company_id')
  if (error) return { error: describeError(error) }
  if (!data?.length) return { error: 'No encontramos ese sector.' }
  revalidatePath(`/empresas/${data[0].company_id}`)
  revalidatePath('/comensales')
  return { error: '' }
}

export async function deleteSector(formData: FormData) {
  const session = await requireCompanyAdmin()
  const id = String(formData.get('id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase
    .from('company_sectors')
    .delete()
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
  if (error) redirectWithError(`/empresas/${companyId}`, describeError(error))
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/empleados')
  revalidatePath('/comensales')
}

export async function moveSector(formData: FormData) {
  const session = await requireCompanyAdmin()
  const id = String(formData.get('id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const supabase = await createClient()
  const { data: sectors } = await supabase
    .from('company_sectors')
    .select('id, sort_order')
    .eq('company_id', companyId)
    .eq('business_space_id', session.spaceId)
    .order('sort_order')
  const list = sectors ?? []
  const index = list.findIndex((sector) => sector.id === id)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || swapWith < 0 || swapWith >= list.length) return
  const current = list[index]
  const other = list[swapWith]
  const { error: firstError } = await supabase.from('company_sectors').update({ sort_order: other.sort_order }).eq('id', current.id)
  if (firstError) redirectWithError(`/empresas/${companyId}`, describeError(firstError))
  const { error: secondError } = await supabase.from('company_sectors').update({ sort_order: current.sort_order }).eq('id', other.id)
  if (secondError) redirectWithError(`/empresas/${companyId}`, describeError(secondError))
  revalidatePath(`/empresas/${companyId}`)
  revalidatePath('/comensales')
}
