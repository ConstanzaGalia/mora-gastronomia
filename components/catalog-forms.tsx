'use client'

import { Ban, Pencil, Power } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { deleteCategory, deleteOption, saveCategory, saveOption, setCategoryActive, setOptionActive, updateCategory, updateOption } from '@/lib/actions/catalog'

type CatalogOption = { id: string; name: string; active: boolean; sort_order: number }
type CatalogCategory = { id: string; name: string; active: boolean; gastronomic_options: CatalogOption[] }

export function AddCatalogButton({ categories }: { categories: { id: string; name: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [formKey, setFormKey] = useState(0)

  function open() {
    setFormKey((value) => value + 1)
    dialog.current?.showModal()
  }

  function close() {
    dialog.current?.close()
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={open}>Agregar al catálogo</button>
      <dialog
        ref={dialog}
        className="company-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) close()
        }}
      >
        <div className="dialog-heading">
          <h2>Agregar al catálogo</h2>
          <button className="outline-button" type="button" onClick={close}>Cerrar</button>
        </div>
        <div key={formKey}>
          <div className="dialog-block">
            <h3>Nueva categoría</h3>
            <p className="muted">Por ejemplo Bandeja, Postre o Bebida.</p>
            <NewCategoryForm onSaved={close} />
          </div>
          <div className="dialog-block">
            <h3>Nueva opción</h3>
            {categories.length === 0 ? (
              <p className="muted">Primero creá una categoría. Después vas a poder sumar opciones.</p>
            ) : (
              <NewOptionForm categories={categories} onSaved={close} />
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}

export function CatalogList({ categories }: { categories: CatalogCategory[] }) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const visible = categories.flatMap((category) => {
    const options = [...category.gastronomic_options].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    if (!term) return [{ ...category, options }]
    const categoryMatch = category.name.toLowerCase().includes(term)
    const matched = categoryMatch ? options : options.filter((option) => option.name.toLowerCase().includes(term))
    if (!categoryMatch && matched.length === 0) return []
    return [{ ...category, options: matched }]
  })

  return (
    <div>
      <label className="field catalog-search">
        Buscar
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Categoría u opción" />
      </label>
      {visible.length === 0 ? <p className="muted">No hay coincidencias para esa búsqueda.</p> : (
        <div className="catalog-grid">
          {visible.map((category) => {
            const total = category.gastronomic_options.length
            const activeCount = category.gastronomic_options.filter((option) => option.active).length
            const countLabel = activeCount === total
              ? `${total} ${total === 1 ? 'opción' : 'opciones'}`
              : `${activeCount} de ${total} activas`
            return (
              <section className="panel" key={category.id}>
                <div className="panel-heading">
                  <div>
                    <h2>{category.name}</h2>
                    <p className="muted">{countLabel}</p>
                  </div>
                  <StatusTone active={category.active} />
                </div>
                <div className="option-list">
                  {category.options.length === 0 ? <p className="muted">Sin opciones.</p> : category.options.map((option) => (
                    <OptionRow key={option.id} option={option} />
                  ))}
                </div>
                <div className="catalog-card-actions">
                  <RenameButton id={category.id} name={category.name} action={updateCategory} />
                  <ToggleActive id={category.id} active={category.active} kind="category" />
                  <DeleteButton action={deleteCategory} name={category.name} fields={{ id: category.id }} />
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OptionRow({ option }: { option: CatalogOption }) {
  return (
    <div className={`option-row${option.active ? '' : ' is-inactive'}`}>
      <span>{option.name}</span>
      <div className="row-actions">
        <RenameButton id={option.id} name={option.name} action={updateOption} />
        <ToggleActive id={option.id} active={option.active} kind="option" />
        <DeleteButton action={deleteOption} name={option.name} fields={{ id: option.id }} />
      </div>
    </div>
  )
}

function RenameButton({
  id,
  name,
  action,
}: {
  id: string
  name: string
  action: (prev: { error: string }, formData: FormData) => Promise<{ error: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(action, { error: '' })
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current && !pending && !state.error) {
      sent.current = false
      setEditing(false)
    }
  }, [pending, state.error])

  if (!editing) {
    return (
      <button className="outline-button icon-action" type="button" aria-label={`Editar ${name}`} title="Editar" onClick={() => setEditing(true)}>
        <Pencil size={15} />
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="inline-rename"
      onSubmit={() => {
        sent.current = true
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input name="name" defaultValue={name} required aria-label={`Editar ${name}`} />
      <button className="outline-button" type="submit" disabled={pending}>{pending ? '…' : 'Guardar'}</button>
      <button className="outline-button" type="button" onClick={() => setEditing(false)}>Cancelar</button>
      {state.error && <p className="error-banner">{state.error}</p>}
    </form>
  )
}

function StatusTone({ active }: { active: boolean }) {
  return <span className={`status-badge ${active ? 'success' : 'muted'}`}>{active ? 'Activa' : 'Inactiva'}</span>
}

function NewCategoryForm({ onSaved }: { onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveCategory, { error: '', saved: false })
  useEffect(() => {
    if (state.saved) onSaved()
  }, [state.saved, onSaved])
  return (
    <form action={action} className="stack-form">
      <label className="field">Nombre<input name="name" required /></label>
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar categoría'}</button>
    </form>
  )
}

function NewOptionForm({ categories, onSaved }: { categories: { id: string; name: string }[]; onSaved: () => void }) {
  const [state, action, pending] = useActionState(saveOption, { error: '', saved: false })
  useEffect(() => {
    if (state.saved) onSaved()
  }, [state.saved, onSaved])
  return (
    <form action={action} className="stack-form">
      <label className="field">Categoría
        <select name="category_id" required>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="field">Nombre<input name="name" required /></label>
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar opción'}</button>
    </form>
  )
}

export function ToggleActive({ id, active, kind }: { id: string; active: boolean; kind: 'category' | 'option' }) {
  const action = kind === 'category' ? setCategoryActive : setOptionActive
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <button className={`outline-button icon-action${active ? ' warn' : ''}`} type="submit" aria-label={active ? 'Desactivar' : 'Activar'} title={active ? 'Desactivar' : 'Activar'}>
        {active ? <Ban size={15} /> : <Power size={15} />}
      </button>
    </form>
  )
}
