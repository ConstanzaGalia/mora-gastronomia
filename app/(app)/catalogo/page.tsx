import { AddCatalogButton, CatalogList } from '@/components/catalog-forms'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('gastronomic_categories')
    .select('id, name, active, sort_order, gastronomic_options(id, name, active, sort_order)')
    .eq('business_space_id', session.spaceId)
    .order('sort_order')

  const list = categories ?? []
  const activeCategories = list.filter((category) => category.active).map((category) => ({ id: category.id, name: category.name }))

  return (
    <>
      <PageHeader
        eyebrow={`CATÁLOGO DE ${session.spaceName.toUpperCase()}`}
        title="Catálogo gastronómico"
        description="Las opciones son del espacio. Las empresas solo eligen qué categorías tienen."
        action={<AddCatalogButton categories={activeCategories} />}
      />
      {error && <p className="error-banner">{error}</p>}
      {list.length === 0 ? <EmptyState title="El catálogo está vacío" description="Creá la primera categoría, por ejemplo Bandeja." /> : (
        <CatalogList categories={list} />
      )}
    </>
  )
}
