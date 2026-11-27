# 🚀 Plan de Implementación: Etiquetas Térmicas para Mora

## 📋 Contexto

**Necesidad**: Imprimir etiquetas para **todas las viandas del día por empresa**

**Flujo de trabajo actual**:
1. Empleado de Mora entra a `/comensales`
2. Selecciona fecha y empresa
3. Ve lista de comensales
4. Exporta PDF para cocina

**Flujo de trabajo nuevo**:
1. Empleado de Mora entra a `/comensales`
2. Selecciona fecha y empresa
3. Ve lista de comensales
4. **Click en "Imprimir Etiquetas"** → Salen TODAS las etiquetas 🎉
5. O click en 🏷️ de cada fila → Sale etiqueta individual

---

## 🎯 Funcionalidades a Implementar

### 1. Impresión Masiva (Principal)
```
Botón "Imprimir Etiquetas" en la página de comensales
↓
Imprime TODAS las etiquetas del día
↓
Una por cada persona que pidió
```

### 2. Impresión Individual (Secundaria)
```
Botón 🏷️ en cada fila de la tabla
↓
Imprime solo esa etiqueta
↓
Por si se necesita reimprimir una
```

---

## 📐 Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────┐
│  /comensales (página principal)                         │
│                                                         │
│  ┌─────────────────────────────────────────┐          │
│  │  [Exportar PDF]  [Imprimir Etiquetas]   │  ← NUEVO │
│  └─────────────────────────────────────────┘          │
│                                                         │
│  Tabla de comensales:                                  │
│  ┌────────────────────────────────────────┐           │
│  │ EMPLEADO    │ TURNO │ ... │ 🏷️         │  ← NUEVO │
│  │ García, M.  │ Mañana│ ... │ [Imprimir] │           │
│  │ López, J.   │ Tarde │ ... │ [Imprimir] │           │
│  └────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
                    ↓ Click
┌─────────────────────────────────────────────────────────┐
│  Componente PrintLabelsButton                           │
│  (Client Component)                                     │
│                                                         │
│  - Recolecta datos de todos los comensales             │
│  - Envía a API                                          │
│  - Muestra progress (1/50, 2/50, etc)                  │
└─────────────────────────────────────────────────────────┘
                    ↓ HTTP POST
┌─────────────────────────────────────────────────────────┐
│  /api/labels/print-batch                                │
│  (Next.js API Route)                                    │
│                                                         │
│  - Recibe array de comensales                          │
│  - Valida permisos                                      │
│  - Envía cada uno al print worker                      │
│  - Retorna progreso                                     │
└─────────────────────────────────────────────────────────┘
                    ↓ HTTP POST (múltiples)
┌─────────────────────────────────────────────────────────┐
│  Print Worker (localhost:3001)                          │
│  POST /print                                            │
│                                                         │
│  - Genera cada etiqueta                                │
│  - Envía a impresora                                    │
└─────────────────────────────────────────────────────────┘
                    ↓
                🖨️ Impresora
                    ↓
            🏷️🏷️🏷️ Etiquetas
```

---

## 📂 Archivos a Crear/Modificar

### ✅ Archivos Nuevos (5)

```
1. print-worker/
   └── server.js                           ← Print worker completo

2. app/api/labels/
   ├── print/route.ts                      ← Impresión individual
   └── print-batch/route.ts                ← Impresión masiva (NUEVO)

3. components/
   ├── print-label-button.tsx              ← Botón individual
   └── print-labels-batch-button.tsx       ← Botón masivo (NUEVO)
```

### ✏️ Archivos a Modificar (2)

```
1. app/(app)/comensales/page.tsx           ← Agregar botón masivo
2. components/diner-table.tsx               ← Agregar botón individual
```

---

## 🔨 Implementación Paso a Paso

## FASE 1: Setup del Print Worker (1 hora)

### Paso 1.1: Crear carpeta y dependencias

```bash
# En el root del proyecto
mkdir print-worker
cd print-worker
npm init -y
npm install express cors node-thermal-printer
```

### Paso 1.2: Crear `print-worker/server.js`

```javascript
const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(cors());
app.use(express.json());

// ========================================
// CONFIGURACIÓN DE IMPRESORA
// ========================================
// 🔧 AJUSTAR ESTOS VALORES SEGÚN TU IMPRESORA
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // Para Brother, MUNBYN, Epson
  interface: 'tcp://192.168.1.100',      // ← CAMBIAR por tu IP o USB
  characterSet: 'PC858_EURO',
  removeSpecialCharacters: false,
  lineCharacter: '=',
  options: {
    timeout: 5000
  }
};

// ========================================
// FUNCIONES AUXILIARES
// ========================================

function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .toUpperCase();
}

function formatDate(isoDate) {
  const date = new Date(isoDate + 'T00:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

// ========================================
// ENDPOINT: Health Check
// ========================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Print worker running',
    printer: PRINTER_CONFIG.interface
  });
});

// ========================================
// ENDPOINT: Imprimir UNA Etiqueta
// ========================================
app.post('/print', async (req, res) => {
  console.log('📄 Imprimiendo etiqueta:', req.body);
  
  try {
    const { nombre, apellido, sector, empresa, fecha, turno } = req.body;
    
    // Validaciones
    if (!nombre || !apellido || !empresa || !fecha) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos requeridos (nombre, apellido, empresa, fecha)' 
      });
    }
    
    // Crear instancia de impresora
    const printer = new ThermalPrinter(PRINTER_CONFIG);
    
    // Verificar conexión
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error('Impresora no conectada. Verificar conexión USB/Red.');
    }
    
    // ========================================
    // DISEÑO DE LA ETIQUETA
    // ========================================
    
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
    const nombreCompleto = normalizeText(`${apellido}, ${nombre}`);
    printer.println(nombreCompleto);
    printer.setTextNormal();
    printer.bold(false);
    printer.newLine();
    
    // Información detallada
    printer.alignLeft();
    printer.setTextSize(1, 1);
    
    // Sector
    if (sector) {
      printer.print('Sector: ');
      printer.bold(true);
      printer.println(normalizeText(sector));
      printer.bold(false);
    }
    
    // Empresa
    printer.print('Empresa: ');
    printer.bold(true);
    printer.println(normalizeText(empresa));
    printer.bold(false);
    
    // Fecha
    printer.print('Fecha: ');
    printer.println(formatDate(fecha));
    
    // Turno (si aplica)
    if (turno) {
      printer.print('Turno: ');
      printer.bold(true);
      const turnoTexto = turno === 'MORNING' ? 'MANANA' : 'TARDE';
      printer.println(turnoTexto);
      printer.bold(false);
    }
    
    // Espacio y corte
    printer.newLine();
    printer.newLine();
    printer.cut();
    
    // ========================================
    // ENVIAR A IMPRESORA
    // ========================================
    await printer.execute();
    
    console.log('✅ Etiqueta impresa exitosamente');
    
    res.json({ 
      success: true, 
      message: 'Etiqueta impresa correctamente',
      data: { nombre, apellido }
    });
    
  } catch (error) {
    console.error('❌ Error al imprimir:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

// ========================================
// ENDPOINT: Imprimir LOTE de Etiquetas
// ========================================
app.post('/print-batch', async (req, res) => {
  console.log(`📦 Imprimiendo lote de ${req.body.labels?.length || 0} etiquetas`);
  
  try {
    const { labels } = req.body;
    
    if (!Array.isArray(labels) || labels.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe enviar un array de etiquetas' 
      });
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Imprimir cada etiqueta
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      console.log(`  📄 ${i + 1}/${labels.length}: ${label.apellido}, ${label.nombre}`);
      
      try {
        // Reusar la lógica de impresión individual
        const { nombre, apellido, sector, empresa, fecha, turno } = label;
        
        const printer = new ThermalPrinter(PRINTER_CONFIG);
        const isConnected = await printer.isPrinterConnected();
        
        if (!isConnected) {
          throw new Error('Impresora no conectada');
        }
        
        // Diseño (mismo que antes)
        printer.alignCenter();
        printer.bold(true);
        printer.println('MORA GASTRONOMIA');
        printer.drawLine();
        printer.bold(false);
        printer.newLine();
        
        printer.setTextSize(2, 2);
        printer.bold(true);
        printer.println(normalizeText(`${apellido}, ${nombre}`));
        printer.setTextNormal();
        printer.bold(false);
        printer.newLine();
        
        printer.alignLeft();
        if (sector) {
          printer.print('Sector: ');
          printer.bold(true);
          printer.println(normalizeText(sector));
          printer.bold(false);
        }
        
        printer.print('Empresa: ');
        printer.bold(true);
        printer.println(normalizeText(empresa));
        printer.bold(false);
        
        printer.print('Fecha: ');
        printer.println(formatDate(fecha));
        
        if (turno) {
          printer.print('Turno: ');
          printer.bold(true);
          printer.println(turno === 'MORNING' ? 'MANANA' : 'TARDE');
          printer.bold(false);
        }
        
        printer.newLine();
        printer.newLine();
        printer.cut();
        
        await printer.execute();
        
        results.push({ success: true, label: `${apellido}, ${nombre}` });
        successCount++;
        
        // Pequeña pausa entre impresiones (opcional, mejora confiabilidad)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error en etiqueta ${i + 1}:`, error.message);
        results.push({ 
          success: false, 
          label: `${label.apellido}, ${label.nombre}`,
          error: error.message 
        });
        errorCount++;
      }
    }
    
    console.log(`✅ Lote completado: ${successCount} exitosas, ${errorCount} errores`);
    
    res.json({ 
      success: errorCount === 0,
      message: `Impreso: ${successCount}/${labels.length}`,
      results,
      stats: {
        total: labels.length,
        success: successCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error en lote:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========================================
// ENDPOINT: Prueba Rápida
// ========================================
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
    printer.println('MORA GASTRONOMIA');
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

// ========================================
// INICIAR SERVIDOR
// ========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('');
  console.log('🖨️  ════════════════════════════════════════════════');
  console.log('🖨️   MORA - Print Worker');
  console.log('🖨️  ════════════════════════════════════════════════');
  console.log(`🖨️   Server:    http://localhost:${PORT}`);
  console.log(`🖨️   Printer:   ${PRINTER_CONFIG.interface}`);
  console.log(`🖨️   Type:      ${PRINTER_CONFIG.type}`);
  console.log('🖨️  ════════════════════════════════════════════════');
  console.log('');
  console.log('✅  Listo para recibir trabajos de impresión');
  console.log('');
  console.log('📡  Endpoints disponibles:');
  console.log(`    GET  http://localhost:${PORT}/health`);
  console.log(`    POST http://localhost:${PORT}/print`);
  console.log(`    POST http://localhost:${PORT}/print-batch`);
  console.log(`    POST http://localhost:${PORT}/test`);
  console.log('');
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada sin manejar:', reason);
});
```

### Paso 1.3: Crear `print-worker/package.json`

```json
{
  "name": "mora-print-worker",
  "version": "1.0.0",
  "description": "Print worker para etiquetas térmicas de Mora Gastronomía",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["thermal", "printer", "labels"],
  "author": "Mora Gastronomía",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "node-thermal-printer": "^4.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### Paso 1.4: Configurar impresora

Editar en `server.js` la constante `PRINTER_CONFIG`:

```javascript
// OPCIÓN A: Por USB
interface: 'usb://04f9:2042'  // Vendor:Product ID

// OPCIÓN B: Por Red/Ethernet/WiFi
interface: 'tcp://192.168.1.100'  // IP de la impresora
```

**¿Cómo encontrar la IP/USB?**

```bash
# Para USB en Linux/Mac:
lsusb

# Para IP:
# Buscar en el panel de la impresora o en el router
```

### Paso 1.5: Probar el print worker

```bash
cd print-worker
npm install
npm start

# En otra terminal:
curl http://localhost:3001/health
# Debe devolver: {"status":"ok"}

curl -X POST http://localhost:3001/test
# Debe imprimir una etiqueta de prueba
```

✅ **Checkpoint 1**: Si la etiqueta de prueba sale, seguir adelante

---

## FASE 2: API Routes de Next.js (30 minutos)

### Paso 2.1: Crear `/app/api/labels/print/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSession, assertRole } from '@/lib/session';

const PRINT_WORKER_URL = process.env.PRINT_WORKER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED']);
    
    const { dinerId, companyId, date } = await request.json();
    
    // Validaciones
    if (!dinerId || !companyId || !date) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Obtener datos del comensal
    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, apellido, dni')
      .eq('id', dinerId)
      .maybeSingle();
    
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Comensal no encontrado' },
        { status: 404 }
      );
    }
    
    // Obtener sector
    const { data: membership } = await supabase
      .from('memberships')
      .select('sector_id, company_sectors(name)')
      .eq('user_id', dinerId)
      .eq('company_id', companyId)
      .maybeSingle();
    
    const sector = membership?.company_sectors as { name?: string } | null;
    
    // Obtener empresa
    const { data: company } = await supabase
      .from('companies')
      .select('nombre_comercial')
      .eq('id', companyId)
      .maybeSingle();
    
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }
    
    // Obtener turno (si existe elección para ese día)
    const { data: selection } = await supabase
      .from('v_selection_details')
      .select('meal_shift')
      .eq('employee_id', dinerId)
      .eq('service_date', date)
      .eq('company_id', companyId)
      .maybeSingle();
    
    // Enviar a print worker
    const response = await fetch(`${PRINT_WORKER_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: profile.nombre,
        apellido: profile.apellido,
        sector: sector?.name,
        empresa: company.nombre_comercial,
        fecha: date,
        turno: selection?.meal_shift,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Error al imprimir');
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error al imprimir etiqueta:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
```

### Paso 2.2: Crear `/app/api/labels/print-batch/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireSession, assertRole } from '@/lib/session';

const PRINT_WORKER_URL = process.env.PRINT_WORKER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN', 'SCOPED']);
    
    const { labels } = await request.json();
    
    // Validaciones
    if (!Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe enviar un array de etiquetas' },
        { status: 400 }
      );
    }
    
    // Validar que cada etiqueta tenga los datos necesarios
    for (const label of labels) {
      if (!label.nombre || !label.apellido || !label.empresa || !label.fecha) {
        return NextResponse.json(
          { success: false, error: 'Faltan datos en alguna etiqueta' },
          { status: 400 }
        );
      }
    }
    
    // Enviar al print worker
    const response = await fetch(`${PRINT_WORKER_URL}/print-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels }),
    });
    
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error al imprimir lote:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
```

### Paso 2.3: Agregar variable de entorno

Editar `.env.local` (crear si no existe):

```bash
PRINT_WORKER_URL=http://localhost:3001
```

✅ **Checkpoint 2**: APIs creadas

---

## FASE 3: Componentes Frontend (1 hora)

### Paso 3.1: Crear `components/print-label-button.tsx` (Individual)

```typescript
'use client'

import { useState } from 'react';

type PrintLabelButtonProps = {
  dinerId: string
  dinerName: string
  dinerSurname: string
  sector?: string
  company: string
  companyId: string
  date: string
  shift?: 'MORNING' | 'AFTERNOON' | null
}

export function PrintLabelButton({
  dinerId,
  dinerName,
  dinerSurname,
  sector,
  company,
  companyId,
  date,
  shift
}: PrintLabelButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  async function handlePrint() {
    setPrinting(true);
    setStatus('idle');
    
    try {
      const response = await fetch('/api/labels/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dinerId,
          companyId,
          date,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error:', err);
      setStatus('error');
      alert(`Error al imprimir: ${message}`);
    } finally {
      setPrinting(false);
    }
  }
  
  return (
    <button
      onClick={handlePrint}
      disabled={printing}
      className="text-button"
      title="Imprimir etiqueta"
      style={{ fontSize: '1.2rem' }}
    >
      {status === 'success' ? '✅' : printing ? '⏳' : status === 'error' ? '❌' : '🏷️'}
    </button>
  );
}
```

### Paso 3.2: Crear `components/print-labels-batch-button.tsx` (Masivo)

```typescript
'use client'

import { useState } from 'react';

type LabelData = {
  nombre: string
  apellido: string
  sector?: string
  empresa: string
  fecha: string
  turno?: 'MORNING' | 'AFTERNOON' | null
}

type PrintLabelsBatchButtonProps = {
  labels: LabelData[]
  companyName: string
  date: string
}

export function PrintLabelsBatchButton({
  labels,
  companyName,
  date
}: PrintLabelsBatchButtonProps) {
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  
  async function handlePrintAll() {
    if (labels.length === 0) {
      alert('No hay comensales para imprimir');
      return;
    }
    
    const confirmed = confirm(
      `¿Imprimir ${labels.length} etiqueta${labels.length === 1 ? '' : 's'} para ${companyName}?`
    );
    
    if (!confirmed) return;
    
    setPrinting(true);
    setProgress(`Imprimiendo 0/${labels.length}...`);
    
    try {
      const response = await fetch('/api/labels/print-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      setProgress(`Completado: ${result.stats.success}/${result.stats.total}`);
      
      if (result.stats.errors > 0) {
        alert(
          `Impresión completada con errores:\n` +
          `Exitosas: ${result.stats.success}\n` +
          `Errores: ${result.stats.errors}`
        );
      } else {
        alert(`¡${result.stats.success} etiquetas impresas correctamente! 🎉`);
      }
      
      setTimeout(() => {
        setProgress(null);
        setPrinting(false);
      }, 3000);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error:', err);
      alert(`Error al imprimir: ${message}`);
      setProgress(null);
      setPrinting(false);
    }
  }
  
  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handlePrintAll}
        disabled={printing || labels.length === 0}
        className="primary-button"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span>🏷️</span>
        <span>
          {printing 
            ? progress || 'Imprimiendo...' 
            : `Imprimir Etiquetas (${labels.length})`}
        </span>
      </button>
    </div>
  );
}
```

✅ **Checkpoint 3**: Componentes creados

---

## FASE 4: Integración en la UI (30 minutos)

### Paso 4.1: Modificar `app/(app)/comensales/page.tsx`

Agregar el botón de impresión masiva al lado de "Exportar PDF":

```typescript
// Al inicio del archivo, agregar import:
import { PrintLabelsBatchButton } from '@/components/print-labels-batch-button'

// ... código existente ...

// En el return, modificar el PageHeader:
<PageHeader
  eyebrow="COMENSALES"
  title={companyName}
  description={[
    report.groups
      ? 'Agrupado por sector. Dentro de cada sector, por apellido.'
      : 'Ordenado por apellido y nombre.',
    report.mealShiftsEnabled ? 'Incluye turno de comida (mañana o tarde).' : null,
    'Cada columna es una categoría contratada.',
  ].filter(Boolean).join(' ')}
  action={
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Link className="outline-button" href={printHref}>Exportar PDF</Link>
      <PrintLabelsBatchButton
        labels={report.diners
          .filter(d => Object.keys(d.choices).length > 0 || d.selectionId)
          .map(d => ({
            nombre: d.nombre,
            apellido: d.apellido,
            sector: report.groups?.find(g => g.diners.some(gd => gd.id === d.id))?.name,
            empresa: companyName,
            fecha: date,
            turno: d.mealShift,
          }))}
        companyName={companyName}
        date={date}
      />
    </div>
  }
/>
```

### Paso 4.2: Modificar `components/diner-table.tsx`

Agregar columna de impresión individual:

```typescript
// Al inicio del archivo, agregar import:
import { PrintLabelButton } from '@/components/print-label-button'

// Modificar el type DinerTableProps para incluir props necesarios:
export function DinerTable({
  categories,
  diners,
  groups,
  searchable = false,
  cancelBack,
  showMealShift = false,
  companyId,        // ← NUEVO
  companyName,      // ← NUEVO
  date,             // ← NUEVO
  showPrintButton = false,  // ← NUEVO
}: {
  categories: DinerCategory[]
  diners: Diner[]
  groups?: DinerGroup[] | null
  searchable?: boolean
  cancelBack?: string
  showMealShift?: boolean
  companyId?: string         // ← NUEVO
  companyName?: string       // ← NUEVO
  date?: string              // ← NUEVO
  showPrintButton?: boolean  // ← NUEVO
}) {
  // ... código existente ...
  
  // Modificar columns para incluir botón de impresión:
  const columns = categories.length + 1 + 
                  (showMealShift ? 1 : 0) + 
                  (cancelBack ? 1 : 0) +
                  (showPrintButton ? 1 : 0)  // ← NUEVO
  
  // ... código existente ...
  
  // En el thead, agregar columna:
  <thead>
    <tr>
      <th>EMPLEADO</th>
      {showMealShift ? <th>TURNO</th> : null}
      {categories.map((category) => <th key={category.id}>{category.name}</th>)}
      {cancelBack ? <th /> : null}
      {showPrintButton ? <th>ETIQUETA</th> : null}  {/* ← NUEVO */}
    </tr>
  </thead>
  
  // Modificar DinerRow para incluir props:
  <DinerRow 
    key={diner.id} 
    diner={diner} 
    categories={categories} 
    cancelBack={cancelBack} 
    showMealShift={showMealShift}
    companyId={companyId}           // ← NUEVO
    companyName={companyName}       // ← NUEVO
    date={date}                     // ← NUEVO
    showPrintButton={showPrintButton}  // ← NUEVO
    sectorName={groups?.find(g => g.diners.some(gd => gd.id === diner.id))?.name}  // ← NUEVO
  />
}

// Modificar DinerRow function:
function DinerRow({
  diner,
  categories,
  cancelBack,
  showMealShift,
  companyId,        // ← NUEVO
  companyName,      // ← NUEVO
  date,             // ← NUEVO
  showPrintButton,  // ← NUEVO
  sectorName,       // ← NUEVO
}: {
  diner: Diner
  categories: DinerCategory[]
  cancelBack?: string
  showMealShift: boolean
  companyId?: string         // ← NUEVO
  companyName?: string       // ← NUEVO
  date?: string              // ← NUEVO
  showPrintButton?: boolean  // ← NUEVO
  sectorName?: string        // ← NUEVO
}) {
  return (
    <tr>
      <td>
        {dinerLabel(diner)}
        {!diner.membershipActive ? <span className="muted"> · baja</span> : null}
      </td>
      {showMealShift ? <td>{diner.selectionId || Object.keys(diner.choices).length > 0 ? mealShiftLabel(diner.mealShift) : '—'}</td> : null}
      {categories.map((category) => <td key={category.id}>{diner.choices[category.id] ?? '—'}</td>)}
      {cancelBack ? (
        <td>
          {diner.selectionId ? (
            <CancelMenuButton selectionId={diner.selectionId} personName={dinerLabel(diner)} back={cancelBack} />
          ) : null}
        </td>
      ) : null}
      {/* ← NUEVO: Botón de impresión individual */}
      {showPrintButton && companyId && companyName && date ? (
        <td>
          {diner.selectionId || Object.keys(diner.choices).length > 0 ? (
            <PrintLabelButton
              dinerId={diner.id}
              dinerName={diner.nombre}
              dinerSurname={diner.apellido}
              sector={sectorName}
              company={companyName}
              companyId={companyId}
              date={date}
              shift={diner.mealShift}
            />
          ) : null}
        </td>
      ) : null}
    </tr>
  )
}
```

### Paso 4.3: Actualizar llamada a DinerTable en comensales/page.tsx

```typescript
<DinerTable
  categories={report.categories}
  diners={report.diners}
  groups={report.groups}
  searchable
  showMealShift={report.mealShiftsEnabled}
  cancelBack={isCompanyAdmin || isScoped ? undefined : `/comensales?${printQuery.toString()}`}
  companyId={companyId}           // ← NUEVO
  companyName={companyName}       // ← NUEVO
  date={date}                     // ← NUEVO
  showPrintButton={true}          // ← NUEVO
/>
```

✅ **Checkpoint 4**: UI integrada

---

## FASE 5: Testing (1 hora)

### Test 1: Prueba Individual

```
1. Ir a /comensales
2. Seleccionar fecha y empresa
3. Click en 🏷️ de cualquier fila
4. ¿Sale la etiqueta? ✅
```

### Test 2: Prueba Masiva

```
1. En la misma página
2. Click en "Imprimir Etiquetas (N)"
3. Confirmar
4. ¿Salen todas las etiquetas? ✅
5. ¿Muestra progreso? ✅
```

### Test 3: Validar Datos

```
Verificar que cada etiqueta tenga:
✅ Nombre correcto
✅ Sector correcto
✅ Empresa correcta
✅ Fecha en español
✅ Turno (si aplica)
```

### Test 4: Manejo de Errores

```
1. Apagar la impresora
2. Intentar imprimir
3. ¿Muestra error claro? ✅
4. Prender impresora
5. Reintentar
6. ¿Funciona ahora? ✅
```

### Test 5: Volumen

```
1. Día con 50+ comensales
2. Click en "Imprimir Etiquetas"
3. ¿Se imprimen todas? ✅
4. ¿Tiempo razonable (< 3 min)? ✅
```

✅ **Checkpoint 5**: Todo testeado

---

## 📊 Resumen de Archivos

### Creados (7 archivos)

```
✅ print-worker/server.js                      (500 líneas)
✅ print-worker/package.json                   (20 líneas)
✅ app/api/labels/print/route.ts               (100 líneas)
✅ app/api/labels/print-batch/route.ts         (60 líneas)
✅ components/print-label-button.tsx           (80 líneas)
✅ components/print-labels-batch-button.tsx    (100 líneas)
✅ .env.local                                  (1 línea)
```

### Modificados (2 archivos)

```
✏️  app/(app)/comensales/page.tsx              (+15 líneas)
✏️  components/diner-table.tsx                 (+40 líneas)
```

---

## ⏱️ Tiempo Total Estimado

```
Fase 1: Setup Print Worker        → 1 hora
Fase 2: API Routes                 → 30 minutos
Fase 3: Componentes Frontend       → 1 hora
Fase 4: Integración UI             → 30 minutos
Fase 5: Testing                    → 1 hora
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                             → 4 horas
```

---

## 🎯 Resultado Final

### Usuario va a `/comensales`:

```
┌──────────────────────────────────────────────────────┐
│  COMENSALES                                          │
│  Zuliani Hnos.                                       │
│                                                      │
│  [Exportar PDF] [🏷️ Imprimir Etiquetas (45)]       │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ EMPLEADO        │ TURNO  │ ... │ ETIQUETA    │ │
│  ├────────────────────────────────────────────────┤ │
│  │ García, María   │ Mañana │ ... │ 🏷️          │ │
│  │ López, Juan     │ Tarde  │ ... │ 🏷️          │ │
│  │ ...                                            │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Click en "Imprimir Etiquetas" →

```
🖨️ Imprimiendo...
🏷️ García, María - Administración - Zuliani - 27/11 - Mañana
🏷️ López, Juan - Producción - Zuliani - 27/11 - Tarde
🏷️ ...
✅ 45 etiquetas impresas correctamente!
```

---

## 🚀 ¡Listo!

Con este plan tenés todo lo necesario para implementar el sistema completo de etiquetas térmicas para Mora Gastronomía.

**Próximo paso**: Empezar por la Fase 1 (Print Worker)
