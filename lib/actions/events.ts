'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertEventosSpace, assertRole, requireSession } from '@/lib/session'
import { describeError, parseAmount } from '@/lib/format'
import { redirectWithError, sameOriginPath } from '@/lib/redirect-error'
import type { EventStatus, PaymentMethod } from '@/lib/events'

const STATUSES: EventStatus[] = ['BORRADOR', 'CONFIRMADO', 'REALIZADO', 'CANCELADO']
const METHODS: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'ECHEQ']

async function requireEventosAdmin() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertEventosSpace(session)
  return session
}

function readDate(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function readTime(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : null
}

function readStatus(raw: FormDataEntryValue | null): EventStatus | null {
  const value = String(raw ?? '')
  return STATUSES.includes(value as EventStatus) ? value as EventStatus : null
}

function readMethod(raw: FormDataEntryValue | null): PaymentMethod | null {
  const value = String(raw ?? '')
  return METHODS.includes(value as PaymentMethod) ? value as PaymentMethod : null
}

function readGuests(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (!/^\d+$/.test(value)) return undefined
  return Number(value)
}

function refresh(eventId?: string) {
  revalidatePath('/inicio')
  revalidatePath('/eventos')
  if (eventId) revalidatePath(`/eventos/${eventId}`)
}

export async function saveEvent(formData: FormData) {
  const session = await requireEventosAdmin()
  const id = String(formData.get('id') ?? '')
  const back = sameOriginPath(formData.get('from'), id ? `/eventos/${id}` : '/eventos')
  const name = String(formData.get('name') ?? '').trim()
  const clientName = String(formData.get('client_name') ?? '').trim()
  const clientPhone = String(formData.get('client_phone') ?? '').trim()
  const clientEmail = String(formData.get('client_email') ?? '').trim()
  const eventOn = readDate(formData.get('event_on'))
  const eventTime = readTime(formData.get('event_time'))
  const venue = String(formData.get('venue') ?? '').trim()
  const guests = readGuests(formData.get('guest_count'))
  const notes = String(formData.get('notes') ?? '').trim()
  const quoted = parseAmount(String(formData.get('quoted_amount') ?? ''))
  const status = readStatus(formData.get('status')) ?? 'BORRADOR'

  if (!name) redirectWithError(back, 'El nombre del evento es obligatorio.')
  if (!clientName) redirectWithError(back, 'El cliente es obligatorio.')
  if (!eventOn) redirectWithError(back, 'La fecha del evento no es válida.')
  if (guests === undefined) redirectWithError(back, 'La cantidad de invitados tiene que ser un número entero.')
  if (quoted == null) redirectWithError(back, 'El monto acordado tiene que ser un número mayor o igual a cero.')

  const supabase = await createClient()
  const payload = {
    business_space_id: session.spaceId,
    name,
    client_name: clientName,
    client_phone: clientPhone || null,
    client_email: clientEmail || null,
    event_on: eventOn,
    event_time: eventTime,
    venue: venue || null,
    guest_count: guests,
    notes: notes || null,
    quoted_amount: quoted,
    status,
  }

  if (id) {
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)
      .eq('business_space_id', session.spaceId)
      .select('id')
    if (error) redirectWithError(back, describeError(error))
    if (!data?.length) redirectWithError(back, 'No encontramos ese evento.')
    refresh(id)
    redirect(`/eventos/${id}`)
  }

  const { data, error } = await supabase.from('events').insert(payload).select('id').single()
  if (error || !data) redirectWithError(back, describeError(error))
  refresh(data.id)
  redirect(`/eventos/${data.id}`)
}

export async function deleteEvent(formData: FormData) {
  const session = await requireEventosAdmin()
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('events').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError('/eventos', describeError(error))
  if (!data?.length) redirectWithError('/eventos', 'No encontramos ese evento.')
  refresh(id)
  redirect('/eventos')
}

export async function saveEventExpense(formData: FormData) {
  const session = await requireEventosAdmin()
  const eventId = String(formData.get('event_id') ?? '')
  const back = `/eventos/${eventId}`
  const spentOn = readDate(formData.get('spent_on'))
  const concept = String(formData.get('concept') ?? '').trim()
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  if (!spentOn) redirectWithError(back, 'La fecha del gasto no es válida.')
  if (!concept) redirectWithError(back, 'El concepto es obligatorio.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El gasto tiene que ser mayor a cero.')

  const supabase = await createClient()
  const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('business_space_id', session.spaceId).maybeSingle()
  if (!event) redirectWithError(back, 'No encontramos ese evento.')

  const { error } = await supabase.from('event_expenses').insert({
    event_id: eventId,
    business_space_id: session.spaceId,
    spent_on: spentOn,
    concept,
    amount,
  })
  if (error) redirectWithError(back, describeError(error))
  refresh(eventId)
}

export async function deleteEventExpense(formData: FormData) {
  const session = await requireEventosAdmin()
  const id = String(formData.get('id') ?? '')
  const eventId = String(formData.get('event_id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('event_expenses').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(`/eventos/${eventId}`, describeError(error))
  if (!data?.length) redirectWithError(`/eventos/${eventId}`, 'No encontramos ese gasto.')
  refresh(eventId)
}

export async function saveEventPayment(formData: FormData) {
  const session = await requireEventosAdmin()
  const eventId = String(formData.get('event_id') ?? '')
  const back = `/eventos/${eventId}`
  const paidOn = readDate(formData.get('paid_on'))
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  const method = readMethod(formData.get('method'))
  const note = String(formData.get('note') ?? '').trim()
  if (!paidOn) redirectWithError(back, 'La fecha del cobro no es válida.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El cobro tiene que ser mayor a cero.')
  if (!method) redirectWithError(back, 'Elegí un medio de pago.')

  const supabase = await createClient()
  const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('business_space_id', session.spaceId).maybeSingle()
  if (!event) redirectWithError(back, 'No encontramos ese evento.')

  const { error } = await supabase.from('event_payments').insert({
    event_id: eventId,
    business_space_id: session.spaceId,
    paid_on: paidOn,
    amount,
    method,
    note: note || null,
  })
  if (error) redirectWithError(back, describeError(error))
  refresh(eventId)
}

export async function deleteEventPayment(formData: FormData) {
  const session = await requireEventosAdmin()
  const id = String(formData.get('id') ?? '')
  const eventId = String(formData.get('event_id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('event_payments').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(`/eventos/${eventId}`, describeError(error))
  if (!data?.length) redirectWithError(`/eventos/${eventId}`, 'No encontramos ese cobro.')
  refresh(eventId)
}
