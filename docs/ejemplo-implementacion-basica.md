# Ejemplo de Implementación Básica - Impresora Térmica

## Guía Rápida de Inicio

Esta guía te permite tener un prototipo funcionando en menos de 1 hora.

## Prerequisitos

- Node.js instalado
- Impresora térmica compatible con ESC/POS conectada por USB o red
- Proyecto Mora Gastronomía corriendo localmente

## Paso 1: Crear el Print Worker

### 1.1 Crear carpeta y archivos

```bash
mkdir print-worker
cd print-worker
npm init -y
npm install express node-thermal-printer cors
```

### 1.2 Crear `print-worker/server.js`

```javascript
const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de la impresora
// Cambia estos valores según tu impresora
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,  // O STAR, TANCA
  interface: 'tcp://192.168.1.100',  // O 'usb://...' para USB
  characterSet: 'PC858_EURO',
  removeSpecialCharacters: false,
  lineCharacter: '=',
  options: {
    timeout: 5000
  }
};

// Función para normalizar texto (quitar acentos)
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N');
}

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Print worker running' });
});

// Endpoint para imprimir etiqueta
app.post('/print', async (req, res) => {
  console.log('Recibida solicitud de impresión:', req.body);
  
  try {
    const { nombre, apellido, sector, empresa, fecha, turno } = req.body;
    
    // Validaciones
    if (!nombre || !apellido) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nombre y apellido son requeridos' 
      });
    }
    
    // Crear instancia de impresora
    const printer = new ThermalPrinter(PRINTER_CONFIG);
    
    // Verificar conexión
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error('Impresora no conectada');
    }
    
    // --- INICIO DE DISEÑO DE ETIQUETA ---
    
    // Encabezado
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println('MORA GASTRONOMIA');
    printer.drawLine();
    printer.bold(false);
    printer.newLine();
    
    // Nombre del empleado (texto grande)
    printer.setTextSize(2, 2);
    printer.bold(true);
    const nombreCompleto = normalizeText(`${apellido}, ${nombre}`).toUpperCase();
    printer.println(nombreCompleto);
    printer.setTextNormal();
    printer.bold(false);
    printer.newLine();
    
    // Información detallada
    printer.alignLeft();
    printer.setTextSize(1, 1);
    
    if (sector) {
      printer.print('Sector: ');
      printer.bold(true);
      printer.println(normalizeText(sector));
      printer.bold(false);
    } else {
      printer.println('Sector: Sin asignar');
    }
    
    printer.print('Empresa: ');
    printer.bold(true);
    printer.println(normalizeText(empresa));
    printer.bold(false);
    
    printer.print('Fecha: ');
    printer.println(fecha);
    
    if (turno) {
      printer.print('Turno: ');
      printer.bold(true);
      const turnoTexto = turno === 'MORNING' ? 'Manana' : 'Tarde';
      printer.println(turnoTexto);
      printer.bold(false);
    }
    
    // Espacio y corte
    printer.newLine();
    printer.newLine();
    printer.cut();
    
    // --- FIN DE DISEÑO DE ETIQUETA ---
    
    // Enviar a impresora
    await printer.execute();
    
    console.log('Etiqueta impresa exitosamente');
    
    res.json({ 
      success: true, 
      message: 'Etiqueta impresa correctamente' 
    });
    
  } catch (error) {
    console.error('Error al imprimir:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

// Endpoint para prueba rápida
app.post('/test', async (req, res) => {
  try {
    const printer = new ThermalPrinter(PRINTER_CONFIG);
    
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      return res.status(500).json({ 
        success: false, 
        error: 'Impresora no conectada' 
      });
    }
    
    printer.alignCenter();
    printer.println('=== PRUEBA DE IMPRESION ===');
    printer.newLine();
    printer.println('Si puede leer esto,');
    printer.println('la impresora funciona!');
    printer.newLine();
    printer.println(new Date().toLocaleString('es-AR'));
    printer.newLine();
    printer.cut();
    
    await printer.execute();
    
    res.json({ success: true, message: 'Prueba impresa' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🖨️  Print Worker escuchando en http://localhost:${PORT}`);
  console.log(`📡 Configuración de impresora: ${PRINTER_CONFIG.interface}`);
  console.log(`✅ Listo para recibir trabajos de impresión`);
});
```

### 1.3 Configurar tu impresora

Edita la constante `PRINTER_CONFIG` en el archivo:

**Para impresora USB:**
```javascript
interface: 'usb://04b8:0e15'  // Vendor:Product ID
```

Para encontrar tu impresora USB en Linux/Mac:
```bash
lsusb
```

En Windows, busca en Administrador de Dispositivos.

**Para impresora en red:**
```javascript
interface: 'tcp://192.168.1.100'  // IP de tu impresora
```

### 1.4 Iniciar el worker

```bash
node server.js
```

### 1.5 Probar la conexión

```bash
curl http://localhost:3001/health
# Debería retornar: {"status":"ok","message":"Print worker running"}

curl -X POST http://localhost:3001/test
# Debería imprimir una etiqueta de prueba
```

## Paso 2: Crear API Route en Next.js

### 2.1 Crear archivo `app/api/labels/print/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PRINT_WORKER_URL = process.env.PRINT_WORKER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validación básica
    if (!body.nombre || !body.apellido) {
      return NextResponse.json(
        { success: false, error: 'Nombre y apellido requeridos' },
        { status: 400 }
      );
    }
    
    // Enviar al print worker
    const response = await fetch(`${PRINT_WORKER_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al imprimir');
    }
    
    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error en API de impresión:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}

// Endpoint de prueba
export async function GET() {
  try {
    const response = await fetch(`${PRINT_WORKER_URL}/health`);
    const result = await response.json();
    return NextResponse.json({ 
      status: 'ok', 
      worker: result 
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'No se puede conectar con el print worker' 
      },
      { status: 500 }
    );
  }
}
```

### 2.2 Agregar variable de entorno

Edita `.env.local`:
```bash
PRINT_WORKER_URL=http://localhost:3001
```

## Paso 3: Crear Componente de Cliente

### 3.1 Crear `components/print-label-button.tsx`

```typescript
'use client'

import { useState } from 'react';

type PrintLabelButtonProps = {
  dinerId: string
  dinerName: string
  dinerSurname: string
  sector?: string
  company: string
  date: string
  shift?: 'MORNING' | 'AFTERNOON' | null
}

export function PrintLabelButton({
  dinerId,
  dinerName,
  dinerSurname,
  sector,
  company,
  date,
  shift
}: PrintLabelButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  async function handlePrint() {
    setPrinting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/labels/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: dinerName,
          apellido: dinerSurname,
          sector: sector || null,
          empresa: company,
          fecha: formatDate(date),
          turno: shift,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      // Opcional: mostrar notificación de éxito
      console.log('Etiqueta impresa correctamente');
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      console.error('Error:', err);
    } finally {
      setPrinting(false);
    }
  }
  
  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={handlePrint}
        disabled={printing}
        className="text-button"
        title="Imprimir etiqueta"
      >
        {printing ? '⏳' : '🏷️'}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>
          ❌
        </span>
      )}
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
```

## Paso 4: Integrar en la Página de Comensales

### 4.1 Modificar `app/(app)/comensales/imprimir/page.tsx`

Agregar botón de impresión para cada comensal:

```typescript
import { PrintLabelButton } from '@/components/print-label-button'

// ... en la parte donde se muestra cada comensal

<div className="diner-actions">
  <PrintLabelButton
    dinerId={diner.id}
    dinerName={diner.nombre}
    dinerSurname={diner.apellido}
    sector={getSectorName(diner.sectorId, report.groups)}
    company={company.nombre_comercial}
    date={fecha}
    shift={diner.mealShift}
  />
</div>
```

### 4.2 Función auxiliar para obtener nombre del sector

```typescript
function getSectorName(
  sectorId: string | null, 
  groups: DinerGroup[] | null
): string | undefined {
  if (!sectorId || !groups) return undefined;
  const group = groups.find(g => g.id === sectorId);
  return group?.name;
}
```

## Paso 5: Probar el Sistema Completo

### 5.1 Verificar que todo está corriendo

1. Print worker: `http://localhost:3001/health`
2. Next.js: `http://localhost:3000`
3. API: `http://localhost:3000/api/labels/print`

### 5.2 Flujo de prueba

1. Ir a `/comensales/imprimir?fecha=2026-11-27&empresa=...`
2. Click en el botón 🏷️ de cualquier comensal
3. Verificar que la etiqueta se imprime
4. Si hay error, revisar console del browser y logs del worker

### 5.3 Prueba manual con curl

```bash
curl -X POST http://localhost:3000/api/labels/print \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Maria",
    "apellido": "Garcia",
    "sector": "Administracion",
    "empresa": "Zuliani Hnos.",
    "fecha": "Viernes 27 de noviembre de 2026",
    "turno": "MORNING"
  }'
```

## Troubleshooting

### Error: "Impresora no conectada"

1. Verificar que la impresora está encendida
2. Verificar el cable USB o conexión de red
3. En Linux, verificar permisos: `sudo chmod 666 /dev/usb/lp0`
4. Revisar la configuración en `PRINTER_CONFIG`

### Error: "Cannot find module 'node-thermal-printer'"

```bash
cd print-worker
npm install
```

### Error: "fetch failed" al llamar a la API

1. Verificar que el print worker está corriendo: `curl http://localhost:3001/health`
2. Verificar CORS si llamas desde otro dominio
3. Revisar firewall/antivirus

### Texto con caracteres raros o cuadraditos

Cambiar el `characterSet` en `PRINTER_CONFIG`:
- Probar: `PC858_EURO`, `PC437_USA`, `WPC1252`
- O usar la función `normalizeText()` que ya está implementada

### La impresora imprime pero no corta el papel

Algunas impresoras no soportan corte automático:
```javascript
// Reemplazar printer.cut() por:
printer.newLine();
printer.newLine();
printer.newLine();
printer.drawLine();
// Sin cut()
```

## Próximos Pasos

Una vez que el sistema básico funciona:

1. ✅ Agregar impresión masiva (todos los comensales del día)
2. ✅ Agregar cola de impresión (para evitar conflictos)
3. ✅ Agregar logs de auditoría (quién imprimió qué)
4. ✅ Agregar página de configuración de impresora
5. ✅ Agregar previsualización de etiqueta antes de imprimir
6. ✅ Agregar códigos QR o códigos de barras
7. ✅ Optimizar diseño de etiqueta según feedback

## Scripts Útiles

### Iniciar todo en desarrollo

Crear `start-dev.sh`:
```bash
#!/bin/bash

# Iniciar print worker en background
cd print-worker
node server.js &
WORKER_PID=$!

# Iniciar Next.js
cd ..
pnpm dev

# Al cerrar Next.js, cerrar también el worker
kill $WORKER_PID
```

### Script de prueba automático

```bash
#!/bin/bash

echo "🧪 Probando sistema de impresión..."

# Probar worker
echo "1. Probando print worker..."
curl -s http://localhost:3001/health || {
  echo "❌ Print worker no responde"
  exit 1
}
echo "✅ Print worker OK"

# Probar API
echo "2. Probando API..."
curl -s http://localhost:3000/api/labels/print || {
  echo "❌ API no responde"
  exit 1
}
echo "✅ API OK"

# Imprimir prueba
echo "3. Imprimiendo etiqueta de prueba..."
curl -X POST http://localhost:3001/test
echo "✅ Si se imprimió la prueba, el sistema funciona!"
```

---

**¡Listo!** Ahora tenés un sistema básico de impresión de etiquetas funcionando.

Para cualquier duda, revisá el documento principal: `plan-impresora-termica.md`
