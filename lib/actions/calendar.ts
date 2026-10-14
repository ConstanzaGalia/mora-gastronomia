'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { addDays, describeError } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'

export async function createWeek(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const weekStart = String(formData.get('week_start') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Elegí el lunes de la semana.' }

  const supabase = await createClient()
  const { data: week, error } = await supabase
    .from('calendar_weeks')
    .insert({
      business_space_id: session.spaceId,
      week_start: weekStart,
      week_end: addDays(weekStart, 4),
      status: 'DRAFT',
    })
    .select('id')
    .single()
  if (error) return { error: describeError(error) }

  const days = [0, 1, 2, 3, 4].map((offset) => ({
    calendar_week_id: week.id,
    business_space_id: session.spaceId,
    service_date: addDays(weekStart, offset),
    is_service_day: true,
  }))
  const { error: daysError } = await supabase.from('calendar_days').insert(days)
  if (daysError) return { error: describeError(daysError) }

  revalidatePath('/calendario')
  redirect(`/calendario/${week.id}`)
}

export async function setServiceDay(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const supabase = await createClient()
  const weekId = String(formData.get('week_id') ?? '')
  await supabase
    .from('calendar_days')
    .update({ is_service_day: formData.get('is_service_day') === 'true' })
    .eq('id', String(formData.get('day_id')))
  revalidatePath(`/calendario/${weekId}`)
}

type SaveState = { error: string; saved: boolean; slots: string[] }

export async function saveAvailability(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const weekId = String(formData.get('week_id') ?? '')
  const wanted = new Map<string, { dayId: string; categoryId: string; optionId: string }>()
  for (const value of formData.getAll('slot')) {
    const [dayId, categoryId, optionId] = String(value).split('|')
    if (!dayId || !categoryId || !optionId) continue
    wanted.set(`${dayId}|${optionId}`, { dayId, categoryId, optionId })
  }

  const supabase = await createClient()
  const { data: days, error: daysError } = await supabase
    .from('calendar_days')
    .select('id, is_service_day')
    .eq('calendar_week_id', weekId)
    .eq('business_space_id', session.spaceId)
  if (daysError) return { error: describeError(daysError), saved: false, slots: [] }
  if (!days?.length) return { error: 'No encontramos los días de esa semana.', saved: false, slots: [] }

  const serviceDayIds = new Set(days.filter((day) => day.is_service_day).map((day) => day.id))
  for (const key of [...wanted.keys()]) {
    if (!serviceDayIds.has(key.slice(0, key.indexOf('|')))) wanted.delete(key)
  }

  const { data: current, error: readError } = await supabase
    .from('daily_availability')
    .select('id, calendar_day_id, option_id')
    .in('calendar_day_id', days.map((day) => day.id))
  if (readError) return { error: describeError(readError), saved: false, slots: [] }

  const fail = (error: { message?: string; details?: string | null }): SaveState => {
    revalidatePath(`/calendario/${weekId}`)
    return { error: describeError(error), saved: false, slots: [] }
  }

  for (const row of current ?? []) {
    if (!serviceDayIds.has(row.calendar_day_id)) continue
    if (wanted.has(`${row.calendar_day_id}|${row.option_id}`)) continue
    const { error } = await supabase.from('daily_availability').delete().eq('id', row.id)
    if (error) return fail(error)
  }

  const existing = new Set((current ?? []).map((row) => `${row.calendar_day_id}|${row.option_id}`))
  for (const [key, slot] of wanted) {
    if (existing.has(key)) continue
    const { error } = await supabase.from('daily_availability').insert({
      calendar_day_id: slot.dayId,
      business_space_id: session.spaceId,
      category_id: slot.categoryId,
      option_id: slot.optionId,
    })
    if (error) return fail(error)
  }

  revalidatePath(`/calendario/${weekId}`)
  revalidatePath('/calendario')
  return { error: '', saved: true, slots: [...wanted.keys()] }
}

export async function deleteWeek(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const weekId = String(formData.get('week_id') ?? '')
  const supabase = await createClient()
  const { data: week } = await supabase
    .from('calendar_weeks')
    .select('id, status')
    .eq('id', weekId)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!week) redirectWithError('/calendario', 'No encontramos esa semana.')
  if (week.status !== 'DRAFT') redirectWithError('/calendario', 'Solo se pueden eliminar semanas en borrador.')

  const { data: days } = await supabase.from('calendar_days').select('id').eq('calendar_week_id', weekId)
  const dayIds = (days ?? []).map((day) => day.id)
  if (dayIds.length > 0) {
    const { count } = await supabase
      .from('employee_selections')
      .select('id', { count: 'exact', head: true })
      .in('calendar_day_id', dayIds)
    if (count) redirectWithError('/calendario', 'No se puede eliminar: esa semana ya tiene elecciones.')
    const { error: extensionError } = await supabase.from('day_company_extensions').delete().in('calendar_day_id', dayIds)
    if (extensionError) redirectWithError('/calendario', describeError(extensionError))
    const { error: extrasError } = await supabase.from('company_day_extras').delete().in('calendar_day_id', dayIds)
    if (extrasError) redirectWithError('/calendario', describeError(extrasError))
    const { error: availabilityError } = await supabase.from('daily_availability').delete().in('calendar_day_id', dayIds)
    if (availabilityError) redirectWithError('/calendario', describeError(availabilityError))
    const { error: daysError } = await supabase.from('calendar_days').delete().in('id', dayIds)
    if (daysError) redirectWithError('/calendario', describeError(daysError))
  }

  const { error } = await supabase.from('calendar_weeks').delete().eq('id', weekId)
  if (error) redirectWithError('/calendario', describeError(error))
  revalidatePath('/calendario')
  revalidatePath('/inicio')
}

export async function saveExtensions(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const weekId = String(formData.get('week_id') ?? '')
  const supabase = await createClient()
  const { data: days } = await supabase
    .from('calendar_days')
    .select('id, is_service_day')
    .eq('calendar_week_id', weekId)
    .eq('business_space_id', session.spaceId)
  const serviceIds = new Set((days ?? []).filter((day) => day.is_service_day).map((day) => day.id))
  if (serviceIds.size === 0) redirectWithError(`/calendario/${weekId}`, 'No hay días de servicio en esa semana.')

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('business_space_id', session.spaceId)
    .eq('active', true)
  const companyIds = new Set((companies ?? []).map((company) => company.id))
  const wanted = formData.getAll('extension').flatMap((value) => {
    const [dayId, companyId] = String(value).split('|')
    if (!serviceIds.has(dayId) || !companyIds.has(companyId)) return []
    return [{ calendar_day_id: dayId, company_id: companyId, business_space_id: session.spaceId }]
  })

  const { error: deleteError } = await supabase.from('day_company_extensions').delete().in('calendar_day_id', [...serviceIds])
  if (deleteError) redirectWithError(`/calendario/${weekId}`, describeError(deleteError))
  if (wanted.length > 0) {
    const { error } = await supabase.from('day_company_extensions').insert(wanted)
    if (error) redirectWithError(`/calendario/${weekId}`, describeError(error))
  }
  revalidatePath(`/calendario/${weekId}`)
  revalidatePath('/mi-menu')
  revalidatePath('/elecciones')
}

export async function setWeekStatus(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const weekId = String(formData.get('week_id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (status !== 'DRAFT' && status !== 'PUBLISHED') return
  const supabase = await createClient()
  const { error } = await supabase.from('calendar_weeks').update({ status }).eq('id', weekId)
  if (error) {
    redirect(`/calendario/${weekId}?error=${encodeURIComponent(describeError(error))}`)
  }
  revalidatePath(`/calendario/${weekId}`)
  revalidatePath('/calendario')
  revalidatePath('/inicio')
}
