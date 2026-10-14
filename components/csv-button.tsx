'use client'

function toCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

export function CsvButton({ filename, rows, label = 'Descargar CSV' }: { filename: string; rows: string[][]; label?: string }) {
  return (
    <button
      className="outline-button"
      type="button"
      onClick={() => {
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
      }}
    >
      {label}
    </button>
  )
}
