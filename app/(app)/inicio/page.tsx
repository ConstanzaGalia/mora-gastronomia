import Link from 'next/link'
import { ClipboardList, NotebookText, Package, Users, UtensilsCrossed } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { EventFilters } from '@/components/event-filters'
import { EventList } from '@/components/event-list'
import { PageHeader } from '@/components/page-header'
import { eventMoney, itemCost, periodFromSearch } from '@/lib/events'
import { addDays, businessToday, dashboardFocusDate, dashboardFocusLabel, dueLabel, formatDay, formatLongDate, formatMoney, formatMonth } from '@/lib/format'
import { extraNote, loadExtras, mergeKitchen, mergeMarket, portionNote } from '@/lib/kitchen'
import { loadMarketProduction } from '@/lib/market'
import { assertRole, isEventosSpace, requireSession, type SessionContext } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ mes?: string; anio?: string; vista?: string }> }) {
  const [session, search] = await Promise.all([requireSession(), searchParams])
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN'])
  if (session.primary.role === 'COMPANY_ADMIN') return <CompanyHome session={session} />
  if (isEventosSpace(session)) return <EventosHome session={session} search={search} />
  return <MoraHome session={session} />
}

async function MoraHome({ session }: { session: SessionContext }) {
  const supabase = await createClient()
  const today = businessToday()
  const focusDate = dashboardFocusDate()
  const when = dashboardFocusLabel(focusDate, today)

  const [{ count: companies }, { count: employees }, optionsResult, viandasResult, { data: week }] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('business_space_id', session.spaceId).eq('active', true),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'EMPLOYEE')
      .eq('status', 'ACTIVE')
      .eq('business_space_id', session.spaceId)
      .lte('started_at', today)
      .or(`ended_at.is.null,ended_at.gte.${today}`),
    supabase.from('v_daily_option_totals').select('category_name, option_name, total, category_sort_order').eq('business_space_id', session.spaceId).eq('service_date', focusDate),
    supabase.from('v_daily_company_totals').select('total_viandas').eq('business_space_id', session.spaceId).eq('service_date', focusDate),
    supabase.from('calendar_weeks').select('id, status, week_start, week_end').eq('business_space_id', session.spaceId).lte('week_start', focusDate).gte('week_end', focusDate).maybeSingle(),
  ])

  const [extras, market] = await Promise.all([
    loadExtras(supabase, session.spaceId, focusDate, null),
    loadMarketProduction(supabase, session.spaceId, focusDate),
  ])
  const dueUntil = addDays(today, 5)
  const { data: dueEcheqs } = await supabase
    .from('supplier_payments')
    .select('id, concept, amount, echeq_number, echeq_date, supplier_id, suppliers(name)')
    .eq('business_space_id', session.spaceId)
    .eq('method', 'ECHEQ')
    .eq('status', 'PENDIENTE')
    .lte('echeq_date', dueUntil)
    .order('echeq_date')

  const totalViandas = (viandasResult.data ?? []).reduce((sum, row) => sum + (row.total_viandas ?? 0), 0) + market.viandas
  const rows = mergeMarket(mergeKitchen(optionsResult.data ?? [], extras), market.portions)

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`Buen día${session.profile ? `, ${session.profile.nombre}` : ''}`}
        description={`Producción de ${when} en ${session.spaceName}.`}
        action={<Link className="primary-button" href="/calendario">Ver calendario</Link>}
      />
      {(dueEcheqs ?? []).length > 0 && (
        <section className="panel echeq-alert">
          <div className="panel-heading">
            <div>
              <h2>eCheqs por vencer</h2>
              <p className="muted">Emitidos por Mora y todavía pendientes, con vencimiento en los próximos 5 días o ya vencidos.</p>
            </div>
            <Link className="text-button" href="/balance?seccion=echeqs">Ver eCheqs</Link>
          </div>
          <div className="alert-list">
            {(dueEcheqs ?? []).map((payment) => {
              const supplier = Array.isArray(payment.suppliers) ? payment.suppliers[0] : payment.suppliers
              return (
                <div key={payment.id}>
                  <strong>{dueLabel(today, payment.echeq_date ?? today)}</strong>
                  <span>Nº {payment.echeq_number} · {supplier?.name ?? payment.concept} · {formatMoney(Number(payment.amount))}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
      <div className="stats-grid">
        <article className="stat-card"><div className="stat-icon coral"><UtensilsCrossed size={19} /></div><div className="stat-label">Viandas para {when}</div><div className="stat-value-row"><strong>{totalViandas}</strong></div><p>{formatDay(focusDate)}</p></article>
        <article className="stat-card"><div className="stat-icon blue"><Users size={19} /></div><div className="stat-label">Empleados activos</div><div className="stat-value-row"><strong>{employees ?? 0}</strong></div><p>en el espacio</p></article>
        <article className="stat-card"><div className="stat-icon sage"><Package size={19} /></div><div className="stat-label">Empresas activas</div><div className="stat-value-row"><strong>{companies ?? 0}</strong></div><p>con servicio habilitado</p></article>
        <article className="stat-card"><div className="stat-icon gold"><ClipboardList size={19} /></div><div className="stat-label">Semana de {when}</div><div className="stat-value-row"><strong>{week?.status === 'PUBLISHED' ? 'Publicada' : week ? 'Borrador' : 'Sin semana'}</strong></div><p>{week ? `${formatDay(week.week_start)} al ${formatDay(week.week_end)}` : 'Todavía no está cargada'}</p></article>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Para producir {when}</h2><p className="muted">{formatDay(focusDate)} · empresas, extras y mercadito confirmado</p></div>
          <Link className="text-button" href={`/reportes?fecha=${focusDate}`}>Ver reportes</Link>
        </div>
        {rows.length === 0 ? <EmptyState title="Todavía no hay cantidades" description="Cuando haya elecciones de las empresas o pedidos confirmados del mercadito, acá vas a ver el total." /> : (
          <div className="report-bars">
            {rows.map((row) => (
              <div className="report-row" key={`${row.category_name}-${row.option_name}`}>
                <span>{row.category_name} · {row.option_name}{portionNote(row.extras, row.market)}</span>
                <strong>{row.total}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

async function EventosHome({
  session,
  search,
}: {
  session: SessionContext
  search: { mes?: string; anio?: string; vista?: string }
}) {
  const period = periodFromSearch(search.mes, search.anio, search.vista)
  const supabase = await createClient()
  const [{ data: events }, { data: items }, { data: expenses }, { data: payments }] = await Promise.all([
    supabase.from('events').select('id, name, client_name, event_on, quoted_amount, status').eq('business_space_id', session.spaceId).neq('status', 'CANCELADO').gte('event_on', period.start).lte('event_on', period.end).order('event_on', { ascending: false }),
    supabase.from('event_items').select('event_id, quantity, unit_cost').eq('business_space_id', session.spaceId),
    supabase.from('event_expenses').select('event_id, amount').eq('business_space_id', session.spaceId),
    supabase.from('event_payments').select('event_id, amount').eq('business_space_id', session.spaceId),
  ])

  const rows = (events ?? []).map((event) => {
    const cateringCost = (items ?? []).filter((item) => item.event_id === event.id).reduce((sum, item) => sum + itemCost(Number(item.quantity), Number(item.unit_cost)), 0)
    const spent = (expenses ?? []).filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0)
    const collected = (payments ?? []).filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0)
    return { ...event, money: eventMoney(Number(event.quoted_amount), collected, cateringCost, spent) }
  })
  const totals = rows.reduce((sum, row) => ({
    quoted: sum.quoted + row.money.quoted,
    collected: sum.collected + row.money.collected,
    pending: sum.pending + row.money.pending,
    cateringCost: sum.cateringCost + row.money.cateringCost,
    expenses: sum.expenses + row.money.expenses,
    margin: sum.margin + row.money.margin,
    cash: sum.cash + row.money.cash,
  }), { quoted: 0, collected: 0, pending: 0, cateringCost: 0, expenses: 0, margin: 0, cash: 0 })
  const periodName = period.vista === 'anio' ? 'año' : 'mes'
  const periodLabel = period.vista === 'anio' ? period.year : formatMonth(period.month)

  return (
    <>
      <PageHeader
        eyebrow="EVENTOS"
        title={`Buen día${session.profile ? `, ${session.profile.nombre}` : ''}`}
        description={`Resumen de catering de ${periodLabel}.`}
        action={<Link className="primary-button" href="/eventos">Ver eventos</Link>}
      />
      <EventFilters action="/inicio" vista={period.vista} month={period.month} year={period.year} />
      <div className="stats-grid balance-stats">
        <article className="stat-card money"><div className="stat-label">Acordado</div><div className="stat-value-row"><strong>{formatMoney(totals.quoted)}</strong></div><p>monto de los eventos del {periodName}</p></article>
        <article className="stat-card money"><div className="stat-label">Cobrado</div><div className="stat-value-row"><strong>{formatMoney(totals.collected)}</strong></div><p>pagos de esos eventos</p></article>
        <article className="stat-card money"><div className="stat-label">Pendiente</div><div className="stat-value-row"><strong>{formatMoney(totals.pending)}</strong></div><p>saldo por cobrar</p></article>
        <article className="stat-card money"><div className="stat-label">Costo catering</div><div className="stat-value-row"><strong>{formatMoney(totals.cateringCost)}</strong></div><p>costo interno del menú</p></article>
        <article className="stat-card money"><div className="stat-label">Gastos</div><div className="stat-value-row"><strong>{formatMoney(totals.expenses)}</strong></div><p>salidas anotadas</p></article>
        <article className="stat-card money"><div className="stat-label">Margen</div><div className="stat-value-row"><strong className={totals.margin < 0 ? 'money-negative' : ''}>{formatMoney(totals.margin)}</strong></div><p>acordado menos costos</p></article>
        <article className="stat-card money"><div className="stat-label">Resultado caja</div><div className="stat-value-row"><strong className={totals.cash < 0 ? 'money-negative' : ''}>{formatMoney(totals.cash)}</strong></div><p>cobrado menos gastos</p></article>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Eventos del período</h2>
            <p className="muted">Sin cancelados. El cobro es el acumulado de cada servicio.</p>
          </div>
          <Link className="text-button" href="/eventos">Agenda completa</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No hay eventos en este período" description="Cuando cargues un servicio, acá vas a ver acordado, cobrado y el margen." />
        ) : (
          <EventList rows={rows} />
        )}
      </section>
    </>
  )
}

async function CompanyHome({ session }: { session: SessionContext }) {
  const supabase = await createClient()
  const today = businessToday()
  const focusDate = dashboardFocusDate()
  const when = dashboardFocusLabel(focusDate, today)
  const companyId = session.companyId!
  const { data: company } = await supabase
    .from('companies')
    .select('nombre_comercial')
    .eq('id', companyId)
    .maybeSingle()

  const { data: members } = await supabase
    .from('memberships')
    .select('id, user_id, profiles!memberships_user_id_fkey(nombre, apellido)')
    .eq('company_id', companyId)
    .eq('role', 'EMPLOYEE')
    .eq('status', 'ACTIVE')
    .lte('started_at', focusDate)
    .or(`ended_at.is.null,ended_at.gte.${focusDate}`)

  const employeeIds = (members ?? []).map((member) => member.user_id)
  const { data: day } = await supabase
    .from('calendar_days')
    .select('id, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', session.spaceId)
    .eq('service_date', focusDate)
    .maybeSingle()

  const [{ data: selections }, { data: extras }, optionsResult] = await Promise.all([
    employeeIds.length
      ? supabase
          .from('employee_selections')
          .select('employee_id, status')
          .eq('company_id', companyId)
          .eq('service_date', focusDate)
          .eq('status', 'SUBMITTED')
          .in('employee_id', employeeIds)
      : Promise.resolve({ data: [] }),
    day?.id
      ? supabase.from('company_day_extras').select('quantity').eq('company_id', companyId).eq('calendar_day_id', day.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('v_daily_company_option_totals')
      .select('category_name, option_name, total, category_sort_order')
      .eq('company_id', companyId)
      .eq('service_date', focusDate),
  ])

  const chosenIds = new Set((selections ?? []).map((row) => row.employee_id))
  const pending = (members ?? [])
    .filter((member) => !chosenIds.has(member.user_id))
    .map((member) => {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
      return {
        id: member.user_id,
        name: `${profile?.apellido ?? ''} ${profile?.nombre ?? ''}`.trim() || 'Empleado',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const menuPublished = Boolean(day?.is_service_day && day.calendar_weeks.status === 'PUBLISHED')
  const chosenCount = chosenIds.size
  const employeeCount = members?.length ?? 0
  const extraTotal = (extras ?? []).reduce((sum, row) => sum + Number(row.quantity), 0)
  const kitchenExtras = await loadExtras(supabase, session.spaceId, focusDate, companyId)
  const rows = mergeKitchen(optionsResult.data ?? [], kitchenExtras)

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`Buen día${session.profile ? `, ${session.profile.nombre}` : ''}`}
        description={`${company?.nombre_comercial ?? 'Tu empresa'} · ${menuPublished ? `${chosenCount} de ${employeeCount} ya eligieron para ${when}` : `todavía no hay menú publicado para ${when}`}.`}
        action={<Link className="primary-button" href={`/elecciones?fecha=${focusDate}`}>Cargar elecciones</Link>}
      />
      <div className="stats-grid company-stats">
        <article className="stat-card"><div className="stat-icon blue"><Users size={19} /></div><div className="stat-label">Empleados activos</div><div className="stat-value-row"><strong>{employeeCount}</strong></div><p>en tu empresa</p></article>
        <article className="stat-card"><div className="stat-icon sage"><ClipboardList size={19} /></div><div className="stat-label">Ya eligieron</div><div className="stat-value-row"><strong>{chosenCount}</strong><span className="stat-of">de {employeeCount}</span></div><p>menú de {formatDay(focusDate)}</p></article>
        <article className="stat-card"><div className="stat-icon coral"><NotebookText size={19} /></div><div className="stat-label">Faltan elegir</div><div className="stat-value-row"><strong>{menuPublished ? pending.length : '—'}</strong></div><p>{menuPublished ? `todavía sin menú para ${formatDay(focusDate)}` : 'Todavía no hay menú'}</p></article>
        <article className="stat-card"><div className="stat-icon gold"><UtensilsCrossed size={19} /></div><div className="stat-label">Extras cargados</div><div className="stat-value-row"><strong>{extraTotal}</strong></div><p>bandejas extra del día</p></article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quién falta para {when}</h2>
            <p className="muted">{formatDay(focusDate)}</p>
          </div>
          <Link className="text-button" href={`/elecciones?fecha=${focusDate}`}>Ir a elecciones</Link>
        </div>
        {!menuPublished ? (
          <EmptyState title="Todavía no hay menú publicado" description={`Cuando Mora publique el menú de ${when}, acá vas a ver quién falta elegir.`} />
        ) : pending.length === 0 ? (
          <EmptyState title="Todos eligieron" description={`Tu equipo ya confirmó el menú de ${when}.`} />
        ) : (
          <ul className="pending-list">
            {pending.map((person) => (
              <li key={person.id}><span>{person.name}</span><small>Sin menú</small></li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Pedidos de tu equipo para {when}</h2>
            <p className="muted">{formatDay(focusDate)}</p>
          </div>
          <Link className="text-button" href={`/reportes?fecha=${focusDate}`}>Ver reportes</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Todavía no hay pedidos" description="Cuando tu equipo confirme el menú, acá vas a ver el resumen." />
        ) : (
          <div className="report-bars">
            {rows.map((row) => (
              <div className="report-row" key={`${row.category_name}-${row.option_name}`}>
                <span>{row.category_name} · {row.option_name}{extraNote(row.extras)}</span>
                <strong>{row.total}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
