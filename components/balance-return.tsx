import { balanceFields, type BalanceQuery } from '@/lib/balance'

export function BalanceReturn({ query }: { query: BalanceQuery }) {
  const fields = balanceFields(query)
  return (
    <>
      {Object.entries(fields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    </>
  )
}
