import { dinerLabel, type Diner, type DinerCategory, type DinerGroup } from '@/lib/diners'

export function DinerTable({
  categories,
  diners,
  groups,
}: {
  categories: DinerCategory[]
  diners: Diner[]
  groups?: DinerGroup[] | null
}) {
  const columns = categories.length + 1
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>EMPLEADO</th>
            {categories.map((category) => <th key={category.id}>{category.name}</th>)}
          </tr>
        </thead>
        {groups && groups.length > 0 ? groups.map((group) => (
          <tbody className="diner-sector" key={group.id}>
            <tr className="diner-sector-row">
              <th colSpan={columns}>{group.name}</th>
            </tr>
            {group.diners.map((diner) => (
              <DinerRow key={diner.id} diner={diner} categories={categories} />
            ))}
          </tbody>
        )) : (
          <tbody>
            {diners.map((diner) => (
              <DinerRow key={diner.id} diner={diner} categories={categories} />
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function DinerRow({ diner, categories }: { diner: Diner; categories: DinerCategory[] }) {
  return (
    <tr>
      <td>{dinerLabel(diner)}</td>
      {categories.map((category) => <td key={category.id}>{diner.choices[category.id] ?? '—'}</td>)}
    </tr>
  )
}
