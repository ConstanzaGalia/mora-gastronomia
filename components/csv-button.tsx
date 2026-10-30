'use client'

function csvCell(value: string) {
  const text = String(value ?? '')
  if (/[;"\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function toCsv(rows: string[][]) {
  const body = rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
  return `\uFEFF${body}`
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
