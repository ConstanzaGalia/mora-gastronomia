'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { describeError } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'
import { missingChoiceError } from '@/lib/menu'
import type { Json } from '@/lib/database.types'

function choicesBack(fecha: string) {
  return `/elecciones?fecha=${fecha}`
}

function extrasBack(fecha: string, companyId?: string) {
  if (companyId) return `/pedidos-empresa?fecha=${fecha}&empresa=${companyId}`
  return `/elecciones?fecha=${fecha}`
}

export async function saveEmployeeChoice(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN'])
  const fecha = String(formData.get('fecha') ?? '')
  const membershipId = String(formData.get('membership_id') ?? '')
  const calendarDayId = String(formData.get('calendar_day_id') ?? '')
  const items = formData.getAll('item').map((value) => {
    const [categoryId, optionId] = String(value).split('|')
    return { category_id: categoryId, option_id: optionId }
  }).filter((item) => item.category_id && item.option_id)

  const required = formData.getAll('required_category').map(String).filter(Boolean)
  const chosen = new Set(items.map((item) => item.category_id))
  if (items.length === 0 || required.some((categoryId) => !chosen.has(categoryId))) {
    redirectWithError(
      choicesBack(fecha),
      missingChoiceError(formData.getAll('required_name').map(String), formData.getAll('optional_name').map(String)),
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_employee_choice', {
    p_membership_id: membershipId,
    p_calendar_day_id: calendarDayId,
    p_items: items as Json,
  })
  if (error) redirectWithError(choicesBack(fecha), describeError(error))
  revalidatePath('/elecciones')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  revalidatePath('/balance')
  redirect(choicesBack(fecha))
}

export async function saveCompanyExtras(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'])
  const fecha = String(formData.get('fecha') ?? '')
  const calendarDayId = String(formData.get('calendar_day_id') ?? '')
  const requestedCompanyId = String(formData.get('company_id') ?? '').trim()
  const isSpaceAdmin = session.primary.role === 'ORG_ADMIN' || session.primary.role === 'SPACE_ADMIN'
  if (isSpaceAdmin && !requestedCompanyId) {
    redirectWithError(extrasBack(fecha), 'Elegí la empresa del pedido.')
  }
  if (!isSpaceAdmin && requestedCompanyId) {
    redirectWithError(choicesBack(fecha), 'No tenés permiso para cargar el pedido de otra empresa.')
  }

  const companyId = isSpaceAdmin ? requestedCompanyId : undefined
  const back = extrasBack(fecha, companyId)
  const options = formData.getAll('option').map(String)
  const quantities = formData.getAll('quantity').map(String)
  const items = options.flatMap((option, index) => {
    const [categoryId, optionId] = option.split('|')
    const quantity = Number(String(quantities[index] ?? '').replace(',', '.'))
    if (!categoryId || !optionId || !Number.isInteger(quantity) || quantity < 0) return []
    return [{ category_id: categoryId, option_id: optionId, quantity }]
  })

  const supabase = await createClient()
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .eq('business_space_id', session.spaceId)
      .maybeSingle()
    if (!company) redirectWithError(back, 'No encontramos esa empresa.')
  }

  const { error } = await supabase.rpc('save_company_extras', {
    p_calendar_day_id: calendarDayId,
    p_items: items as Json,
    ...(companyId ? { p_company_id: companyId } : {}),
  })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/elecciones')
  revalidatePath('/pedidos-empresa')
  revalidatePath('/comensales')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  revalidatePath('/balance')
  redirect(back)
}
