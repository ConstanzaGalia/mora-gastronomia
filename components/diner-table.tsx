import { dinerLabel, type Diner, type DinerCategory } from '@/lib/diners'

export function DinerTable({ categories, diners }: { categories: DinerCategory[]; diners: Diner[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>EMPLEADO</th>
            {categories.map((category) => <th key={category.id}>{category.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {diners.map((diner) => (
            <tr key={diner.id}>
              <td>{dinerLabel(diner)}</td>
              {categories.map((category) => <td key={category.id}>{diner.choices[category.id] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
