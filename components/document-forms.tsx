'use client'

import { useActionState, useEffect, useState } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { useDialogClose } from '@/components/form-dialog'
import { deleteDocumentCategory, saveDocument, saveDocumentCategory } from '@/lib/actions/documents'

export function DocumentCategoryForm({
  categories,
}: {
  categories: { id: string; name: string; documents: number }[]
}) {
  const close = useDialogClose()
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(saveDocumentCategory, { error: '', saved: false })

  useEffect(() => {
    if (state.saved && !state.error) setFormKey((value) => value + 1)
  }, [state])

  return (
    <div className="document-categories">
      <form action={action} className="stack-form" key={formKey}>
        <label className="field">
          Nombre
          <input name="name" placeholder="Habilitaciones, fumigación…" required />
        </label>
        {state.error && <p className="error-banner">{state.error}</p>}
        {state.saved && !state.error && <p className="success-banner">Categoría creada.</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Creando…' : 'Crear categoría'}</button>
      </form>
      {categories.length === 0 ? <p className="muted">Todavía no hay categorías.</p> : (
        <ul className="option-list">
          {categories.map((category) => (
            <li className="option-row" key={category.id}>
              <span>{category.name}<small> · {category.documents === 1 ? '1 documento' : `${category.documents} documentos`}</small></span>
              {category.documents === 0 && (
                <DeleteButton
                  action={deleteDocumentCategory}
                  name={`la categoría ${category.name}`}
                  label="Eliminar categoría"
                  fields={{ id: category.id }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <button className="outline-button" type="button" onClick={close}>Listo</button>
    </div>
  )
}

export function DocumentUploadForm({ categories }: { categories: { id: string; name: string }[] }) {
  const close = useDialogClose()
  const [state, action, pending] = useActionState(async (prev: { error: string }, formData: FormData) => {
    const next = await saveDocument(prev, formData)
    if (!next.error) close()
    return next
  }, { error: '' })

  if (categories.length === 0) {
    return <p className="muted">Primero creá una categoría, por ejemplo Habilitaciones o Fumigación.</p>
  }

  return (
    <form action={action} className="stack-form dialog-form">
      <label className="field">
        Categoría
        <select name="category_id" required defaultValue="">
          <option value="" disabled>Elegí</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="field">Título<input name="title" placeholder="Habilitación municipal 2026" required /></label>
      <label className="field">Archivo<input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*" required /></label>
      <div className="form-row">
        <label className="field">Emitido<input name="issued_on" type="date" /></label>
        <label className="field">Vence<input name="expires_on" type="date" /></label>
      </div>
      <p className="muted">PDF, Word o imagen, hasta 15 MB.</p>
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Subiendo…' : 'Subir documento'}</button>
    </form>
  )
}
