import { DinerCalendar } from '@/components/diner-calendar'
import { EmptyState } from '@/components/empty-state'
import { ExtrasForm } from '@/components/extras-form'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { businessToday, formatDay } from '@/lib/format'
import { buildMenuGroups } from '@/lib/menu'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function PedidosEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; empresa?: string; error?: string }>
}) {
  const { fecha, empresa, error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : businessToday()
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('id, nombre_comercial')
    .eq('business_space_id', session.spaceId)
    .eq('active', true)
    .order('nombre_comercial')
  const companyList = companies ?? []
  const companyId = companyList.find((company) => company.id === empresa)?.id ?? companyList[0]?.id ?? null
  const companyName = companyList.find((company) => company.id === companyId)?.nombre_comercial ?? ''

  if (!companyId) {
    return (
      <>
        <PageHeader
          eyebrow="PEDIDOS POR EMPRESA"
          title="Pedido grupal"
          description="Para empresas que no eligen por DNI: cargá acá lo que mandaron por WhatsApp, plato por plato."
        />
        <EmptyState title="No hay empresas activas" description="Cuando haya una empresa en el espacio, podés cargar el pedido acá." />
      </>
    )
  }

  const { data: day } = await supabase
    .from('calendar_days')
    .select('id, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', session.spaceId)
    .eq('service_date', date)
    .maybeSingle()
  const week = Array.isArray(day?.calendar_weeks) ? day.calendar_weeks[0] : day?.calendar_weeks
  const dayId = day?.is_service_day && week?.status === 'PUBLISHED' ? day.id : null

  const [{ data: availability }, { data: enabled }, { data: extras }] = await Promise.all([
    dayId
      ? supabase.from('daily_availability').select('category_id, option_id, sort_order, gastronomic_categories(name, sort_order), gastronomic_options(name, active)').eq('calendar_day_id', dayId)
      : Promise.resolve({ data: [] }),
    supabase.from('company_gastronomic_categories').select('category_id').eq('company_id', companyId).eq('active', true),
    dayId
      ? supabase.from('company_day_extras').select('option_id, quantity').eq('calendar_day_id', dayId).eq('company_id', companyId)
      : Promise.resolve({ data: [] }),
  ])

  const enabledIds = new Set((enabled ?? []).map((row) => row.category_id))
  const menu = buildMenuGroups(availability ?? [], enabledIds)
  const extraByOption = new Map((extras ?? []).map((row) => [row.option_id, row.quantity]))
  const loaded = menu.flatMap((group) => group.options.filter((option) => Number(extraByOption.get(option.id) ?? 0) > 0).map((option) => ({
    category: group.name,
    name: option.name,
    quantity: Number(extraByOption.get(option.id) ?? 0),
  })))
  const total = loaded.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <>
      <PageHeader
        eyebrow="PEDIDOS POR EMPRESA"
        title={companyName}
        description="Para empresas que no eligen por DNI: cargá acá lo que mandaron por WhatsApp, plato por plato. Entra en Reportes como extras."
      />
      <div className="report-filters">
        <DinerCalendar date={date} empresa={companyId} path="/pedidos-empresa" />
        <FilterForm className="form-row">
          <input type="hidden" name="fecha" value={date} />
          <label className="field">
            Empresa
            <select name="empresa" defaultValue={companyId}>
              {companyList.map((company) => <option key={company.id} value={company.id}>{company.nombre_comercial}</option>)}
            </select>
          </label>
        </FilterForm>
      </div>
      {error && <p className="error-banner">{error}</p>}
      {!dayId ? (
        <EmptyState title={`Sin menú el ${formatDay(date)}`} description="Ese día no está publicado como día de servicio." />
      ) : menu.length === 0 ? (
        <EmptyState title="Sin categorías habilitadas" description="Habilitá bandeja, postre o bebida en la ficha de la empresa." />
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Pedido grupal</h2>
                <p className="muted">Cantidades por plato del menú de {formatDay(date)}. Si la empresa también tiene elecciones individuales, esto se suma aparte.</p>
              </div>
            </div>
            <ExtrasForm
              date={date}
              dayId={dayId}
              companyId={companyId}
              submitLabel="Guardar pedido"
              groups={menu.map((group) => ({
                id: group.id,
                name: group.name,
                options: group.options.map((option) => ({
                  id: option.id,
                  name: option.name,
                  quantity: Number(extraByOption.get(option.id) ?? 0),
                })),
              }))}
            />
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Resumen</h2>
                <p className="muted">{total === 0 ? 'Todavía no hay cantidades.' : total === 1 ? '1 unidad cargada.' : `${total} unidades cargadas.`}</p>
              </div>
            </div>
            {loaded.length === 0 ? (
              <p className="muted">Cuando guardes el pedido, el detalle aparece acá y en Reportes.</p>
            ) : (
              <div className="report-bars">
                {loaded.map((row) => (
                  <div className="report-row" key={`${row.category}-${row.name}`}>
                    <span>{row.category} · {row.name}</span>
                    <strong>{row.quantity}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
