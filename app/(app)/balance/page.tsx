import { BalanceFilters } from '@/components/balance-filters'
import { BalanceReturn } from '@/components/balance-return'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { FixedMonthCell } from '@/components/fixed-month-cell'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { SupplierPanel } from '@/components/supplier-panel'
import { SupplierPaymentForm } from '@/components/supplier-payment-form'
import {
  deleteCharge,
  deleteExpense,
  deletePayment,
  deleteTrayPrice,
  removeFixedExpense,
  saveCharge,
  saveExpense,
  saveFixedExpense,
  savePayment,
  setSupplierPaymentStatus,
  setTrayPrice,
} from '@/lib/actions/balance'
import {
  balanceFields,
  balanceHref,
  billCompany,
  priceOn,
  pricesTouching,
  sumCharges,
  sumPaidFixed,
  sumPaidSuppliers,
  sumPayments,
  type BalanceQuery,
  type BalanceSection,
  type PricePoint,
} from '@/lib/balance'
import { businessToday, currentMonth, daysBetween, dueLabel, formatDay, formatMoney, formatMonth, formatMonthName, monthRange } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const SECTIONS: BalanceSection[] = ['empresas', 'gastos', 'proveedores', 'echeqs', 'fijos']
const SECTION_LABEL: Record<BalanceSection, string> = {
  empresas: 'Empresas',
  gastos: 'Gastos',
  proveedores: 'Proveedores',
  echeqs: 'eCheqs',
  fijos: 'Fijos',
}
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function BalancePage({ searchParams }: { searchParams: Promise<{ mes?: string; anio?: string; vista?: string; error?: string; seccion?: string; empresa?: string }> }) {
  const { mes, anio, vista: vistaParam, error, seccion: seccionParam, empresa } = await searchParams
  const vista = vistaParam === 'anio' ? 'anio' : 'mes'
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonth()
  const year = anio && /^\d{4}$/.test(anio) ? anio : month.slice(0, 4)
  const seccion = SECTIONS.includes(seccionParam as BalanceSection) ? seccionParam as BalanceSection : 'empresas'
  const { start, end } = vista === 'anio' ? { start: `${year}-01-01`, end: `${year}-12-31` } : monthRange(month)
  const today = businessToday()
  const priceDate = today >= start && today <= end ? today : start
  const periodName = vista === 'anio' ? 'año' : 'mes'
  const periodLabel = vista === 'anio' ? year : formatMonth(month)
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()
  const query: BalanceQuery = { vista, month, year, seccion, empresa: seccion === 'empresas' ? empresa : undefined }

  const [
    { data: companies },
    { data: prices },
    { data: charges },
    { data: payments },
    { data: expenses },
    { data: trayDays },
    { data: extraTrayDays },
    { data: bandeja },
    { data: suppliers },
    { data: supplierPayments },
    { data: pendingEcheqs },
    { data: fixedExpenses },
    { data: fixedMonths },
  ] = await Promise.all([
    supabase.from('companies').select('id, nombre_comercial').eq('business_space_id', session.spaceId).order('nombre_comercial'),
    supabase.from('company_tray_prices').select('id, company_id, effective_from, unit_price').eq('business_space_id', session.spaceId),
    supabase.from('company_charges').select('id, company_id, charged_on, concept, amount').eq('business_space_id', session.spaceId).lte('charged_on', end).order('charged_on', { ascending: false }),
    supabase.from('company_payments').select('id, company_id, paid_on, amount, note').eq('business_space_id', session.spaceId).lte('paid_on', end).order('paid_on', { ascending: false }),
    supabase.from('space_expenses').select('id, spent_on, concept, amount').eq('business_space_id', session.spaceId).gte('spent_on', start).lte('spent_on', end).order('spent_on', { ascending: false }),
    supabase.rpc('tray_days_until', { p_space_id: session.spaceId, p_until: end }),
    supabase.rpc('extra_tray_days_until', { p_space_id: session.spaceId, p_until: end }),
    supabase.from('gastronomic_categories').select('id').eq('business_space_id', session.spaceId).eq('slug', 'bandeja').maybeSingle(),
    supabase.from('suppliers').select('id, name, active').eq('business_space_id', session.spaceId).order('name'),
    supabase.from('supplier_payments').select('id, supplier_id, paid_on, concept, amount, method, status, echeq_number, echeq_date').eq('business_space_id', session.spaceId).gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }),
    supabase.from('supplier_payments').select('id, supplier_id, paid_on, concept, amount, method, status, echeq_number, echeq_date').eq('business_space_id', session.spaceId).eq('method', 'ECHEQ').eq('status', 'PENDIENTE').order('echeq_date'),
    supabase.from('fixed_expenses').select('id, name, active, sort_order').eq('business_space_id', session.spaceId).order('sort_order'),
    supabase.from('fixed_expense_months').select('fixed_expense_id, year, month, status, amount').eq('business_space_id', session.spaceId).eq('year', Number(year)),
  ])

  const priceRows: PricePoint[] = (prices ?? []).map((price) => ({ ...price, unit_price: Number(price.unit_price) }))
  const chargeRows = (charges ?? []).map((charge) => ({ ...charge, amount: Number(charge.amount) }))
  const paymentRows = (payments ?? []).map((payment) => ({ ...payment, amount: Number(payment.amount) }))
  const days = (trayDays ?? []).map((day) => ({ ...day, trays: Number(day.trays) }))
  const extraDays = (extraTrayDays ?? []).map((day) => ({ ...day, trays: Number(day.trays) }))
  const allDays = [...days, ...extraDays]
  const expenseRows = (expenses ?? []).map((expense) => ({ ...expense, amount: Number(expense.amount) }))
  const supplierRows = (supplierPayments ?? []).map((payment) => ({ ...payment, amount: Number(payment.amount) }))
  const fixedRows = (fixedMonths ?? []).map((row) => ({ ...row, amount: row.amount == null ? null : Number(row.amount) }))
  const round = (value: number) => Math.round(value * 100) / 100

  const accounts = (companies ?? []).map((company) => {
    const people = billCompany(company.id, days, priceRows, start, end)
    const extra = billCompany(company.id, extraDays, priceRows, start, end)
    const other = sumCharges(chargeRows, company.id, start, end)
    const lifetimePeople = billCompany(company.id, days, priceRows, '0001-01-01', end)
    const lifetimeExtra = billCompany(company.id, extraDays, priceRows, '0001-01-01', end)
    const lifetimeOther = sumCharges(chargeRows, company.id, '0001-01-01', end)
    const collectedPeriod = sumPayments(paymentRows, company.id, start, end)
    const collectedLifetime = sumPayments(paymentRows, company.id, '0001-01-01', end)
    return {
      ...company,
      trays: people.trays + extra.trays,
      peopleTrays: people.trays,
      extraTrays: extra.trays,
      extraBilled: extra.billed,
      otherBilled: other,
      billed: round(people.billed + extra.billed + other),
      missingPrice: people.missingPrice || extra.missingPrice,
      collectedPeriod,
      balance: round(lifetimePeople.billed + lifetimeExtra.billed + lifetimeOther - collectedLifetime),
      trayPrice: priceOn(priceRows, company.id, end),
      trayHistory: pricesTouching(priceRows, company.id, start, end),
    }
  })

  const billed = accounts.reduce((sum, account) => sum + account.billed, 0)
  const collected = accounts.reduce((sum, account) => sum + account.collectedPeriod, 0)
  const debt = accounts.reduce((sum, account) => sum + account.balance, 0)
  const looseSpent = expenseRows.reduce((sum, expense) => sum + expense.amount, 0)
  const spent = round(looseSpent + sumPaidSuppliers(supplierRows, start, end) + sumPaidFixed(fixedRows, start, end))
  const result = round(collected - spent)
  const open = seccion === 'empresas' ? accounts.find((account) => account.id === empresa) : undefined
  const activeSuppliers = (suppliers ?? []).filter((supplier) => supplier.active)
  const visibleFixed = (fixedExpenses ?? []).filter((expense) => expense.active || fixedRows.some((row) => row.fixed_expense_id === expense.id))

  const yearMonths = vista === 'anio'
    ? Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`).map((value) => {
        const range = monthRange(value)
        const monthBilled = (companies ?? []).reduce((sum, company) => {
          const trays = billCompany(company.id, allDays, priceRows, range.start, range.end).billed
          const other = sumCharges(chargeRows, company.id, range.start, range.end)
          return sum + trays + other
        }, 0)
        const monthCollected = sumPayments(paymentRows, null, range.start, range.end)
        const monthSpent = round(
          expenseRows.reduce((sum, expense) => expense.spent_on >= range.start && expense.spent_on <= range.end ? sum + expense.amount : sum, 0)
          + sumPaidSuppliers(supplierRows, range.start, range.end)
          + sumPaidFixed(fixedRows, range.start, range.end),
        )
        return { value, billed: round(monthBilled), collected: monthCollected, spent: monthSpent, result: round(monthCollected - monthSpent) }
      })
    : []

  return (
    <div className="balance-page">
      <PageHeader
        eyebrow="CONTABILIDAD"
        title="Balance"
        description={`Bandejas, otros cargos y gastos de ${periodLabel}.`}
      />
      <BalanceFilters vista={vista} month={month} year={year} seccion={seccion} empresa={open?.id} />
      {error && <p className="error-banner">{error}</p>}
      {!bandeja && <p className="error-banner">No hay una categoría con identificador bandeja. Esas elecciones no se facturan.</p>}
      <div className="stats-grid balance-stats">
        <article className="stat-card money"><div className="stat-label">Facturado</div><div className="stat-value-row"><strong>{formatMoney(billed)}</strong></div><p>bandejas y otros cargos del {periodName}</p></article>
        <article className="stat-card money"><div className="stat-label">Cobrado</div><div className="stat-value-row"><strong>{formatMoney(collected)}</strong></div><p>pagos del {periodName}</p></article>
        <article className="stat-card money"><div className="stat-label">Deuda</div><div className="stat-value-row"><strong>{formatMoney(debt)}</strong></div><p>al cierre del período</p></article>
        <article className="stat-card money"><div className="stat-label">Gastos</div><div className="stat-value-row"><strong>{formatMoney(spent)}</strong></div><p>pagados en el {periodName}</p></article>
        <article className="stat-card money"><div className="stat-label">Resultado</div><div className="stat-value-row"><strong className={result < 0 ? 'money-negative' : ''}>{formatMoney(result)}</strong></div><p>cobrado menos gastos</p></article>
      </div>

      {vista === 'anio' && (
        <section className="panel">
          <div className="panel-heading"><div><h2>Mes a mes</h2><p className="muted">El resultado de cada mes es lo cobrado menos los gastos pagados.</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>MES</th><th className="num">FACTURADO</th><th className="num">COBRADO</th><th className="num">GASTOS</th><th className="num">RESULTADO</th></tr></thead>
              <tbody>
                {yearMonths.map((row) => (
                  <tr key={row.value}>
                    <td><a className="text-button" href={balanceHref({ vista: 'mes', month: row.value, year: row.value.slice(0, 4), seccion })}>{formatMonthName(row.value)}</a></td>
                    <td className="num">{formatMoney(row.billed)}</td>
                    <td className="num">{formatMoney(row.collected)}</td>
                    <td className="num">{formatMoney(row.spent)}</td>
                    <td className={`num${row.result < 0 ? ' money-negative' : ''}`}>{formatMoney(row.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav className="balance-tabs" aria-label="Partes del balance">
        {SECTIONS.map((section) => (
          <a key={section} className={section === seccion ? 'active' : ''} href={balanceHref({ vista, month, year, seccion: section })}>
            {SECTION_LABEL[section]}
          </a>
        ))}
      </nav>

      {seccion === 'empresas' && (open ? (
        <CompanyDetail account={open} chargeRows={chargeRows} paymentRows={paymentRows} start={start} end={end} priceDate={priceDate} query={{ ...query, empresa: open.id }} />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Empresas</h2>
              <p className="muted">Elegí una empresa para ver precios, otros cargos y cobros.</p>
            </div>
          </div>
          {(companies ?? []).length === 0 ? <EmptyState title="Todavía no hay empresas" description="Creá una empresa para poder anotar su precio y sus pagos." /> : (
            <div className="table-wrap">
              <table className="balance-table">
                <thead>
                  <tr><th>EMPRESA</th><th className="num">BANDEJAS</th><th className="num">CARGOS</th><th className="num">FACTURADO</th><th className="num">COBRADO</th><th className="num">SALDO</th></tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <a className="stretch-link" href={balanceHref({ ...query, empresa: account.id })}>{account.nombre_comercial}</a>
                        {account.missingPrice && <span className="row-note">Hay consumos sin precio</span>}
                      </td>
                      <td className="num">{account.trays}</td>
                      <td className="num">{formatMoney(account.otherBilled)}</td>
                      <td className="num">{formatMoney(account.billed)}</td>
                      <td className="num">{formatMoney(account.collectedPeriod)}</td>
                      <td className={`num${account.balance > 0 ? ' money-negative' : ''}`}>{formatMoney(account.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {seccion === 'gastos' && (
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Gastos del {periodName}</h2><p className="muted">Insumos y otros gastos sueltos del espacio.</p></div>
            <FormDialog title="Anotar gasto" trigger="Anotar gasto" action={saveExpense} formClassName="balance-form dialog-form">
              <BalanceReturn query={query} />
              <label className="field">Fecha<input type="date" name="spent_on" defaultValue={priceDate} required /></label>
              <label className="field">Concepto / n de factura<input name="concept" placeholder="Insumos, flete, n de factura…" required /></label>
              <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
              <button className="primary-button" type="submit">Anotar gasto</button>
            </FormDialog>
          </div>
          {expenseRows.length === 0 ? <p className="muted ledger-empty">Todavía no hay gastos en este {periodName}.</p> : (
            <div className="table-wrap">
              <table className="balance-table">
                <thead><tr><th>FECHA</th><th>CONCEPTO / N DE FACTURA</th><th className="num">MONTO</th><th></th></tr></thead>
                <tbody>
                  {expenseRows.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDay(expense.spent_on)}</td>
                      <td>{expense.concept}</td>
                      <td className="num">{formatMoney(expense.amount)}</td>
                      <td className="row-action"><DeleteButton action={deleteExpense} name={expense.concept} fields={{ id: expense.id, ...balanceFields(query) }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {seccion === 'proveedores' && (
        <SupplierPanel
          suppliers={suppliers ?? []}
          payments={supplierRows}
          periodName={periodName}
          defaultDate={priceDate}
          query={query}
        />
      )}

      {seccion === 'echeqs' && (
        <EcheqSection
          pending={(pendingEcheqs ?? []).map((payment) => ({ ...payment, amount: Number(payment.amount) }))}
          paid={supplierRows.filter((payment) => payment.method === 'ECHEQ' && payment.status === 'PAGADO')}
          suppliers={suppliers ?? []}
          activeSuppliers={activeSuppliers}
          today={today}
          priceDate={priceDate}
          periodName={periodName}
          query={query}
        />
      )}

      {seccion === 'fijos' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Gastos fijos de {year}</h2>
              <p className="muted">Cada celda pasa de pendiente a pagado y después a no aplica. El monto se escribe al marcarlo pagado.</p>
            </div>
            <FormDialog title="Agregar gasto fijo" trigger="Agregar" triggerClassName="outline-button" action={saveFixedExpense} formClassName="balance-form dialog-form">
              <BalanceReturn query={query} />
              <label className="field">Servicio<input name="name" placeholder="Alquiler, contador…" required /></label>
              <button className="primary-button" type="submit">Agregar</button>
            </FormDialog>
          </div>
          {visibleFixed.length === 0 ? <EmptyState title="Todavía no hay gastos fijos" description="Agregá un servicio para seguirlo mes a mes." /> : (
            <div className="table-wrap">
              <table className="balance-table fixed-grid">
                <thead>
                  <tr>
                    <th>SERVICIO</th>
                    {MONTHS.map((label, index) => {
                      const key = `${year}-${String(index + 1).padStart(2, '0')}`
                      return <th key={label} className={vista === 'mes' && month === key ? 'current-month' : ''}>{label}</th>
                    })}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFixed.map((expense) => (
                    <tr key={expense.id} className={expense.active ? '' : 'inactive-row'}>
                      <td>{expense.name}</td>
                      {MONTHS.map((label, index) => {
                        const monthNumber = index + 1
                        const cell = fixedRows.find((row) => row.fixed_expense_id === expense.id && row.month === monthNumber)
                        const key = `${year}-${String(monthNumber).padStart(2, '0')}`
                        return (
                          <td key={label} className={vista === 'mes' && month === key ? 'current-month' : ''}>
                            <FixedMonthCell
                              expenseId={expense.id}
                              year={Number(year)}
                              month={monthNumber}
                              status={cell?.status ?? 'PENDIENTE'}
                              amount={cell?.amount ?? null}
                              query={query}
                            />
                          </td>
                        )
                      })}
                      <td className="row-action">
                        {expense.active && (
                          <form action={removeFixedExpense}>
                            <BalanceReturn query={query} />
                            <input type="hidden" name="id" value={expense.id} />
                            <button className="outline-button" type="submit">Quitar</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function EcheqSection({
  pending,
  paid,
  suppliers,
  activeSuppliers,
  today,
  priceDate,
  periodName,
  query,
}: {
  pending: { id: string; supplier_id: string; paid_on: string; concept: string; amount: number; echeq_number: string | null; echeq_date: string | null }[]
  paid: { id: string; supplier_id: string; paid_on: string; concept: string; amount: number; echeq_number: string | null; echeq_date: string | null }[]
  suppliers: { id: string; name: string }[]
  activeSuppliers: { id: string; name: string }[]
  today: string
  priceDate: string
  periodName: string
  query: BalanceQuery
}) {
  const nameOf = (id: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? 'Proveedor'
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>eCheqs emitidos</h2>
          <p className="muted">Los que emite Mora. Un pendiente no entra en el mes. El aviso de Inicio muestra los que vencen en los próximos 5 días.</p>
        </div>
        <FormDialog title="Emitir eCheq" trigger="Emitir eCheq" disabled={activeSuppliers.length === 0} wide>
          <SupplierPaymentForm suppliers={activeSuppliers} defaultDate={priceDate} query={query} issued stacked />
        </FormDialog>
      </div>
      {activeSuppliers.length === 0 && <p className="muted ledger-empty">Agregá un proveedor en Proveedores para emitir un eCheq.</p>}
      {pending.length === 0 ? <p className="muted ledger-empty">No hay eCheqs pendientes.</p> : (
        <div className="table-wrap">
          <table className="balance-table">
            <thead><tr><th>VENCIMIENTO</th><th>PROVEEDOR</th><th>NÚMERO</th><th>CONCEPTO</th><th className="num">MONTO</th><th>AVISO</th><th></th></tr></thead>
            <tbody>
              {pending.map((payment) => {
                const due = payment.echeq_date ?? payment.paid_on
                const days = daysBetween(today, due)
                const tone = days < 0 ? 'echeq-overdue' : days <= 5 ? 'echeq-soon' : ''
                return (
                  <tr key={payment.id} className={tone}>
                    <td>{formatDay(due)}</td>
                    <td>{nameOf(payment.supplier_id)}</td>
                    <td>{payment.echeq_number}</td>
                    <td>{payment.concept}</td>
                    <td className="num">{formatMoney(payment.amount)}</td>
                    <td>{dueLabel(today, due)}</td>
                    <td>
                      <form action={setSupplierPaymentStatus}>
                        <BalanceReturn query={query} />
                        <input type="hidden" name="id" value={payment.id} />
                        <input type="hidden" name="status" value="PAGADO" />
                        <button className="fixed-state pending" type="submit">Marcar pagado</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {paid.length > 0 && (
        <div className="detail-block">
          <h3>Pagados en este {periodName}</h3>
          <div className="table-wrap">
            <table className="balance-table">
              <thead><tr><th>PAGO</th><th>VENCIMIENTO</th><th>PROVEEDOR</th><th>NÚMERO</th><th>CONCEPTO</th><th className="num">MONTO</th></tr></thead>
              <tbody>
                {paid.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDay(payment.paid_on)}</td>
                    <td>{payment.echeq_date ? formatDay(payment.echeq_date) : '—'}</td>
                    <td>{nameOf(payment.supplier_id)}</td>
                    <td>{payment.echeq_number}</td>
                    <td>{payment.concept}</td>
                    <td className="num">{formatMoney(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function CompanyDetail({
  account,
  chargeRows,
  paymentRows,
  start,
  end,
  priceDate,
  query,
}: {
  account: {
    id: string
    nombre_comercial: string
    peopleTrays: number
    extraTrays: number
    extraBilled: number
    otherBilled: number
    billed: number
    collectedPeriod: number
    balance: number
    missingPrice: boolean
    trayPrice: PricePoint | null
    trayHistory: PricePoint[]
  }
  chargeRows: { id: string; company_id: string; charged_on: string; concept: string; amount: number }[]
  paymentRows: { id: string; company_id: string; paid_on: string; amount: number; note: string | null }[]
  start: string
  end: string
  priceDate: string
  query: BalanceQuery
}) {
  const lines = chargeRows.filter((charge) => charge.company_id === account.id && charge.charged_on >= start && charge.charged_on <= end)
  const collections = paymentRows.filter((payment) => payment.company_id === account.id && payment.paid_on >= start)
  const listHref = balanceHref({ ...query, empresa: undefined })

  return (
    <section className="panel company-balance">
      <div className="panel-heading">
        <div>
          <a className="text-button" href={listHref}>Volver a empresas</a>
          <h2>{account.nombre_comercial}</h2>
          <p className="muted">{account.peopleTrays} de personas · {account.extraTrays} extras, {formatMoney(account.extraBilled)} aparte · otros cargos {formatMoney(account.otherBilled)}</p>
          {account.missingPrice && <p className="muted">Hay consumos de este período sin precio.</p>}
        </div>
      </div>
      <dl className="account-figures">
        <div><dt>Facturado</dt><dd>{formatMoney(account.billed)}</dd></div>
        <div><dt>Cobrado</dt><dd>{formatMoney(account.collectedPeriod)}</dd></div>
        <div><dt>Saldo</dt><dd className={account.balance > 0 ? 'money-negative' : ''}>{formatMoney(account.balance)}</dd></div>
      </dl>

      <PriceEditor title="Precio por bandeja" carried={account.trayPrice} history={account.trayHistory} companyId={account.id} priceDate={priceDate} query={query} saveAction={setTrayPrice} deleteAction={deleteTrayPrice} />

      <div className="detail-block">
        <div className="panel-heading">
          <div>
            <h3>Otros cargos</h3>
            <p className="muted">Ingresos sueltos de esta empresa: eventos, extras o cualquier concepto con monto libre.</p>
          </div>
          <FormDialog title="Anotar cargo" trigger="Anotar cargo" action={saveCharge} formClassName="balance-form dialog-form">
            <BalanceReturn query={query} />
            <input type="hidden" name="company_id" value={account.id} />
            <label className="field">Fecha<input type="date" name="charged_on" defaultValue={priceDate} required /></label>
            <label className="field">Concepto<input name="concept" placeholder="Evento, extra, servicio…" required /></label>
            <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
            <button className="primary-button" type="submit">Anotar cargo</button>
          </FormDialog>
        </div>
        {lines.length === 0 ? <p className="muted ledger-empty">Todavía no hay otros cargos en este período.</p> : (
          <div className="table-wrap">
            <table className="balance-table">
              <thead><tr><th>FECHA</th><th>CONCEPTO</th><th className="num">MONTO</th><th></th></tr></thead>
              <tbody>
                {lines.map((charge) => (
                  <tr key={charge.id}>
                    <td>{formatDay(charge.charged_on)}</td>
                    <td>{charge.concept}</td>
                    <td className="num">{formatMoney(charge.amount)}</td>
                    <td className="row-action"><DeleteButton action={deleteCharge} name={charge.concept} fields={{ id: charge.id, ...balanceFields(query) }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="detail-block">
        <div className="panel-heading">
          <div>
            <h3>Cobros del período</h3>
          </div>
          <FormDialog title="Anotar cobro" trigger="Anotar cobro" action={savePayment} formClassName="balance-form dialog-form">
            <BalanceReturn query={query} />
            <input type="hidden" name="company_id" value={account.id} />
            <label className="field">Fecha<input type="date" name="paid_on" defaultValue={priceDate} required /></label>
            <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
            <label className="field">Nota<input name="note" placeholder="Opcional" /></label>
            <button className="primary-button" type="submit">Anotar cobro</button>
          </FormDialog>
        </div>
        {collections.length === 0 ? <p className="muted ledger-empty">Todavía no hay cobros en este período.</p> : (
          <div className="table-wrap">
            <table className="balance-table">
              <thead><tr><th>FECHA</th><th className="num">MONTO</th><th>NOTA</th><th></th></tr></thead>
              <tbody>
                {collections.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDay(payment.paid_on)}</td>
                    <td className="num">{formatMoney(payment.amount)}</td>
                    <td>{payment.note || '—'}</td>
                    <td className="row-action"><DeleteButton action={deletePayment} name={`el cobro del ${formatDay(payment.paid_on)}`} fields={{ id: payment.id, ...balanceFields(query) }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function PriceEditor({
  title,
  carried,
  history,
  companyId,
  priceDate,
  query,
  saveAction,
  deleteAction,
}: {
  title: string
  carried: PricePoint | null
  history: PricePoint[]
  companyId: string
  priceDate: string
  query: BalanceQuery
  saveAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}) {
  const older = history.filter((price) => price.id !== carried?.id)
  return (
    <div className="account-price">
      <h3>{title}</h3>
      {carried ? (
        <div className="price-current">
          <p>Sigue en {formatMoney(Number(carried.unit_price))} desde {formatDay(carried.effective_from)}.</p>
          {carried.id && <DeleteButton action={deleteAction} name={`el precio del ${formatDay(carried.effective_from)}`} label="Quitar precio" fields={{ id: carried.id, ...balanceFields(query) }} />}
        </div>
      ) : (
        <p className="muted">Todavía no tiene precio. El que cargues sigue hasta que lo cambies.</p>
      )}
      {older.length > 0 && (
        <ul className="price-history">
          {older.map((price) => (
            <li key={price.id}>
              <span>Desde {formatDay(price.effective_from)}</span>
              <strong>{formatMoney(Number(price.unit_price))}</strong>
              {price.id && <DeleteButton action={deleteAction} name={`el precio del ${formatDay(price.effective_from)}`} fields={{ id: price.id, ...balanceFields(query) }} />}
            </li>
          ))}
        </ul>
      )}
      <FormDialog title={title} trigger={carried ? 'Cambiar precio' : 'Cargar precio'} triggerClassName="outline-button" action={saveAction} formClassName="stack-form dialog-form">
        <BalanceReturn query={query} />
        <input type="hidden" name="company_id" value={companyId} />
        <label className="field">Cambiar desde<input type="date" name="effective_from" defaultValue={priceDate} required /></label>
        <label className="field">Precio nuevo<input name="unit_price" inputMode="decimal" placeholder="0,00" required /></label>
        <button className="primary-button" type="submit">Guardar</button>
      </FormDialog>
    </div>
  )
}
