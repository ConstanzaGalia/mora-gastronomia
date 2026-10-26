export type EmployeeSheetRow = {
  apellido: string
  nombre: string
  dni: string
  line: number
}

const HEADER_ALIASES: Record<string, 'apellido' | 'nombre' | 'dni'> = {
  apellido: 'apellido',
  apellidos: 'apellido',
  nombre: 'nombre',
  nombres: 'nombre',
  dni: 'dni',
  documento: 'dni',
  documentonro: 'dni',
  nrodocumento: 'dni',
  nrodedocumento: 'dni',
  numerodedocumento: 'dni',
}

const MAX_ROWS = 400

export function downloadEmployeeTemplate() {
  const blob = new Blob([employeeTemplateXlsx()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-empleados.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export async function parseEmployeeFile(file: File): Promise<{ rows: EmployeeSheetRow[]; error: string }> {
  if (file.size > 1_500_000) return { rows: [], error: 'El archivo es demasiado grande. Usá uno de hasta 1,5 MB.' }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    try {
      const files = await unzipStrings(buffer)
      return parseWorkbook(files)
    } catch {
      return { rows: [], error: 'No se pudo leer el Excel. Descargá el modelo y guardalo como .xlsx o .csv.' }
    }
  }
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
  if (text.includes('urn:schemas-microsoft-com:office:spreadsheet')) {
    return parseSpreadsheetMl(text)
  }
  return parseCsv(text)
}

export function parseCsv(text: string): { rows: EmployeeSheetRow[]; error: string } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const first = lines.find((line) => line.trim())
  if (!first) return { rows: [], error: 'El archivo está vacío.' }
  const delimiter = detectDelimiter(first)
  const table = lines.map((line) => splitCsvLine(line, delimiter))
  return tableToRows(table)
}

export function employeeTemplateXlsx() {
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>apellido</t></is></c>
      <c r="B1" t="inlineStr"><is><t>nombre</t></is></c>
      <c r="C1" t="inlineStr"><is><t>dni</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>Pérez</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Ana</t></is></c>
      <c r="C2" t="inlineStr"><is><t>30111000</t></is></c>
    </row>
  </sheetData>
</worksheet>`
  return zipStore([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Empleados" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ])
}

function parseWorkbook(files: Map<string, string>) {
  const shared = parseSharedStrings(files.get('xl/sharedStrings.xml') ?? files.get('/xl/sharedStrings.xml') ?? '')
  const sheetPath = [...files.keys()].find((name) => /xl\/worksheets\/sheet\d+\.xml$/i.test(name.replace(/^\//, '')))
  const sheet = sheetPath ? files.get(sheetPath) ?? files.get(`/${sheetPath}`) : ''
  if (!sheet) return { rows: [], error: 'El Excel no tiene una hoja para leer.' }
  return tableToRows(parseSheetXml(sheet, shared))
}

function parseSharedStrings(xml: string) {
  if (!xml) return []
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const texts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1]))
    return texts.join('')
  })
}

function parseSheetXml(xml: string, shared: string[]) {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map<number, string>()
    let max = -1
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cell[1]
      const inner = cell[2]
      const ref = attrs.match(/\br="([A-Z]+)(\d+)"/)
      const col = ref ? columnIndex(ref[1]) : max + 1
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? ''
      let value = ''
      if (type === 's') {
        const index = Number((inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) ?? [])[1] ?? '')
        value = shared[index] ?? ''
      } else if (type === 'inlineStr') {
        value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1])).join('')
      } else {
        value = decodeXml((inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) ?? [])[1] ?? '')
      }
      cells.set(col, value)
      if (col > max) max = col
    }
    const line = Array.from({ length: max + 1 }, (_, index) => cells.get(index) ?? '')
    rows.push(line)
  }
  return rows
}

function parseSpreadsheetMl(xml: string) {
  const table: string[][] = []
  for (const row of xml.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/g)) {
    const values = [...row[1].matchAll(/<Data\b[^>]*>([\s\S]*?)<\/Data>/g)].map((cell) => decodeXml(cell[1]))
    table.push(values)
  }
  return tableToRows(table)
}

function tableToRows(table: string[][]): { rows: EmployeeSheetRow[]; error: string } {
  const start = table.findIndex((row) => row.some((cell) => headerKey(cell)))
  if (start === -1) return { rows: [], error: 'Falta la fila de títulos: apellido, nombre y DNI.' }
  const header = table[start].map((cell) => headerKey(cell))
  const apellidoIndex = header.indexOf('apellido')
  const nombreIndex = header.indexOf('nombre')
  const dniIndex = header.indexOf('dni')
  if (apellidoIndex < 0 || nombreIndex < 0 || dniIndex < 0) {
    return { rows: [], error: 'El modelo tiene que tener las columnas apellido, nombre y DNI.' }
  }
  const rows: EmployeeSheetRow[] = []
  for (let index = start + 1; index < table.length; index += 1) {
    const row = table[index] ?? []
    const apellido = (row[apellidoIndex] ?? '').trim()
    const nombre = (row[nombreIndex] ?? '').trim()
    const dni = (row[dniIndex] ?? '').trim()
    if (!apellido && !nombre && !dni) continue
    if (isSampleRow(apellido, nombre, dni)) continue
    rows.push({ apellido, nombre, dni, line: index + 1 })
    if (rows.length > MAX_ROWS) return { rows: [], error: `El archivo no puede tener más de ${MAX_ROWS} empleados.` }
  }
  if (rows.length === 0) return { rows: [], error: 'No hay empleados para importar. Completá al menos una fila debajo de los títulos.' }
  return { rows, error: '' }
}

function isSampleRow(apellido: string, nombre: string, dni: string) {
  const last = apellido.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const first = nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const document = dni.replace(/\D/g, '')
  return last === 'perez' && first === 'ana' && document === '30111000'
}

function headerKey(value: string) {
  const key = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return HEADER_ALIASES[key] ?? ''
}

function detectDelimiter(line: string) {
  const comma = (line.match(/,/g) ?? []).length
  const semi = (line.match(/;/g) ?? []).length
  const tab = (line.match(/\t/g) ?? []).length
  if (tab > comma && tab > semi) return '\t'
  return semi > comma ? ';' : ','
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function columnIndex(letters: string) {
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

async function unzipStrings(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const files = new Map<string, string>()
  let offset = 0
  const decoder = new TextDecoder()
  while (offset + 30 <= view.byteLength) {
    if (view.getUint32(offset, true) !== 0x04034b50) break
    const flags = view.getUint16(offset + 6, true)
    const method = view.getUint16(offset + 8, true)
    let compressed = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const name = decoder.decode(new Uint8Array(buffer, offset + 30, nameLen))
    let dataStart = offset + 30 + nameLen + extraLen
    if (flags & 0x8) {
      const rest = new Uint8Array(buffer, dataStart)
      const descriptor = findDescriptor(rest)
      compressed = descriptor.size
      const data = rest.subarray(0, compressed)
      files.set(name, decoder.decode(method === 8 ? await inflateRaw(data) : data))
      offset = dataStart + compressed + descriptor.skip
      continue
    }
    const data = new Uint8Array(buffer, dataStart, compressed)
    files.set(name, decoder.decode(method === 8 ? await inflateRaw(data) : data))
    offset = dataStart + compressed
  }
  return files
}

function findDescriptor(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length - 15; index += 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x07 && bytes[index + 3] === 0x08) {
      const size = bytes[index + 8] | (bytes[index + 9] << 8) | (bytes[index + 10] << 16) | (bytes[index + 11] << 24)
      return { size: size >>> 0, skip: 16 }
    }
  }
  throw new Error('zip')
}

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (0xedb88320 ^ (crc >>> 1)) : crc >>> 1
  return crc >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: { name: string; data: string }[]) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.data.replace(/\n/g, '\r\n'))
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)
    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  const total = offset + centralSize + end.length
  const zip = new Uint8Array(total)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) {
    zip.set(part, cursor)
    cursor += part.length
  }
  return zip
}
