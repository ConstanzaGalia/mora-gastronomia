'use client'

import { useActionState, useState } from 'react'
import { importEmployees, type ImportState } from '@/lib/actions/people'
import { downloadEmployeeTemplate, parseEmployeeFile, type EmployeeSheetRow } from '@/lib/employee-sheet'

const initial: ImportState = { error: '', created: 0, linked: 0, skipped: 0, issues: [] }

export function EmployeeImportForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(importEmployees, initial)
  const [fileError, setFileError] = useState('')
  const [rows, setRows] = useState<EmployeeSheetRow[]>([])
  const [fileName, setFileName] = useState('')

  return (
    <div className="employee-import">
      <p className="muted">Descargá el modelo de Excel, completá apellido, nombre y DNI, y volvé a subirlo. La fila de ejemplo no se importa. Los empleados entran con su DNI como usuario y contraseña.</p>
      <div className="import-actions">
        <button className="outline-button" type="button" onClick={downloadEmployeeTemplate}>Descargar modelo Excel</button>
        <label className="field">
          Archivo
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              setFileError('')
              setRows([])
              setFileName('')
              if (!file) return
              const parsed = await parseEmployeeFile(file)
              if (parsed.error) {
                setFileError(parsed.error)
                return
              }
              setFileName(file.name)
              setRows(parsed.rows)
            }}
          />
        </label>
      </div>
      {fileName && <p className="muted">{fileName} · {rows.length === 1 ? '1 empleado' : `${rows.length} empleados`}</p>}
      {fileError && <p className="error-banner">{fileError}</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>APELLIDO</th><th>NOMBRE</th><th>DNI</th></tr></thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr key={`${row.line}-${row.dni}`}>
                  <td>{row.apellido}</td>
                  <td>{row.nombre}</td>
                  <td>{row.dni}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && <p className="muted">Se van a importar {rows.length}. Acá se muestran las primeras 8 filas.</p>}
        </div>
      )}
      <form action={action} className="stack-form">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />
        {state.error && <p className="error-banner">{state.error}</p>}
        {state.created + state.linked + state.skipped > 0 && (
          <p className="success-banner">
            {[
              state.created ? `${state.created} ${state.created === 1 ? 'alta nueva' : 'altas nuevas'}` : '',
              state.linked ? `${state.linked} ${state.linked === 1 ? 'cuenta reutilizada' : 'cuentas reutilizadas'}` : '',
              state.skipped ? `${state.skipped} ya estaban en la empresa` : '',
            ].filter(Boolean).join(' · ')}.
          </p>
        )}
        {state.issues.length > 0 && (
          <ul className="plain-list import-issues">
            {state.issues.map((issue) => (
              <li key={`${issue.line}-${issue.dni}`}>{issue.line ? `Fila ${issue.line}` : 'Fila'}{issue.dni ? ` · DNI ${issue.dni}` : ''}: {issue.message}</li>
            ))}
          </ul>
        )}
        <button className="primary-button" type="submit" disabled={pending || rows.length === 0}>
          {pending ? 'Importando…' : 'Importar empleados'}
        </button>
      </form>
    </div>
  )
}
