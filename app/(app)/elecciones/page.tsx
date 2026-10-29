import { EmptyState } from '@/components/empty-state'
import { ExtrasForm } from '@/components/extras-form'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { saveEmployeeChoice } from '@/lib/actions/choices'
import { businessToday, formatDay } from '@/lib/format'
import { buildMenuGroups } from '@/lib/menu'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EleccionesPage({ searchParams }: { searchParams: Promise<{ fecha?: string; error?: string }> }) {
  const { fecha, error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const date = fecha || businessToday()
  const supabase = await createClient()

  if (session.primary.role !== 'COMPANY_ADMIN' || !session.companyId) {
    let query = supabase
      .from('v_selection_details')
      .select('selection_id, dni, nombre, apellido, company_name, category_name, option_name, status, category_sort_order')
      .eq('service_date', date)
      .order('apellido')
    query = query.eq('business_space_id', session.spaceId)
    const { data } = await query
    const grouped = groupSelections(data ?? [])
    return (
      <>
        <PageHeader eyebrow="ELECCIONES" title="Qué eligió cada persona" description="El detalle respeta la empresa de esa fecha, aunque después la persona cambie." />
        <DateForm date={date} />
        {error && <p className="error-banner">{error}</p>}
        {grouped.length === 0 ? <EmptyState title={`Sin elecciones el ${formatDay(date)}`} description="Cuando haya menú publicado y la gente elija, aparece acá." /> : (
          <SelectionTable rows={grouped} showCompany />
        )}
      </>
    )
  }

  const companyId = session.companyId
  const { data: members } = await supabase
    .from('memberships')
    .select('id, user_id, started_at, ended_at, status, profiles!memberships_user_id_fkey(nombre, apellido, dni)')
    .eq('company_id', companyId)
    .eq('role', 'EMPLOYEE')
    .eq('status', 'ACTIVE')
    .lte('started_at', date)
    .or(`ended_at.is.null,ended_at.gte.${date}`)

  const { data: day } = await supabase
    .from('calendar_days')
    .select('id, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', session.spaceId)
    .eq('service_date', date)
    .maybeSingle()
  const dayId = day?.is_service_day && day.calendar_weeks.status === 'PUBLISHED' ? day.id : null

  const [{ data: details }, { data: availability }, { data: enabled }, { data: extras }, { data: windowOpen }] = await Promise.all([
    supabase
      .from('v_selection_details')
      .select('selection_id, employee_id, category_name, option_name, status, category_sort_order')
      .eq('service_date', date)
      .eq('company_id', companyId)
      .eq('status', 'SUBMITTED'),
    dayId
      ? supabase.from('daily_availability').select('category_id, option_id, sort_order, gastronomic_categories(name, sort_order), gastronomic_options(name, active)').eq('calendar_day_id', dayId)
      : Promise.resolve({ data: [] }),
    supabase.from('company_gastronomic_categories').select('category_id').eq('company_id', companyId).eq('active', true),
    dayId
      ? supabase.from('company_day_extras').select('option_id, quantity').eq('calendar_day_id', dayId).eq('company_id', companyId)
      : Promise.resolve({ data: [] }),
    dayId
      ? supabase.rpc('selection_window_open', { p_calendar_day_id: dayId, p_company_id: companyId })
      : Promise.resolve({ data: false }),
  ])

  const enabledIds = new Set((enabled ?? []).map((row) => row.category_id))
  const menu = buildMenuGroups(availability ?? [], enabledIds)
  const chosenByEmployee = new Map<string, string[]>()
  for (const row of details ?? []) {
    if (!row.employee_id) continue
    const items = chosenByEmployee.get(row.employee_id) ?? []
    if (row.category_name && row.option_name) items.push(`${row.category_name}: ${row.option_name}`)
    chosenByEmployee.set(row.employee_id, items)
  }
  const extraByOption = new Map((extras ?? []).map((row) => [row.option_id, row.quantity]))
  const open = Boolean(windowOpen)
  const people = (members ?? []).map((member) => {
    const profile = member.profiles
    return {
      membershipId: member.id,
      userId: member.user_id,
      name: `${profile?.apellido ?? ''}, ${profile?.nombre ?? ''}`.replace(/^, /, ''),
      dni: profile?.dni ?? '',
      items: chosenByEmployee.get(member.user_id) ?? [],
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <>
      <PageHeader
        eyebrow="ELECCIONES"
        title="Qué eligió cada persona"
        description="Si alguien no eligió y el plazo está abierto, podés elegir por esa persona. Los extras se facturan aparte."
      />
      <DateForm date={date} />
      {error && <p className="error-banner">{error}</p>}
      {!dayId ? <EmptyState title={`Sin menú el ${formatDay(date)}`} description="Ese día no está publicado como día de servicio." /> : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{formatDay(date)}</h2>
                <p className="muted">{open ? 'El plazo está abierto. Quien ya eligió no se puede cambiar desde acá.' : 'El plazo está cerrado. Solo podés mirar.'}</p>
              </div>
            </div>
            {people.length === 0 ? <EmptyState title="No hay empleados activos" description="Las personas activas de la empresa aparecen acá." /> : (
              <div className="choice-list">
                {people.map((person) => (
                  <article className="choice-person" key={person.membershipId}>
                    <div>
                      <strong>{person.name || 'Sin nombre'}</strong>
                      <span>{person.dni}</span>
                    </div>
                    {person.items.length > 0 ? <p>{person.items.join(' · ')}</p> : open ? (
                      <form action={saveEmployeeChoice} className="choice-form">
                        <input type="hidden" name="fecha" value={date} />
                        <input type="hidden" name="membership_id" value={person.membershipId} />
                        <input type="hidden" name="calendar_day_id" value={dayId} />
                        {menu.filter((group) => !group.optional).map((group) => (
                          <span key={group.id}>
                            <input type="hidden" name="required_category" value={group.id} />
                            <input type="hidden" name="required_name" value={group.name} />
                          </span>
                        ))}
                        {menu.filter((group) => group.optional).map((group) => (
                          <input key={group.id} type="hidden" name="optional_name" value={group.name} />
                        ))}
                        {menu.map((group) => (
                          <label className="field" key={group.id}>
                            {group.name}{group.optional ? ' · opcional' : ''}
                            <select name="item" defaultValue="" required={!group.optional}>
                              <option value="">{group.optional ? 'Sin elegir' : 'Elegí'}</option>
                              {group.options.map((option) => (
                                <option key={option.id} value={`${group.id}|${option.id}`}>{option.name}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                        <button className="outline-button" type="submit">Elegir</button>
                      </form>
                    ) : <p className="muted">No eligió.</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
          {menu.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Extras</h2>
                  <p className="muted">Cantidades además de lo que eligió cada persona. Las bandejas extra se facturan aparte.</p>
                </div>
              </div>
              {open ? (
                <ExtrasForm
                  date={date}
                  dayId={dayId}
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
              ) : (
                <div className="report-bars">
                  {menu.flatMap((group) => group.options).filter((option) => Number(extraByOption.get(option.id) ?? 0) > 0).length === 0
                    ? <p className="muted">No hay extras cargados.</p>
                    : menu.flatMap((group) => group.options.filter((option) => Number(extraByOption.get(option.id) ?? 0) > 0).map((option) => (
                      <div className="report-row" key={option.id}>
                        <span>{group.name} · {option.name}</span>
                        <strong>{extraByOption.get(option.id)}</strong>
                      </div>
                    )))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  )
}

function DateForm({ date }: { date: string }) {
  return (
    <FilterForm className="form-row">
      <label className="field">Fecha<input type="date" name="fecha" defaultValue={date} /></label>
    </FilterForm>
  )
}

function SelectionTable({ rows, showCompany }: { rows: GroupedSelection[]; showCompany: boolean }) {
  return (
    <section className="panel">
      <div className="table-wrap">
        <table>
          <thead><tr><th>PERSONA</th><th>DNI</th>{showCompany && <th>EMPRESA</th>}<th>ELECCIÓN</th><th>ESTADO</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.dni}-${row.company}`}>
                <td>{row.name}</td>
                <td>{row.dni}</td>
                {showCompany && <td>{row.company}</td>}
                <td>{row.items.join(' · ') || '—'}</td>
                <td>{row.status === 'CANCELLED' ? 'Anulada' : 'Enviada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type GroupedSelection = { name: string; dni: string; company: string; items: string[]; status: string }

function groupSelections(data: { selection_id: string | null; dni: string | null; nombre: string | null; apellido: string | null; company_name: string | null; category_name: string | null; option_name: string | null; status: string | null; category_sort_order: number | null }[]) {
  const grouped = new Map<string, GroupedSelection & { sort: number[] }>()
  for (const row of data) {
    const key = row.selection_id ?? `${row.dni}-${row.company_name}`
    const current = grouped.get(key) ?? {
      name: `${row.apellido ?? ''}, ${row.nombre ?? ''}`.trim(),
      dni: row.dni ?? '',
      company: row.company_name ?? '',
      items: [],
      status: row.status ?? '',
      sort: [],
    }
    if (row.category_name && row.option_name) {
      current.items.push(`${row.category_name}: ${row.option_name}`)
      current.sort.push(row.category_sort_order ?? 0)
    }
    grouped.set(key, current)
  }
  return [...grouped.values()]
}


