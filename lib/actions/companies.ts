'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { describeError, digits } from '@/lib/format'
import { redirectWithError, sameOriginPath } from '@/lib/redirect-error'

export async function saveCompany(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])

  const id = String(formData.get('id') ?? '')
  const nombre = String(formData.get('nombre_comercial') ?? '').trim()
  const razon = String(formData.get('razon_social') ?? '').trim()
  const cuit = digits(String(formData.get('cuit') ?? ''))
  const active = formData.get('active') === 'on'

  if (!nombre) return { error: 'El nombre comercial es obligatorio.' }
  if (cuit && !/^[0-9]{11}$/.test(cuit)) return { error: 'El CUIT tiene que tener 11 dígitos, sin guiones.' }

  const supabase = await createClient()
  const payload = {
    nombre_comercial: nombre,
    razon_social: razon || null,
    cuit: cuit || null,
    active,
    business_space_id: session.spaceId,
  }

  if (id) {
    const { error } = await supabase.from('companies').update({
      nombre_comercial: payload.nombre_comercial,
      razon_social: payload.razon_social,
      cuit: payload.cuit,
      active: payload.active,
    }).eq('id', id)
    if (error) return { error: describeError(error) }
    revalidatePath('/empresas')
    revalidatePath(`/empresas/${id}`)
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
