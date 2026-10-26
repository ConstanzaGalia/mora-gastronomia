'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertRole, requireSession } from '@/lib/session'
import { balanceHref, type BalanceSection } from '@/lib/balance'
import { currentMonth, describeError, parseAmount } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'

function balancePath(formData: FormData) {
  const year = String(formData.get('anio') ?? '')
  const month = String(formData.get('mes') ?? '')
  const section = String(formData.get('seccion') ?? '')
  const company = String(formData.get('empresa') ?? '')
  const sections: BalanceSection[] = ['empresas', 'gastos', 'proveedores', 'echeqs', 'fijos']
  return balanceHref({
    vista: formData.get('vista') === 'anio' && /^\d{4}$/.test(year) ? 'anio' : 'mes',
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : currentMonth(),
    year: /^\d{4}$/.test(year) ? year : currentMonth().slice(0, 4),
    seccion: sections.includes(section as BalanceSection) ? section as BalanceSection : undefined,
    empresa: /^[0-9a-f-]{36}$/i.test(company) ? company : undefined,
  })
}

function readDate(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

async function companyInSpace(companyId: string, spaceId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('id').eq('id', companyId).eq('business_space_id', spaceId).maybeSingle()
  return Boolean(data)
}

export async function setTrayPrice(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const companyId = String(formData.get('company_id') ?? '')
  const effectiveFrom = readDate(formData.get('effective_from'))
  const unitPrice = parseAmount(String(formData.get('unit_price') ?? ''))
  if (!effectiveFrom) redirectWithError(back, 'La fecha del precio no es válida.')
  if (unitPrice == null) redirectWithError(back, 'El precio tiene que ser un número mayor o igual a cero, con hasta dos decimales.')
  if (!(await companyInSpace(companyId, session.spaceId))) redirectWithError(back, 'No encontramos esa empresa.')

  const supabase = await createClient()
  const { error } = await supabase.from('company_tray_prices').upsert({
    company_id: companyId,
    business_space_id: session.spaceId,
    unit_price: unitPrice,
    effective_from: effectiveFrom,
  }, { onConflict: 'company_id,effective_from' })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
}

export async function deleteTrayPrice(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_tray_prices').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese precio.')
  revalidatePath('/balance')
}

export async function savePayment(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const companyId = String(formData.get('company_id') ?? '')
  const paidOn = readDate(formData.get('paid_on'))
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  const note = String(formData.get('note') ?? '').trim()
  if (!paidOn) redirectWithError(back, 'La fecha del pago no es válida.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El pago tiene que ser mayor a cero.')
  if (!(await companyInSpace(companyId, session.spaceId))) redirectWithError(back, 'No encontramos esa empresa.')

  const supabase = await createClient()
  const payload = {
    company_id: companyId,
    business_space_id: session.spaceId,
    paid_on: paidOn,
    amount,
    note: note || null,
  }
  const query = id
    ? supabase.from('company_payments').update(payload).eq('id', id).eq('business_space_id', session.spaceId)
    : supabase.from('company_payments').insert(payload)
  const { data, error } = await query.select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese pago.')
  revalidatePath('/balance')
}

export async function deletePayment(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_payments').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese pago.')
  revalidatePath('/balance')
}

export async function saveExpense(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const spentOn = readDate(formData.get('spent_on'))
  const concept = String(formData.get('concept') ?? '').trim()
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  if (!spentOn) redirectWithError(back, 'La fecha del gasto no es válida.')
  if (!concept) redirectWithError(back, 'El concepto del gasto es obligatorio.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El gasto tiene que ser mayor a cero.')

  const supabase = await createClient()
  const payload = { business_space_id: session.spaceId, spent_on: spentOn, concept, amount }
  const query = id
    ? supabase.from('space_expenses').update(payload).eq('id', id).eq('business_space_id', session.spaceId)
    : supabase.from('space_expenses').insert(payload)
  const { data, error } = await query.select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese gasto.')
  revalidatePath('/balance')
}

export async function deleteExpense(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('space_expenses').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese gasto.')
  revalidatePath('/balance')
}

export async function saveCharge(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const companyId = String(formData.get('company_id') ?? '')
  const chargedOn = readDate(formData.get('charged_on'))
  const concept = String(formData.get('concept') ?? '').trim()
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  if (!chargedOn) redirectWithError(back, 'La fecha del cargo no es válida.')
  if (!concept) redirectWithError(back, 'El concepto del cargo es obligatorio.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El cargo tiene que ser mayor a cero.')
  if (!(await companyInSpace(companyId, session.spaceId))) redirectWithError(back, 'No encontramos esa empresa.')

  const supabase = await createClient()
  const { error } = await supabase.from('company_charges').insert({
    company_id: companyId,
    business_space_id: session.spaceId,
    charged_on: chargedOn,
    concept,
    amount,
  })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
}

export async function deleteCharge(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_charges').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese cargo.')
  revalidatePath('/balance')
}

export async function saveSupplier(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirectWithError(back, 'El nombre del proveedor es obligatorio.')
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').insert({ business_space_id: session.spaceId, name })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
}

export async function deleteSupplier(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('suppliers').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese proveedor.')
  revalidatePath('/balance')
}

export async function saveSupplierPayment(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const supplierId = String(formData.get('supplier_id') ?? '')
  const paidOn = readDate(formData.get('paid_on'))
  const concept = String(formData.get('concept') ?? '').trim()
  const amount = parseAmount(String(formData.get('amount') ?? ''))
  const method = String(formData.get('method') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!paidOn) redirectWithError(back, 'La fecha del pago no es válida.')
  if (!concept) redirectWithError(back, 'El concepto del pago es obligatorio.')
  if (amount == null || amount <= 0) redirectWithError(back, 'El pago tiene que ser mayor a cero.')
  if (method !== 'EFECTIVO' && method !== 'TRANSFERENCIA' && method !== 'ECHEQ') redirectWithError(back, 'Elegí el medio de pago.')
  if (status !== 'PENDIENTE' && status !== 'PAGADO') redirectWithError(back, 'Elegí si el pago está pendiente o pagado.')

  const echeqNumber = method === 'ECHEQ' ? String(formData.get('echeq_number') ?? '').trim() : ''
  const echeqDate = method === 'ECHEQ' ? readDate(formData.get('echeq_date')) : null
  if (method === 'ECHEQ' && (!echeqNumber || !echeqDate)) redirectWithError(back, 'El eCheq necesita número y vencimiento.')

  const supabase = await createClient()
  const { data: supplier } = await supabase.from('suppliers').select('id').eq('id', supplierId).eq('business_space_id', session.spaceId).maybeSingle()
  if (!supplier) redirectWithError(back, 'No encontramos ese proveedor.')
  const { error } = await supabase.from('supplier_payments').insert({
    supplier_id: supplierId,
    business_space_id: session.spaceId,
    paid_on: paidOn,
    concept,
    amount,
    method,
    status,
    echeq_number: method === 'ECHEQ' ? echeqNumber : null,
    echeq_date: method === 'ECHEQ' ? echeqDate : null,
  })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
  revalidatePath('/inicio')
}

export async function setSupplierPaymentStatus(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (status !== 'PENDIENTE' && status !== 'PAGADO') redirectWithError(back, 'Elegí si el pago está pendiente o pagado.')
  const supabase = await createClient()
  const { data, error } = await supabase.from('supplier_payments').update({ status }).eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese pago.')
  revalidatePath('/balance')
  revalidatePath('/inicio')
}

export async function deleteSupplierPayment(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.from('supplier_payments').delete().eq('id', id).eq('business_space_id', session.spaceId).select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese pago.')
  revalidatePath('/balance')
  revalidatePath('/inicio')
}

export async function saveFixedExpense(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirectWithError(back, 'El nombre del gasto fijo es obligatorio.')
  const supabase = await createClient()
  const { data: last } = await supabase.from('fixed_expenses').select('sort_order').eq('business_space_id', session.spaceId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('fixed_expenses').insert({
    business_space_id: session.spaceId,
    name,
    sort_order: (last?.sort_order ?? 0) + 10,
  })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
}

export async function removeFixedExpense(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { count } = await supabase.from('fixed_expense_months').select('id', { count: 'exact', head: true }).eq('fixed_expense_id', id).eq('business_space_id', session.spaceId)
  const query = count
    ? supabase.from('fixed_expenses').update({ active: false }).eq('id', id).eq('business_space_id', session.spaceId)
    : supabase.from('fixed_expenses').delete().eq('id', id).eq('business_space_id', session.spaceId)
  const { data, error } = await query.select('id')
  if (error) redirectWithError(back, describeError(error))
  if (!data?.length) redirectWithError(back, 'No encontramos ese gasto fijo.')
  revalidatePath('/balance')
}

export async function saveFixedMonth(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const back = balancePath(formData)
  const expenseId = String(formData.get('fixed_expense_id') ?? '')
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  const status = String(formData.get('status') ?? '')
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    redirectWithError(back, 'El mes del gasto fijo no es válido.')
  }
  if (status !== 'PENDIENTE' && status !== 'PAGADO' && status !== 'NO_APLICA') redirectWithError(back, 'El estado del mes no es válido.')

  const supabase = await createClient()
  const { data: expense } = await supabase.from('fixed_expenses').select('id').eq('id', expenseId).eq('business_space_id', session.spaceId).maybeSingle()
  if (!expense) redirectWithError(back, 'No encontramos ese gasto fijo.')

  if (status === 'PENDIENTE') {
    const { error } = await supabase.from('fixed_expense_months').delete().eq('fixed_expense_id', expenseId).eq('business_space_id', session.spaceId).eq('year', year).eq('month', month)
    if (error) redirectWithError(back, describeError(error))
    revalidatePath('/balance')
    return
  }

  const amount = status === 'PAGADO' ? parseAmount(String(formData.get('amount') ?? '')) : null
  if (status === 'PAGADO' && (amount == null || amount <= 0)) redirectWithError(back, 'El gasto pagado tiene que ser mayor a cero.')
  const { error } = await supabase.from('fixed_expense_months').upsert({
    fixed_expense_id: expenseId,
    business_space_id: session.spaceId,
    year,
    month,
    status,
    amount,
  }, { onConflict: 'fixed_expense_id,year,month' })
  if (error) redirectWithError(back, describeError(error))
  revalidatePath('/balance')
}
