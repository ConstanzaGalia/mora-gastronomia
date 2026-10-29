'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { describeError, slugify } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'

export async function saveCategory(_prev: { error: string; saved: boolean }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre de la categoría es obligatorio.', saved: false }
  const slug = slugify(name)
  if (!slug) return { error: 'El nombre no genera un identificador válido.', saved: false }

  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, 'gastronomic_categories', session.spaceId, formData.get('sort_order'))
  const { error } = await supabase.from('gastronomic_categories').insert({
    business_space_id: session.spaceId,
    name,
    slug,
    sort_order: sortOrder,
  })
  if (error) return { error: describeError(error), saved: false }
  revalidatePath('/catalogo')
  return { error: '', saved: true }
}

export async function saveOption(_prev: { error: string; saved: boolean }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const name = String(formData.get('name') ?? '').trim()
  const categoryId = String(formData.get('category_id') ?? '')
  if (!name || !categoryId) return { error: 'Elegí la categoría y el nombre de la opción.', saved: false }

  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, 'gastronomic_options', categoryId, formData.get('sort_order'))
  const { error } = await supabase.from('gastronomic_options').insert({
    category_id: categoryId,
    name,
    sort_order: sortOrder,
  })
  if (error) return { error: describeError(error), saved: false }
  revalidatePath('/catalogo')
  return { error: '', saved: true }
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'gastronomic_categories' | 'gastronomic_options',
  id: string,
  raw: FormDataEntryValue | null,
) {
  const given = String(raw ?? '').trim()
  if (given) return Number(given) || 0
  const query = table === 'gastronomic_categories'
    ? supabase.from('gastronomic_categories').select('sort_order').eq('business_space_id', id)
    : supabase.from('gastronomic_options').select('sort_order').eq('category_id', id)
  const { data } = await query.order('sort_order', { ascending: false }).limit(1).maybeSingle()
  return (data?.sort_order ?? -1) + 1
}

export async function updateCategory(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre de la categoría es obligatorio.' }
  const slug = slugify(name)
  if (!slug) return { error: 'El nombre no genera un identificador válido.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gastronomic_categories')
    .update({ name, slug })
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .select('id')
  if (error) return { error: describeError(error) }
  if (!data?.length) return { error: 'No encontramos esa categoría.' }
  revalidatePath('/catalogo')
  return { error: '' }
}

export async function deleteCategory(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data: category } = await supabase
    .from('gastronomic_categories')
    .select('id')
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!category) redirectWithError('/catalogo', 'No encontramos esa categoría.')

  const { data: options } = await supabase.from('gastronomic_options').select('id').eq('category_id', id)
  const optionIds = (options ?? []).map((option) => option.id)
  if (optionIds.length > 0) {
    const { count } = await supabase
      .from('employee_selection_items')
      .select('id', { count: 'exact', head: true })
      .in('option_id', optionIds)
    if (count) redirectWithError('/catalogo', 'No se puede eliminar: alguna opción ya fue elegida. Podés desactivarla.')
    const { error: availabilityError } = await supabase.from('daily_availability').delete().in('option_id', optionIds)
    if (availabilityError) redirectWithError('/catalogo', describeError(availabilityError))
    const { error: optionsError } = await supabase.from('gastronomic_options').delete().in('id', optionIds)
    if (optionsError) redirectWithError('/catalogo', describeError(optionsError))
  }

  const { error: linksError } = await supabase.from('company_gastronomic_categories').delete().eq('category_id', id)
  if (linksError) redirectWithError('/catalogo', describeError(linksError))
  const { error } = await supabase.from('gastronomic_categories').delete().eq('id', id)
  if (error) redirectWithError('/catalogo', describeError(error))
  revalidatePath('/catalogo')
  revalidatePath('/empresas')
}

export async function updateOption(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre de la opción es obligatorio.' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('gastronomic_options').update({ name }).eq('id', id).select('id')
  if (error) return { error: describeError(error) }
  if (!data?.length) return { error: 'No encontramos esa opción.' }
  revalidatePath('/catalogo')
  return { error: '' }
}

export async function deleteOption(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data: option } = await supabase.from('gastronomic_options').select('id, category_id').eq('id', id).maybeSingle()
  if (!option) redirectWithError('/catalogo', 'No encontramos esa opción.')
  const { data: category } = await supabase.from('gastronomic_categories').select('business_space_id').eq('id', option.category_id).maybeSingle()
  if (category?.business_space_id !== session.spaceId) redirectWithError('/catalogo', 'No encontramos esa opción.')

  const { count } = await supabase
    .from('employee_selection_items')
    .select('id', { count: 'exact', head: true })
    .eq('option_id', id)
  if (count) redirectWithError('/catalogo', 'No se puede eliminar: ya fue elegida. Podés desactivarla.')

  const { error: availabilityError } = await supabase.from('daily_availability').delete().eq('option_id', id)
  if (availabilityError) redirectWithError('/catalogo', describeError(availabilityError))
  const { error } = await supabase.from('gastronomic_options').delete().eq('id', id)
  if (error) redirectWithError('/catalogo', describeError(error))
  revalidatePath('/catalogo')
}

export async function setCategoryActive(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const supabase = await createClient()
  await supabase
    .from('gastronomic_categories')
    .update({ active: formData.get('active') === 'true' })
    .eq('id', String(formData.get('id')))
  revalidatePath('/catalogo')
}

export async function setOptionActive(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const supabase = await createClient()
  await supabase
    .from('gastronomic_options')
    .update({ active: formData.get('active') === 'true' })
    .eq('id', String(formData.get('id')))
  revalidatePath('/catalogo')
}

export async function saveCompanyCategories(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const companyId = String(formData.get('company_id') ?? '')
  const selected = new Set(formData.getAll('category_id').map(String))
  const supabase = await createClient()

  const { data: existing, error: readError } = await supabase
    .from('company_gastronomic_categories')
    .select('id, category_id, active')
    .eq('company_id', companyId)
  if (readError) return { error: describeError(readError) }

  for (const row of existing ?? []) {
    const should = selected.has(row.category_id)
    if (should === row.active) continue
    const { error } = await supabase.from('company_gastronomic_categories').update({ active: should }).eq('id', row.id)
    if (error) return { error: describeError(error) }
    selected.delete(row.category_id)
  }

  for (const categoryId of selected) {
    const { error } = await supabase.from('company_gastronomic_categories').insert({
      company_id: companyId,
      category_id: categoryId,
      business_space_id: session.spaceId,
      active: true,
    })
    if (error) return { error: describeError(error) }
  }

  revalidatePath('/empresas')
  revalidatePath(`/empresas/${companyId}`)
  return { error: '' }
}
