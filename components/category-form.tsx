'use client'

import { useActionState } from 'react'
import { useDialogClose } from '@/components/form-dialog'
import { saveCompanyCategories } from '@/lib/actions/catalog'

export function CategoryForm({
  companyId,
  categories,
  enabledIds,
}: {
  companyId: string
  categories: { id: string; name: string; active: boolean }[]
  enabledIds: string[]
}) {
  const close = useDialogClose()
  const [state, action, pending] = useActionState(async (prev: { error: string }, formData: FormData) => {
    const next = await saveCompanyCategories(prev, formData)
    if (!next.error) close()
    return next
  }, { error: '' })
  const enabled = new Set(enabledIds)
  return (
    <form action={action} className="stack-form category-form">
      <input type="hidden" name="company_id" value={companyId} />
      {categories.filter((category) => category.active || enabled.has(category.id)).map((category) => (
        <label key={category.id} className="check-line">
          <input type="checkbox" name="category_id" value={category.id} defaultChecked={enabled.has(category.id)} />
          {category.name}{!category.active ? ' (inactiva en el catálogo)' : ''}
        </label>
      ))}
      {state.error && <p className="error-banner">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar categorías'}</button>
    </form>
  )
}
