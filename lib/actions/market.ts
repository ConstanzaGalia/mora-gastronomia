'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { businessToday, describeError, digits, parseAmount } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'
import { loadMarketDay, splitMarketMenu } from '@/lib/market'
import type { MarketOrderStatus, MarketPayment } from '@/lib/market'

const PAYMENTS: MarketPayment[] = ['EFECTIVO', 'TRANSFERENCIA']
const STATUSES: MarketOrderStatus[] = ['RECIBIDO', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO']

async function requireMarketAdmin() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN'])
  assertViandasSpace(session)
  return session
}

export async function placeMarketOrder(_prev: { error: string }, formData: FormData) {
  const name = String(formData.get('customer_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const payment = String(formData.get('payment_method') ?? '') as MarketPayment
  const serviceDate = String(formData.get('service_date') ?? '')

  if (name.length < 2) return { error: 'Poné tu nombre.' }
  if (digits(phone).length < 8) return { error: 'Poné un teléfono para coordinar el envío.' }
  if (address.length < 6) return { error: 'Poné la dirección de entrega.' }
  if (!PAYMENTS.includes(payment)) return { error: 'Elegí si pagás en efectivo o por transferencia.' }

  const open = await loadMarketDay()
  if (!open) return { error: 'El mercadito no está disponible.' }
  if (!open.settings.enabled) return { error: 'Por ahora no estamos tomando pedidos por este canal.' }

  let catalog = open
  if (serviceDate && serviceDate !== open.serviceDate) {
    if (serviceDate < businessToday()) return { error: 'El menú de ese día ya no está disponible. Recargá la página.' }
    const day = await loadMarketDay(serviceDate)
    if (!day?.published || !day.serviceDate) return { error: 'El menú de ese día ya no está disponible. Recargá la página.' }
    catalog = day
  }
  if (!catalog.published || !catalog.serviceDate) return { error: 'Ahora no hay un menú abierto para pedir.' }
  if (!catalog.open) return { error: 'Los pedidos de ese día están cerrados. Escribinos por WhatsApp si necesitás algo.' }
  const unitPrice = catalog.settings.unitPrice
  if (unitPrice == null || unitPrice <= 0) return { error: 'Todavía no se puede tomar el pedido. Escribinos por WhatsApp.' }

  const { trays } = splitMarketMenu(catalog.groups)
  if (!trays?.options.length) return { error: 'Ese día no hay bandejas publicadas para pedir.' }

  const items: { optionId: string; categoryName: string; optionName: string; quantity: number; unitPrice: number; amount: number }[] = []
  let trayQty = 0
  for (const option of trays.options) {
    const quantity = Math.floor(Number(formData.get(`qty_${option.id}`) ?? 0))
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (quantity > 20) return { error: 'Podés pedir hasta 20 unidades de cada bandeja.' }
    trayQty += quantity
    items.push({
      optionId: option.id,
      categoryName: trays.name,
      optionName: option.name,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
    })
  }
  if (trayQty === 0) return { error: 'Elegí al menos una bandeja y la cantidad.' }

  const total = trayQty * unitPrice
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('market_orders')
    .insert({
      business_space_id: catalog.spaceId,
      service_date: catalog.serviceDate,
      customer_name: name,
      phone,
      address,
      payment_method: payment,
      notes: notes || null,
      total,
    })
    .select('id')
    .single()
  if (error || !order) return { error: describeError(error) }

  const { error: itemsError } = await admin.from('market_order_items').insert(
    items.map((item, index) => ({
      order_id: order.id,
      business_space_id: catalog.spaceId,
      option_id: item.optionId,
      category_name: item.categoryName,
      option_name: item.optionName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: item.amount,
      sort_order: index,
    })),
  )
  if (itemsError) {
    await admin.from('market_orders').delete().eq('id', order.id)
    return { error: describeError(itemsError) }
  }

  revalidatePath('/pedidos')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
  redirect(`/mercadito/pedido/${order.id}`)
}

export async function saveMarketSettings(formData: FormData) {
  const session = await requireMarketAdmin()
  const unitPrice = parseAmount(String(formData.get('unit_price') ?? ''))
  if (unitPrice == null || unitPrice <= 0) redirectWithError('/pedidos', 'Poné el precio de la bandeja (con envío).')

  const supabase = await createClient()
  const payload = {
    business_space_id: session.spaceId,
    enabled: formData.get('enabled') === 'true',
    unit_price: unitPrice,
    whatsapp: digits(String(formData.get('whatsapp') ?? '')) || null,
    transfer_holder: String(formData.get('transfer_holder') ?? '').trim() || null,
    transfer_alias: String(formData.get('transfer_alias') ?? '').trim() || null,
    transfer_cbu: String(formData.get('transfer_cbu') ?? '').trim() || null,
    transfer_bank: String(formData.get('transfer_bank') ?? '').trim() || null,
    delivery_note: String(formData.get('delivery_note') ?? '').trim() || null,
  }
  const { error } = await supabase.from('market_settings').upsert(payload, { onConflict: 'business_space_id' })
  if (error) redirectWithError('/pedidos', describeError(error))
  revalidatePath('/pedidos')
  revalidatePath('/mercadito')
}

export async function setMarketDayState(formData: FormData) {
  const session = await requireMarketAdmin()
  const date = String(formData.get('fecha') ?? '')
  const state = String(formData.get('estado') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['ABIERTO', 'CERRADO'].includes(state)) return

  const supabase = await createClient()
  // Abierto es lo normal: reabrir borra la decisión de cerrar.
  const { error } = state === 'ABIERTO'
    ? await supabase.from('market_days').delete().eq('business_space_id', session.spaceId).eq('service_date', date)
    : await supabase.from('market_days').upsert(
        { business_space_id: session.spaceId, service_date: date, state },
        { onConflict: 'business_space_id,service_date' },
      )
  if (error) redirectWithError('/pedidos', describeError(error))
  revalidatePath('/pedidos')
  revalidatePath('/mercadito')
}

export async function setMarketOrderStatus(formData: FormData) {
  const session = await requireMarketAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '') as MarketOrderStatus
  if (!id || !STATUSES.includes(status)) return
  const supabase = await createClient()
  const { error } = await supabase
    .from('market_orders')
    .update({ status })
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
  if (error) redirectWithError('/pedidos', describeError(error))
  revalidatePath('/pedidos')
  revalidatePath('/reportes')
  revalidatePath('/inicio')
}

export async function setMarketOrderPaid(formData: FormData) {
  const session = await requireMarketAdmin()
  const id = String(formData.get('id') ?? '')
  const paid = formData.get('paid') === 'true'
  if (!id) return
  const supabase = await createClient()
  const { error } = await supabase
    .from('market_orders')
    .update({ paid })
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .neq('status', 'CANCELADO')
  if (error) redirectWithError('/pedidos', describeError(error))
  revalidatePath('/pedidos')
}
