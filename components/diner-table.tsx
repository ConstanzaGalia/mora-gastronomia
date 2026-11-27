'use client'

import { useMemo, useState } from 'react'
import { CancelMenuButton } from '@/components/cancel-menu-button'
import { PrintLabelButton } from '@/components/print-label-button'
import { dinerLabel, type Diner, type DinerCategory, type DinerGroup } from '@/lib/diners'
import { digits, foldSearch, mealShiftLabel } from '@/lib/format'

function matchesDiner(diner: Diner, query: string, sectorName: string) {
  const term = foldSearch(query)
  if (!term) return true
  const haystack = foldSearch([
    diner.apellido,
    diner.nombre,
    `${diner.apellido} ${diner.nombre}`,
    `${diner.apellido}, ${diner.nombre}`,
    diner.dni,
    sectorName,
    mealShiftLabel(diner.mealShift),
  ].join(' '))
  if (haystack.includes(term)) return true
  const dniTerm = digits(query)
  return dniTerm.length > 0 && digits(diner.dni).includes(dniTerm)
}

export function DinerTable({
  categories,
  diners,
  groups,
  searchable = false,
  cancelBack,
  showMealShift = false,
  companyId,
  companyName,
  date,
  showPrintButton = false,
}: {
  categories: DinerCategory[]
  diners: Diner[]
  groups?: DinerGroup[] | null
  searchable?: boolean
  cancelBack?: string
  showMealShift?: boolean
  companyId?: string
  companyName?: string
  date?: string
  showPrintButton?: boolean
}) {
  const [query, setQuery] = useState('')
  const sectorName = useMemo(() => {
    const names = new Map<string, string>()
    for (const group of groups ?? []) {
      for (const diner of group.diners) names.set(diner.id, group.name)
    }
    return names
  }, [groups])

  const visibleDiners = useMemo(
    () => diners.filter((diner) => matchesDiner(diner, query, sectorName.get(diner.id) ?? '')),
    [diners, query, sectorName],
  )
  const visibleIds = useMemo(() => new Set(visibleDiners.map((diner) => diner.id)), [visibleDiners])
  const visibleGroups = useMemo(
    () => (groups ?? []).map((group) => ({
      ...group,
      diners: group.diners.filter((diner) => visibleIds.has(diner.id)),
    })).filter((group) => group.diners.length > 0),
    [groups, visibleIds],
  )
  const searching = query.trim().length > 0
  const columns = categories.length + 1 + (showMealShift ? 1 : 0) + (cancelBack ? 1 : 0) + (showPrintButton ? 1 : 0)
  const listed = searchable ? visibleDiners : diners
  const listedGroups = searchable && groups ? visibleGroups : groups

  return (
    <div className="diner-table">
      {searchable && (
        <label className="field catalog-search people-search">
          Buscar
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={showMealShift ? 'Nombre, apellido, DNI, sector o turno' : 'Nombre, apellido, DNI o sector'}
            autoComplete="off"
          />
        </label>
      )}
      {searchable && searching && (
        <p className="muted">{listed.length === 1 ? '1 coincidencia.' : `${listed.length} coincidencias.`}</p>
      )}
      {listed.length === 0 ? (
        searchable ? <p className="muted">{searching ? 'No hay coincidencias para esa búsqueda.' : 'Todavía no hay personas.'}</p> : null
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EMPLEADO</th>
                {showMealShift ? <th>TURNO</th> : null}
                {categories.map((category) => <th key={category.id}>{category.name}</th>)}
                {cancelBack ? <th /> : null}
                {showPrintButton ? <th>ETIQUETA</th> : null}
              </tr>
            </thead>
            {listedGroups && listedGroups.length > 0 ? listedGroups.map((group) => (
              <tbody className="diner-sector" key={group.id}>
                <tr className="diner-sector-row">
                  <th colSpan={columns}>{group.name}</th>
                </tr>
                {group.diners.map((diner) => (
                  <DinerRow 
                    key={diner.id} 
                    diner={diner} 
                    categories={categories} 
                    cancelBack={cancelBack} 
                    showMealShift={showMealShift}
                    companyId={companyId}
                    companyName={companyName}
                    date={date}
                    showPrintButton={showPrintButton}
                    sectorName={group.name}
                  />
                ))}
              </tbody>
            )) : (
              <tbody>
                {listed.map((diner) => {
                  const sectorName = groups?.find(g => g.diners.some(gd => gd.id === diner.id))?.name;
                  return (
                    <DinerRow 
                      key={diner.id} 
                      diner={diner} 
                      categories={categories} 
                      cancelBack={cancelBack} 
                      showMealShift={showMealShift}
                      companyId={companyId}
                      companyName={companyName}
                      date={date}
                      showPrintButton={showPrintButton}
                      sectorName={sectorName}
                    />
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

function DinerRow({
  diner,
  categories,
  cancelBack,
  showMealShift,
  companyId,
  companyName,
  date,
  showPrintButton,
  sectorName,
}: {
  diner: Diner
  categories: DinerCategory[]
  cancelBack?: string
  showMealShift: boolean
  companyId?: string
  companyName?: string
  date?: string
  showPrintButton?: boolean
  sectorName?: string
}) {
  return (
    <tr>
      <td>
        {dinerLabel(diner)}
        {!diner.membershipActive ? <span className="muted"> · baja</span> : null}
      </td>
      {showMealShift ? <td>{diner.selectionId || Object.keys(diner.choices).length > 0 ? mealShiftLabel(diner.mealShift) : '—'}</td> : null}
      {categories.map((category) => <td key={category.id}>{diner.choices[category.id] ?? '—'}</td>)}
      {cancelBack ? (
        <td>
          {diner.selectionId ? (
            <CancelMenuButton selectionId={diner.selectionId} personName={dinerLabel(diner)} back={cancelBack} />
          ) : null}
        </td>
      ) : null}
      {showPrintButton && companyId && companyName && date ? (
        <td>
          {diner.selectionId || Object.keys(diner.choices).length > 0 ? (
            <PrintLabelButton
              dinerId={diner.id}
              dinerName={diner.nombre}
              dinerSurname={diner.apellido}
              sector={sectorName}
              company={companyName}
              companyId={companyId}
              date={date}
              shift={diner.mealShift}
            />
          ) : null}
        </td>
      ) : null}
    </tr>
  )
}
