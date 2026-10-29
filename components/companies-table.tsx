'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { StatusBadge } from '@/components/status-badge'
import { deleteCompany } from '@/lib/actions/companies'
import { initials, matchesSearch } from '@/lib/format'

export type CompanyListRow = {
  id: string
  nombre_comercial: string
  razon_social: string | null
  cuit: string | null
  active: boolean
  employees: number
  managers: number
  categories: string[]
  tone: 'sage' | 'blue' | 'gold'
}

export function CompaniesTable({ companies }: { companies: CompanyListRow[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(
    () => companies.filter((company) => matchesSearch(company.nombre_comercial, query)),
    [companies, query],
  )
  const searching = query.trim().length > 0

  return (
    <div className="companies-table">
      <label className="field catalog-search people-search">
        Buscar
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre comercial"
          autoComplete="off"
        />
      </label>
      {searching && (
        <p className="muted">{visible.length === 1 ? '1 coincidencia.' : `${visible.length} coincidencias.`}</p>
      )}
      {visible.length === 0 ? (
        <p className="muted">{searching ? 'No hay coincidencias para esa búsqueda.' : 'Todavía no hay empresas.'}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EMPRESA</th>
                <th>RAZÓN SOCIAL</th>
                <th>CUIT</th>
                <th>CATEGORÍAS</th>
                <th>EMPLEADOS</th>
                <th>ENCARGADO</th>
                <th>ESTADO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((company) => (
                <tr key={company.id}>
                  <td>
                    <Link href={`/empresas/${company.id}`} className="company-cell">
                      <div className={`company-logo ${company.tone}`}>{initials(company.nombre_comercial)}</div>
                      <strong>{company.nombre_comercial}</strong>
                    </Link>
                  </td>
                  <td>{company.razon_social ?? '—'}</td>
                  <td>{company.cuit ?? '—'}</td>
                  <td>
                    {company.categories.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="category-chips table-chips">
                        {company.categories.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{company.employees}</td>
                  <td>{company.managers}</td>
                  <td>
                    <StatusBadge tone={company.active ? 'success' : 'muted'}>
                      {company.active ? 'Activa' : 'Inactiva'}
                    </StatusBadge>
                  </td>
                  <td>
                    <DeleteButton action={deleteCompany} name={company.nombre_comercial} fields={{ id: company.id, from: '/empresas' }} />
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
