'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { describeError, digits, parseAmount } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'
import { loadMarketDay } from '@/lib/market'
import type { MarketOrderStatus, MarketPayment } from '@/lib/market'

const PAYMENTS: MarketPayment[] = ['EFECTIVO', 'TRANSFERENCIA']
const STATUSES: MarketOrderStatus[] = ['NUEVO', 'LISTO', 'CANCELADO']

async function requireMarketAdmin() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
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

  const catalog = await loadMarketDay()
  if (serviceDate && serviceDate !== catalog?.serviceDate) {
    return { error: 'El menú de ese día ya no está disponible. Recargá la página.' }
  }
  if (!catalog?.published) return { error: 'Hoy no hay un menú publicado para pedir.' }
  if (!catalog.settings.enabled) return { error: 'Por ahora no estamos tomando pedidos por este canal.' }
  const unitPrice = catalog.settings.unitPrice
  if (unitPrice == null || unitPrice <= 0) return { error: 'Todavía no se puede confirmar el pedido. Escribinos por WhatsApp.' }

  const allowed = new Map(
    catalog.groups.flatMap((group) => group.options.map((option) => [option.id, { group, option }])),
  )
  const items: { optionId: string; categoryName: string; optionName: string; quantity: number; unitPrice: number; amount: number }[] = []
  for (const [optionId, entry] of allowed) {
    const quantity = Math.floor(Number(formData.get(`qty_${optionId}`) ?? 0))
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (quantity > 20) return { error: 'Podés pedir hasta 20 unidades de cada opción.' }
    items.push({
      optionId,
      categoryName: entry.group.name,
      optionName: entry.option.name,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
    })
  }
  if (items.length === 0) return { error: 'Elegí al menos una opción y la cantidad.' }

  const total = items.reduce((sum, item) => sum + item.amount, 0)
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
  redirect(`/mercadito/pedido/${order.id}`)
}

export async function saveMarketSettings(formData: FormData) {
  const session = await requireMarketAdmin()
  const unitPrice = parseAmount(String(formData.get('unit_price') ?? ''))
  if (unitPrice == null || unitPrice <= 0) redirectWithError('/pedidos', 'Poné el precio por unidad del mercadito.')

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
}
