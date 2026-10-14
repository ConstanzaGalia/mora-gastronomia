'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/session'
import { describeError } from '@/lib/format'
import type { Json } from '@/lib/database.types'

export async function saveSelection(_prev: { error: string }, formData: FormData) {
  await requireSession()
  const calendarDayId = String(formData.get('calendar_day_id') ?? '')
  const required = formData.getAll('required_category').map(String).filter(Boolean)
  const items = formData.getAll('item').map((value) => {
    const [categoryId, optionId] = String(value).split('|')
    return { category_id: categoryId, option_id: optionId }
  }).filter((item) => item.category_id && item.option_id)

  const chosen = new Set(items.map((item) => item.category_id))
  if (items.length === 0 || required.some((categoryId) => !chosen.has(categoryId))) {
    return { error: 'Elegí bandeja y bebida. Postre y pan podés saltearlos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_my_selection', {
    p_calendar_day_id: calendarDayId,
    p_items: items as Json,
  })
  if (error) return { error: describeError(error) }
  revalidatePath('/mi-menu')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  return { error: '' }
}

export async function cancelSelection(formData: FormData) {
  await requireSession()
  const selectionId = String(formData.get('selection_id') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_my_selection', { p_selection_id: selectionId })
  if (error) return
  revalidatePath('/mi-menu')
  revalidatePath('/reportes')
}
