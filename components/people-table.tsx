'use client'

import { useMemo, useState } from 'react'
import { PersonActions } from '@/components/person-actions'
import { StatusBadge } from '@/components/status-badge'
import { ROLE_LABEL, digits, foldSearch, formatDay, type AppRole } from '@/lib/format'
import type { CompanySector } from '@/lib/sectors'

export type CompanyPerson = {
  membershipId: string
  profileId: string | null
  nombre: string
  apellido: string
  dni: string
  email: string
  sectorLabel: string
  role: AppRole
  startedAt: string
  endedAt: string | null
  status: string
  sectorId: string | null
  showSector: boolean
  canEnd: boolean
  canDelete?: boolean
}

function matches(person: CompanyPerson, query: string) {
  const term = foldSearch(query)
  if (!term) return true
  const haystack = foldSearch([
    person.apellido,
    person.nombre,
    `${person.apellido} ${person.nombre}`,
    `${person.apellido}, ${person.nombre}`,
    person.dni,
    person.email,
    person.sectorLabel,
    ROLE_LABEL[person.role] ?? person.role,
    person.status === 'ACTIVE' ? 'vigente' : 'cerrada',
  ].join(' '))
  if (haystack.includes(term)) return true
  const dniTerm = digits(query)
  return dniTerm.length > 0 && digits(person.dni).includes(dniTerm)
}

function comparePeople(a: CompanyPerson, b: CompanyPerson) {
  const last = a.apellido.localeCompare(b.apellido, 'es', { sensitivity: 'base' })
  if (last !== 0) return last
  const first = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  if (first !== 0) return first
  return a.dni.localeCompare(b.dni, 'es')
}

export function PeopleTable({
  people,
  companyId,
  next,
  sectors,
}: {
  people: CompanyPerson[]
  companyId: string
  next: string
  sectors: CompanySector[]
}) {
  const [query, setQuery] = useState('')
  const visible = useMemo(
    () => [...people].sort(comparePeople).filter((person) => matches(person, query)),
    [people, query],
  )
  const searching = query.trim().length > 0

  return (
    <div className="people-table">
      <label className="field catalog-search people-search">
        Buscar
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, apellido, DNI o email"
          autoComplete="off"
        />
      </label>
      {searching && (
        <p className="muted">{visible.length === 1 ? '1 coincidencia.' : `${visible.length} coincidencias.`}</p>
      )}
      {visible.length === 0 ? (
        <p className="muted">{searching ? 'No hay coincidencias para esa búsqueda.' : 'Todavía no hay personas.'}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PERSONA</th>
                <th>DNI</th>
                <th>EMAIL</th>
                <th>SECTOR</th>
                <th>ROL</th>
                <th>DESDE</th>
                <th>HASTA</th>
                <th>ESTADO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.membershipId}>
                  <td>{person.apellido || person.nombre ? `${person.apellido}, ${person.nombre}`.replace(/^, |, $/g, '') : '—'}</td>
                  <td>{person.dni || '—'}</td>
                  <td>{person.email || '—'}</td>
                  <td>{person.sectorLabel}</td>
                  <td>{ROLE_LABEL[person.role]}</td>
                  <td>{formatDay(person.startedAt)}</td>
                  <td>{person.endedAt ? formatDay(person.endedAt) : '—'}</td>
                  <td>
                    <StatusBadge tone={person.status === 'ACTIVE' ? 'success' : 'muted'}>
                      {person.status === 'ACTIVE' ? 'Vigente' : 'Cerrada'}
                    </StatusBadge>
                  </td>
                  <td>
                    {person.profileId && (
                      <PersonActions
                        membershipId={person.membershipId}
                        companyId={companyId}
                        profileId={person.profileId}
                        nombre={person.nombre}
                        apellido={person.apellido}
                        canEnd={person.canEnd}
                        canDelete={person.canDelete}
                        next={next}
                        sectors={sectors}
                        sectorId={person.sectorId}
                        showSector={person.showSector}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
