import Link from 'next/link'
import { ClipboardList, Package, Users, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { addDays, businessToday, dueLabel, formatDay, formatLongDate, formatMoney } from '@/lib/format'
import { extraNote, loadExtras, mergeKitchen } from '@/lib/kitchen'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function InicioPage() {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN'])
  const supabase = await createClient()
  const today = businessToday()
  const tomorrow = addDays(today, 1)
  const spaceWide = session.primary.role !== 'COMPANY_ADMIN'
  const employeeFilter = supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'EMPLOYEE')
    .eq('status', 'ACTIVE')
    .lte('started_at', today)
    .or(`ended_at.is.null,ended_at.gte.${today}`)
  if (spaceWide) employeeFilter.eq('business_space_id', session.spaceId)
  else if (session.companyId) employeeFilter.eq('company_id', session.companyId)

  const [{ count: companies }, { count: employees }, optionsResult, viandasResult, { data: week }] = await Promise.all([
    spaceWide
      ? supabase.from('companies').select('id', { count: 'exact', head: true }).eq('business_space_id', session.spaceId).eq('active', true)
      : Promise.resolve({ count: 1 }),
    employeeFilter,
    spaceWide
      ? supabase.from('v_daily_option_totals').select('category_name, option_name, total, category_sort_order').eq('business_space_id', session.spaceId).eq('service_date', tomorrow)
      : supabase.from('v_daily_company_option_totals').select('category_name, option_name, total, category_sort_order').eq('company_id', session.companyId ?? '').eq('service_date', tomorrow),
    spaceWide
      ? supabase.from('v_daily_company_totals').select('total_viandas').eq('business_space_id', session.spaceId).eq('service_date', tomorrow)
      : supabase.from('v_daily_company_totals').select('total_viandas').eq('company_id', session.companyId ?? '').eq('service_date', tomorrow),
    supabase.from('calendar_weeks').select('id, status, week_start, week_end').eq('business_space_id', session.spaceId).lte('week_start', tomorrow).gte('week_end', tomorrow).maybeSingle(),
  ])

  const options = optionsResult.data
  const viandas = viandasResult.data
  const extras = await loadExtras(supabase, session.spaceId, tomorrow, spaceWide ? null : session.companyId)
  const dueUntil = addDays(today, 5)
  const { data: dueEcheqs } = spaceWide
    ? await supabase.from('supplier_payments').select('id, concept, amount, echeq_number, echeq_date, supplier_id, suppliers(name)').eq('business_space_id', session.spaceId).eq('method', 'ECHEQ').eq('status', 'PENDIENTE').lte('echeq_date', dueUntil).order('echeq_date')
    : { data: [] }

  const totalViandas = (viandas ?? []).reduce((sum, row) => sum + (row.total_viandas ?? 0), 0)
  const rows = mergeKitchen(options ?? [], extras)

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`Buen día${session.profile ? `, ${session.profile.nombre}` : ''}`}
        description={spaceWide ? `Producción de mañana en ${session.spaceName}.` : 'Lo que eligieron en tu empresa para mañana.'}
        action={spaceWide ? <Link className="primary-button" href="/calendario">Ver calendario</Link> : undefined}
      />
      {spaceWide && (dueEcheqs ?? []).length > 0 && (
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
        <article className="stat-card"><div className="stat-icon coral"><UtensilsCrossed size={19} /></div><div className="stat-label">Viandas para mañana</div><div className="stat-value-row"><strong>{totalViandas}</strong></div><p>{formatDay(tomorrow)}</p></article>
        <article className="stat-card"><div className="stat-icon blue"><Users size={19} /></div><div className="stat-label">Empleados activos</div><div className="stat-value-row"><strong>{employees ?? 0}</strong></div><p>{spaceWide ? 'en el espacio' : 'en tu empresa'}</p></article>
        {spaceWide && <article className="stat-card"><div className="stat-icon sage"><Package size={19} /></div><div className="stat-label">Empresas activas</div><div className="stat-value-row"><strong>{companies ?? 0}</strong></div><p>con servicio habilitado</p></article>}
        <article className="stat-card"><div className="stat-icon gold"><ClipboardList size={19} /></div><div className="stat-label">Semana de mañana</div><div className="stat-value-row"><strong>{week?.status === 'PUBLISHED' ? 'Publicada' : week ? 'Borrador' : 'Sin semana'}</strong></div><p>{week ? `${formatDay(week.week_start)} al ${formatDay(week.week_end)}` : 'Todavía no está cargada'}</p></article>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Para producir mañana</h2><p className="muted">{formatDay(tomorrow)}</p></div>
          <Link className="text-button" href={`/reportes?fecha=${tomorrow}`}>Ver reportes</Link>
        </div>
        {rows.length === 0 ? <EmptyState title="Todavía no hay elecciones" description="Cuando los empleados confirmen el menú, acá vas a ver las cantidades." /> : (
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
