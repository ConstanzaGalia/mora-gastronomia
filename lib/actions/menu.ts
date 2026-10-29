'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { describeError } from '@/lib/format'
import { missingChoiceError } from '@/lib/menu'
import type { Json } from '@/lib/database.types'

export async function saveSelection(_prev: { error: string; saved?: boolean }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['EMPLOYEE', 'COMPANY_ADMIN'])
  const calendarDayId = String(formData.get('calendar_day_id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const required = formData.getAll('required_category').map(String).filter(Boolean)
  const items = formData.getAll('item').map((value) => {
    const [categoryId, optionId] = String(value).split('|')
    return { category_id: categoryId, option_id: optionId }
  }).filter((item) => item.category_id && item.option_id)

  const chosen = new Set(items.map((item) => item.category_id))
  if (items.length === 0 || required.some((categoryId) => !chosen.has(categoryId))) {
    return {
      error: missingChoiceError(
        formData.getAll('required_name').map(String),
        formData.getAll('optional_name').map(String),
      ),
      saved: false,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_my_selection', {
    p_calendar_day_id: calendarDayId,
    p_items: items as Json,
    ...(companyId ? { p_company_id: companyId } : {}),
  })
  if (error) return { error: describeError(error), saved: false }
  revalidatePath('/mi-menu')
  revalidatePath('/elecciones')
  revalidatePath('/comensales')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  revalidatePath('/empresas', 'layout')
  return { error: '', saved: true }
}

export async function cancelSelection(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['EMPLOYEE', 'COMPANY_ADMIN'])
  const selectionId = String(formData.get('selection_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_my_selection', { p_selection_id: selectionId })
  if (error) return
  revalidatePath('/mi-menu')
  revalidatePath('/elecciones')
  revalidatePath('/comensales')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  revalidatePath('/empresas', 'layout')
}
