-- Permite a los administradores del espacio borrar catálogo, empresas,
-- vínculos de personas y categorías contratadas. Las claves foráneas
-- siguen impidiendo borrar lo que ya tiene elecciones.

create policy gastronomic_categories_delete on public.gastronomic_categories
  for delete to authenticated
  using (private.has_space_access(business_space_id));

create policy gastronomic_options_delete on public.gastronomic_options
  for delete to authenticated
  using (private.has_space_access(private.category_space(category_id)));

create policy companies_delete on public.companies
  for delete to authenticated
  using (private.has_space_access(business_space_id));

create policy cgc_delete on public.company_gastronomic_categories
  for delete to authenticated
  using (private.has_space_access(business_space_id));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (
    private.is_org_admin(organization_id)
    or (business_space_id is not null and private.is_space_admin(business_space_id))
    or (role = 'EMPLOYEE' and company_id is not null and private.is_company_admin(company_id))
  );
