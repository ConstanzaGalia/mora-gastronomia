# Plan de Implementación: Impresora Térmica de Etiquetas para Mora Gastronomía

## 1. Resumen Ejecutivo

Este documento detalla el plan para implementar un sistema de impresión térmica de etiquetas para las viandas de Mora Gastronomía. Las etiquetas contendrán:
- Nombre del empleado
- Sector
- Empresa
- Fecha de servicio

## 2. Análisis del Sistema Actual

### 2.1 Datos Disponibles
El sistema ya tiene toda la información necesaria:

```typescript
// Estructura de datos del comensal (Diner)
{
  apellido: string
  nombre: string
  dni: string
  sectorId: string | null
  choices: Record<string, string>  // Elecciones de menú
  mealShift: 'MORNING' | 'AFTERNOON' | null
}

// Datos de empresa
{
  nombre_comercial: string
  meal_shifts_enabled: boolean
}

// Fecha de servicio
service_date: string  // formato YYYY-MM-DD
```

### 2.2 Punto de Integración
La página `/comensales/imprimir` ya genera informes por fecha y empresa, siendo el punto ideal para agregar la funcionalidad de impresión de etiquetas individuales.

## 3. Opciones Tecnológicas

### 3.1 Hardware - Impresoras Térmicas Recomendadas

#### Opción A: Zebra ZD410 (Recomendada)
- **Precio**: USD 300-400
- **Pros**:
  - Estándar de la industria
  - Excelente soporte y documentación
  - Protocolo ZPL bien establecido
  - USB, Ethernet, Bluetooth
  - Velocidad: 152mm/s
- **Contras**:
  - Precio más alto
- **Tamaño de etiquetas**: 25mm - 114mm ancho

#### Opción B: Brother QL-820NWB
- **Precio**: USD 200-250
- **Pros**:
  - Más económica
  - Buena calidad de impresión
  - WiFi, USB, Bluetooth
  - Fácil de usar
- **Contras**:
  - Cintas adhesivas propietarias más caras
  - Menos velocidad que Zebra
- **Tamaño de etiquetas**: 12mm - 62mm ancho

#### Opción C: MUNBYN ITPP941
- **Precio**: USD 100-150
- **Pros**:
  - Muy económica
  - Compacta
  - Compatible con ESC/POS
  - USB, Bluetooth
- **Contras**:
  - Menor durabilidad
  - Soporte limitado
  - Solo para volúmenes bajos
- **Tamaño de etiquetas**: 20mm - 80mm ancho

### 3.2 Protocolos de Impresión

#### ZPL (Zebra Programming Language)
- Para impresoras Zebra
- Lenguaje de comandos robusto
- Amplio soporte en la industria

#### ESC/POS
- Estándar para impresoras térmicas de tickets
- Compatible con muchas marcas
- Más simple que ZPL

#### Brother P-touch Template
- Específico de Brother
- Basado en plantillas predefinidas

### 3.3 Bibliotecas de Software

#### Para Node.js / Next.js (Backend)

**1. node-thermal-printer** (Recomendada para ESC/POS)
```bash
npm install node-thermal-printer
```
- Soporta ESC/POS
- USB y red
- Fácil de usar
- Activamente mantenida

**2. node-zebra**
```bash
npm install node-zebra
```
- Específica para Zebra
- Genera comandos ZPL
- Envío por USB o red

**3. escpos**
```bash
npm install escpos escpos-usb
```
- Librería ESC/POS completa
- Soporta múltiples conexiones
- Buena documentación

#### Para Web (Frontend)

**1. jsPDF + Impresión del navegador**
- Genera PDF y usa window.print()
- Compatible con todas las impresoras
- Más lento y menos control

**2. WebUSB API**
- Comunicación directa USB desde el navegador
- Requiere Chrome/Edge moderno
- Necesita permisos del usuario
- Control total sobre la impresora

**3. QZ Tray** (Recomendada para producción)
```
https://qz.io/
```
- Aplicación local que actúa como puente
- Soporta múltiples protocolos (ZPL, ESC/POS)
- Compatible con todos los navegadores
- Firma digital para seguridad
- Perfecta para ambientes empresariales

## 4. Arquitecturas de Solución

### Arquitectura A: Backend API + Worker Local (Recomendada)

```
┌─────────────┐      HTTPS      ┌──────────────┐
│   Browser   │ ───────────────> │  Next.js API │
│  (Usuario)  │                  │   /api/print │
└─────────────┘                  └──────────────┘
                                        │
                                        │ HTTP
                                        v
                                 ┌──────────────┐
                                 │ Print Worker │
                                 │   (Local)    │
                                 └──────────────┘
                                        │ USB/Red
                                        v
                                 ┌──────────────┐
                                 │  Impresora   │
                                 │   Térmica    │
                                 └──────────────┘
```

**Flujo**:
1. Usuario hace clic en "Imprimir etiqueta"
2. Frontend envía datos a API de Next.js
3. API envía trabajo de impresión a worker local
4. Worker genera comandos ZPL/ESC-POS
5. Worker envía a impresora por USB o red
6. API retorna confirmación

**Ventajas**:
- Separación clara de responsabilidades
- Fácil de escalar
- No requiere instalación en cliente
- Worker se puede ejecutar en servidor o computadora local

**Implementación**:
- Worker en Node.js con Express simple
- API de Next.js en `/api/labels/print`
- Comunicación por HTTP entre servidor y worker

### Arquitectura B: QZ Tray (Mejor UX para múltiples clientes)

```
┌─────────────┐                  ┌──────────────┐
│   Browser   │ ───────────────> │   QZ Tray    │
│  (Cliente)  │    WebSocket     │   (Local)    │
└─────────────┘                  └──────────────┘
                                        │ USB/Red
                                        v
                                 ┌──────────────┐
                                 │  Impresora   │
                                 └──────────────┘
```

**Flujo**:
1. Usuario instala QZ Tray en su computadora
2. Frontend se conecta a QZ Tray vía WebSocket
3. Frontend envía comandos ZPL/ESC-POS directamente
4. QZ Tray imprime en impresora conectada localmente

**Ventajas**:
- No requiere worker backend
- Funciona con múltiples clientes
- Cada terminal puede tener su propia impresora
- Firma digital para seguridad

**Desventajas**:
- Requiere instalación en cada máquina cliente
- Configuración inicial más compleja

### Arquitectura C: WebUSB (Moderna, pero limitada)

```
┌─────────────┐      WebUSB      ┌──────────────┐
│   Browser   │ ───────────────> │  Impresora   │
│  (Chrome)   │                  │   USB        │
└─────────────┘                  └──────────────┘
```

**Ventajas**:
- Sin instalación adicional
- Comunicación directa

**Desventajas**:
- Solo Chrome/Edge
- Solo USB (no red)
- Requiere permisos cada vez
- Soporte limitado de impresoras

## 5. Diseño de Etiqueta

### 5.1 Especificaciones Propuestas

**Tamaño**: 80mm × 50mm (estándar para viandas)

**Layout**:
```
┌────────────────────────────────────┐
│  MORA GASTRONOMÍA                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                    │
│  GARCÍA LÓPEZ, MARÍA               │  <- Nombre (negrita, grande)
│                                    │
│  Sector: Administración            │  <- Sector
│  Empresa: Zuliani Hnos.            │  <- Empresa
│                                    │
│  📅 Viernes 27/11/2026             │  <- Fecha
│  🕐 Almuerzo - Mañana             │  <- Turno (si aplica)
│                                    │
└────────────────────────────────────┘
```

**Variante compacta** (60mm × 40mm):
```
┌──────────────────────────────┐
│  MORA                        │
│  GARCÍA, MARÍA               │
│  Admin. • Zuliani            │
│  27/11 • 🕐 Mañana          │
└──────────────────────────────┘
```

### 5.2 Código ZPL de Ejemplo

```zpl
^XA
^FO50,20^A0N,30,30^FDMora Gastronomia^FS
^FO50,60^GB700,2,2^FS
^FO50,80^A0N,50,50^FDGARCIA, MARIA^FS
^FO50,140^A0N,30,30^FDSector: Administracion^FS
^FO50,180^A0N,30,30^FDEmpresa: Zuliani Hnos.^FS
^FO50,220^A0N,30,30^FDFecha: 27/11/2026^FS
^FO50,260^A0N,30,30^FDTurno: Manana^FS
^XZ
```

### 5.3 Código ESC/POS de Ejemplo

```javascript
const escpos = require('escpos');

function printLabel(diner, company, date, sector, shift) {
  // Texto centrado y en negrita
  printer
    .align('ct')
    .style('b')
    .size(1, 1)
    .text('MORA GASTRONOMÍA')
    .text('─────────────────')
    .style('normal')
    .text('')
    
    // Nombre grande
    .style('b')
    .size(2, 2)
    .text(`${diner.apellido}, ${diner.nombre}`)
    .size(1, 1)
    .text('')
    
    // Información
    .align('lt')
    .style('normal')
    .text(`Sector: ${sector || 'Sin asignar'}`)
    .text(`Empresa: ${company}`)
    .text(`Fecha: ${formatDate(date)}`)
    
    if (shift) {
      .text(`Turno: ${shift === 'MORNING' ? 'Mañana' : 'Tarde'}`)
    }
    
    .text('')
    .cut()
    .flush();
}
```

## 6. Plan de Implementación

### Fase 1: Investigación y Prototipo (1-2 días)

**Tareas**:
1. ✅ Análisis del sistema actual
2. ✅ Investigación de hardware
3. ✅ Investigación de bibliotecas
4. ⬜ Decisión de arquitectura
5. ⬜ Adquisición de impresora para pruebas

**Entregables**:
- Este documento de investigación
- Decisión de hardware
- Decisión de arquitectura

### Fase 2: Desarrollo Backend (2-3 días)

#### Opción A: Worker Local

**Estructura de archivos**:
```
mora-gastronomia/
├── print-worker/
│   ├── package.json
│   ├── server.js              # Express server
│   ├── printer-config.js      # Configuración de impresora
│   ├── label-templates.js     # Templates ZPL/ESC-POS
│   └── README.md
└── app/
    └── api/
        └── labels/
            └── print/
                └── route.ts   # API endpoint
```

**1. Crear Print Worker** (`print-worker/server.js`)
```javascript
const express = require('express');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(express.json());

// Configurar impresora
const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100', // O 'usb://...'
  characterSet: 'PC858_EURO',
  removeSpecialCharacters: false,
  lineCharacter: "=",
  options: {
    timeout: 5000
  }
});

app.post('/print', async (req, res) => {
  try {
    const { nombre, apellido, sector, empresa, fecha, turno } = req.body;
    
    // Generar etiqueta
    printer.alignCenter();
    printer.bold(true);
    printer.println('MORA GASTRONOMÍA');
    printer.drawLine();
    printer.bold(false);
    printer.newLine();
    
    printer.setTextSize(2, 2);
    printer.bold(true);
    printer.println(`${apellido}, ${nombre}`);
    printer.setTextNormal();
    printer.bold(false);
    printer.newLine();
    
    printer.alignLeft();
    printer.println(`Sector: ${sector || 'Sin asignar'}`);
    printer.println(`Empresa: ${empresa}`);
    printer.println(`Fecha: ${fecha}`);
    if (turno) {
      printer.println(`Turno: ${turno === 'MORNING' ? 'Mañana' : 'Tarde'}`);
    }
    printer.newLine();
    printer.cut();
    
    await printer.execute();
    
    res.json({ success: true, message: 'Etiqueta impresa' });
  } catch (error) {
    console.error('Error al imprimir:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Print worker escuchando en puerto 3001');
});
```

**2. Crear API Route** (`app/api/labels/print/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const { dinerId, companyId, date } = await request.json();
    
    // Obtener datos del comensal
    const supabase = await createClient();
    
    const { data: diner } = await supabase
      .from('profiles')
      .select('nombre, apellido, dni')
      .eq('id', dinerId)
      .single();
    
    const { data: membership } = await supabase
      .from('memberships')
      .select('sector_id, company_sectors(name)')
      .eq('user_id', dinerId)
      .eq('company_id', companyId)
      .single();
    
    const { data: company } = await supabase
      .from('companies')
      .select('nombre_comercial')
      .eq('id', companyId)
      .single();
    
    const { data: selection } = await supabase
      .from('v_selection_details')
      .select('meal_shift')
      .eq('employee_id', dinerId)
      .eq('service_date', date)
      .maybeSingle();
    
    // Enviar a print worker
    const response = await fetch('http://localhost:3001/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: diner?.nombre,
        apellido: diner?.apellido,
        sector: membership?.company_sectors?.name,
        empresa: company?.nombre_comercial,
        fecha: formatDate(date),
        turno: selection?.meal_shift,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

#### Opción B: QZ Tray

**1. Componente de cliente** (`components/label-printer.tsx`)
```typescript
'use client'

import { useState } from 'react';
import qz from 'qz-tray';

export function LabelPrinter({ diner, company, date, sector, shift }) {
  const [printing, setPrinting] = useState(false);
  
  async function printLabel() {
    setPrinting(true);
    
    try {
      // Conectar a QZ Tray
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      
      // Buscar impresora
      const printers = await qz.printers.find();
      const printer = printers[0]; // O buscar por nombre específico
      
      // Generar ZPL
      const zpl = `
^XA
^FO50,20^A0N,30,30^FDMora Gastronomia^FS
^FO50,60^GB700,2,2^FS
^FO50,80^A0N,50,50^FD${diner.apellido}, ${diner.nombre}^FS
^FO50,140^A0N,30,30^FDSector: ${sector || 'Sin asignar'}^FS
^FO50,180^A0N,30,30^FDEmpresa: ${company}^FS
^FO50,220^A0N,30,30^FDFecha: ${formatDate(date)}^FS
${shift ? `^FO50,260^A0N,30,30^FDTurno: ${shift === 'MORNING' ? 'Manana' : 'Tarde'}^FS` : ''}
^XZ`;
      
      // Configurar e imprimir
      const config = qz.configs.create(printer);
      await qz.print(config, [zpl]);
      
      alert('Etiqueta impresa correctamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al imprimir: ' + error.message);
    } finally {
      setPrinting(false);
    }
  }
  
  return (
    <button
      onClick={printLabel}
      disabled={printing}
      className="outline-button"
    >
      {printing ? 'Imprimiendo...' : 'Imprimir etiqueta'}
    </button>
  );
}
```

### Fase 3: Desarrollo Frontend (1-2 días)

**1. Agregar botón de impresión en tabla de comensales**

Modificar `components/diner-table.tsx`:
```typescript
<td>
  <button
    onClick={() => handlePrintLabel(diner.id)}
    className="text-button"
    title="Imprimir etiqueta"
  >
    🏷️
  </button>
</td>
```

**2. Crear modal de impresión masiva**

Componente para imprimir múltiples etiquetas:
```typescript
<dialog>
  <h3>Imprimir etiquetas</h3>
  <ul>
    {selectedDiners.map(diner => (
      <li key={diner.id}>
        <input type="checkbox" checked />
        {diner.apellido}, {diner.nombre}
      </li>
    ))}
  </ul>
  <button onClick={printAll}>Imprimir todas</button>
</dialog>
```

**3. Agregar configuración de impresora**

Página de configuración (`app/(app)/configuracion/impresora/page.tsx`):
- Selección de impresora
- Prueba de impresión
- Diseño de etiqueta (previsualización)

### Fase 4: Testing (1 día)

**Pruebas a realizar**:
1. ✅ Impresión de etiqueta individual
2. ✅ Impresión masiva (10-50 etiquetas)
3. ✅ Manejo de errores (impresora desconectada)
4. ✅ Diferentes tamaños de etiquetas
5. ✅ Caracteres especiales (acentos, ñ)
6. ✅ Turnos de comida (mañana/tarde)
7. ✅ Sectores sin asignar
8. ✅ Rendimiento con muchas impresiones

### Fase 5: Documentación y Deploy (1 día)

**Documentación necesaria**:
1. Manual de instalación de impresora
2. Manual de configuración del sistema
3. Manual de uso para operadores
4. Troubleshooting común

**Deploy**:
1. Worker en servidor local o VM
2. Actualización de Next.js en Vercel
3. Configuración de red/firewall
4. Capacitación al personal

## 7. Consideraciones Técnicas

### 7.1 Seguridad

- ✅ Autenticación requerida para imprimir
- ✅ Validación de permisos por empresa
- ✅ Rate limiting en API
- ✅ Logs de auditoría de impresiones
- ✅ Cifrado HTTPS en comunicación

### 7.2 Rendimiento

- **Tiempo de impresión**: ~1-2 segundos por etiqueta
- **Throughput**: 30-60 etiquetas por minuto
- **Cola de impresión**: Implementar para manejar múltiples solicitudes
- **Caché**: Precalcular datos de etiquetas para el día

### 7.3 Manejo de Errores

```typescript
// Estados posibles
type PrintStatus = 
  | 'idle'
  | 'printing'
  | 'success'
  | 'error_no_printer'
  | 'error_paper_out'
  | 'error_connection'
  | 'error_unknown';

// Reintentos automáticos
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms
```

### 7.4 Escalabilidad

**Escenario actual**: 1 impresora, 50-100 viandas/día
- ✅ Tiempo: ~3-5 minutos para todas las etiquetas
- ✅ Sin problemas de rendimiento

**Escenario futuro**: 500+ viandas/día
- Considerar múltiples impresoras
- Load balancing entre impresoras
- Impresión paralela

## 8. Costos Estimados

### Hardware
| Item | Opción | Costo (USD) |
|------|--------|-------------|
| Impresora | Zebra ZD410 | $350 |
| Impresora | Brother QL-820NWB | $220 |
| Impresora | MUNBYN ITPP941 | $120 |
| Etiquetas (rollo 1000) | 80×50mm térmicas | $25-40 |
| Cable USB adicional | - | $10 |

**Costo inicial estimado**: USD 130-360 (según impresora elegida)
**Costo mensual etiquetas**: USD 10-30 (según volumen)

### Software
- Node.js + Express: **Gratis**
- node-thermal-printer: **Gratis**
- QZ Tray Personal: **Gratis**
- QZ Tray Comercial: **USD 50/año** (opcional)

### Desarrollo
- Horas estimadas: 40-60 horas
- Incluyendo testing y documentación

## 9. Recomendación Final

### Configuración Recomendada

**Hardware**: Zebra ZD410 o Brother QL-820NWB
- Mejor relación calidad-precio
- Confiabilidad probada
- Buen soporte técnico

**Arquitectura**: Worker Local (Opción A)
- Más simple de implementar
- No requiere instalación en clientes
- Fácil de mantener
- Escalable

**Tamaño de etiqueta**: 80mm × 50mm
- Suficiente espacio para toda la información
- Legible desde distancia
- Estándar de la industria

**Software**: node-thermal-printer con ESC/POS
- Open source y mantenida
- Documentación clara
- Compatible con muchas impresoras

### Próximos Pasos

1. **Aprobar presupuesto** para hardware
2. **Elegir modelo** de impresora
3. **Comprar impresora** y etiquetas para pruebas
4. **Comenzar desarrollo** de worker y API
5. **Testing** con datos reales
6. **Capacitación** al personal
7. **Deploy** en producción

### Timeline Estimado

- Semana 1: Adquisición de hardware
- Semana 2-3: Desarrollo e integración
- Semana 4: Testing y ajustes
- Semana 5: Deploy y capacitación

**Tiempo total**: 4-5 semanas

## 10. Alternativas Consideradas

### Alternativa 1: Impresión de PDF + Impresora común
**Pros**: Sin hardware adicional
**Contras**: Lento, desperdicio de papel, no adhesivo
**Veredicto**: ❌ No recomendado

### Alternativa 2: Etiquetas escritas a mano
**Pros**: Sin costo
**Contras**: Lento, propenso a errores, poco profesional
**Veredicto**: ❌ No escalable

### Alternativa 3: Servicio de impresión en la nube
**Pros**: Sin infraestructura local
**Contras**: Dependencia de internet, costos recurrentes altos
**Veredicto**: ⚠️ Solo para volúmenes muy altos

## 11. Preguntas Frecuentes

**P: ¿Qué pasa si se va la luz?**
R: El worker puede correr en UPS. Las etiquetas quedan en cola y se imprimen al volver la energía.

**P: ¿Se puede imprimir desde múltiples computadoras?**
R: Sí, con la arquitectura de worker, cualquier dispositivo puede enviar trabajos a través de la API.

**P: ¿Qué pasa si la impresora se queda sin papel?**
R: El sistema detecta el error y notifica al usuario. Los trabajos quedan en cola.

**P: ¿Se pueden editar las etiquetas?**
R: Sí, los templates son configurables. Se puede cambiar diseño, tamaños, fuentes, etc.

**P: ¿Funciona con códigos QR?**
R: Sí, se pueden agregar códigos QR o códigos de barras a las etiquetas.

## 12. Recursos y Referencias

### Documentación Técnica
- [node-thermal-printer](https://github.com/Klemen1337/node-thermal-printer)
- [ZPL Programming Guide](https://www.zebra.com/us/en/support-downloads/knowledge-articles/zpl-programming-guide.html)
- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/)
- [QZ Tray Documentation](https://qz.io/wiki/)

### Proveedores de Hardware
- [Zebra Argentina](https://www.zebra.com/ar/es.html)
- [Brother Argentina](https://www.brother.com.ar/)
- [MercadoLibre](https://www.mercadolibre.com.ar/) - Búsqueda: "impresora térmica etiquetas"

### Proveedores de Etiquetas
- Etiquetas térmicas 80x50mm en rollo
- Adhesivo permanente
- Material: papel térmico directo
- Cantidad: 1000-5000 etiquetas por rollo

---

**Documento creado**: 27 de noviembre de 2026
**Versión**: 1.0
**Autor**: Asistente IA para Mora Gastronomía
