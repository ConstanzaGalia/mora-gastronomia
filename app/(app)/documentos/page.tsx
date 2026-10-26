import { FileDown } from 'lucide-react'
import { DocumentCategoryForm, DocumentUploadForm } from '@/components/document-forms'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { deleteDocument, openDocument } from '@/lib/actions/documents'
import { businessToday, daysBetween, dueLabel, formatDay } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; categoria?: string }>
}) {
  const { error, q, categoria } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const supabase = await createClient()
  const [{ data: categories }, { data: documents }] = await Promise.all([
    supabase
      .from('document_categories')
      .select('id, name')
      .eq('business_space_id', session.spaceId)
      .order('name'),
    supabase
      .from('space_documents')
      .select('id, title, original_name, file_size, issued_on, expires_on, created_at, category_id')
      .eq('business_space_id', session.spaceId)
      .order('created_at', { ascending: false }),
  ])

  const categoryName = new Map((categories ?? []).map((category) => [category.id, category.name]))
  const categoryList = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    documents: (documents ?? []).filter((document) => document.category_id === category.id).length,
  }))
  const term = (q ?? '').trim().toLowerCase()
  const today = businessToday()
  const rows = (documents ?? []).filter((document) => {
    if (categoria && document.category_id !== categoria) return false
    if (!term) return true
    const name = categoryName.get(document.category_id) ?? ''
    return [document.title, document.original_name, name].some((value) => value.toLowerCase().includes(term))
  })

  return (
    <>
      <PageHeader
        eyebrow="ARCHIVO"
        title="Documentos"
        description="Habilitaciones, certificados de fumigación y otros archivos del espacio."
        action={
          <div className="header-actions">
            <FormDialog title="Categorías" trigger="Categorías" triggerClassName="outline-button">
              <p className="muted">El nombre no se puede repetir. Si ya existe Habilitaciones, no se puede crear otra igual.</p>
              <DocumentCategoryForm categories={categoryList} />
            </FormDialog>
            <FormDialog title="Subir documento" trigger="Subir documento" wide>
              <DocumentUploadForm categories={categoryList.map((category) => ({ id: category.id, name: category.name }))} />
            </FormDialog>
          </div>
        }
      />
      {error && <p className="error-banner">{error}</p>}
      <FilterForm className="form-row document-filters">
        <label className="field">
          Categoría
          <select name="categoria" defaultValue={categoria ?? ''}>
            <option value="">Todas</option>
            {categoryList.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="field">
          Buscar
          <input name="q" defaultValue={q ?? ''} placeholder="Título, archivo o categoría" />
        </label>
        <button className="outline-button" type="submit">Buscar</button>
      </FilterForm>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Listado</h2>
            <p className="muted">{rows.length === 1 ? '1 documento.' : `${rows.length} documentos.`}</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={documents?.length ? 'No hay coincidencias' : 'Todavía no hay documentos'}
            description={documents?.length ? 'Probá con otra categoría o búsqueda.' : 'Creá una categoría y subí el primer archivo.'}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DOCUMENTO</th>
                  <th>CATEGORÍA</th>
                  <th>ARCHIVO</th>
                  <th>EMITIDO</th>
                  <th>VENCE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((document) => {
                  const days = document.expires_on ? daysBetween(today, document.expires_on) : null
                  const expired = days !== null && days < 0
                  const dueSoon = days !== null && days >= 0 && days <= 30
                  return (
                    <tr key={document.id} className={expired ? 'echeq-overdue' : dueSoon ? 'echeq-soon' : undefined}>
                      <td>{document.title}</td>
                      <td>{categoryName.get(document.category_id) ?? '—'}</td>
                      <td>
                        {document.original_name}
                        <small className="file-meta">{formatBytes(document.file_size)}</small>
                      </td>
                      <td>{document.issued_on ? formatDay(document.issued_on) : '—'}</td>
                      <td>
                        {document.expires_on ? (
                          <StatusBadge tone={expired ? 'locked' : dueSoon ? 'editing' : 'success'}>
                            {dueLabel(today, document.expires_on)}
                          </StatusBadge>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="row-buttons">
                          <form action={openDocument}>
                            <input type="hidden" name="id" value={document.id} />
                            <button className="outline-button icon-action" type="submit" aria-label="Abrir" title="Abrir">
                              <FileDown size={15} />
                            </button>
                          </form>
                          <DeleteButton
                            action={deleteDocument}
                            name={`el documento ${document.title}`}
                            label="Eliminar documento"
                            fields={{ id: document.id }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
