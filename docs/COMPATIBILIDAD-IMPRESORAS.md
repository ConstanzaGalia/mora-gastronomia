# 🖨️ Compatibilidad con Diferentes Impresoras

## Respuesta Corta

**El sistema funciona con casi cualquier impresora térmica**, solo cambian algunas líneas de configuración en el código.

---

## 🔧 ¿Qué Cambia Según el Modelo?

### 1. **El Protocolo** (Lenguaje de la impresora)

Hay 2 tipos principales:

```
📝 ESC/POS
   - Brother, Epson, Star, MUNBYN
   - El más común
   - Más fácil
   
📝 ZPL
   - Zebra
   - Más profesional
   - Más complejo
```

### 2. **El Tamaño de Etiqueta**

Cada impresora soporta diferentes anchos:

```
Brother QL-820NWB    → 12mm a 62mm de ancho
Zebra ZD410          → 25mm a 114mm de ancho
MUNBYN ITPP941       → 20mm a 80mm de ancho
```

**Pero**: Para nuestro caso usamos **50-80mm de ancho**, que **todas** soportan ✅

### 3. **La Configuración** (Solo 3 líneas de código)

```javascript
// Esto es LO ÚNICO que cambia:

const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // ← Acá cambia según marca
  interface: 'tcp://192.168.1.100',      // ← Acá va USB o IP
  characterSet: 'PC858_EURO',            // ← Casi siempre igual
};
```

---

## 📊 Tabla de Compatibilidad

| Marca | Modelo | Protocolo | Config en Código | Funciona? |
|-------|--------|-----------|------------------|-----------|
| **Brother** | QL-820NWB | ESC/POS | `PrinterTypes.EPSON` | ✅ Sí |
| **Brother** | QL-800 | ESC/POS | `PrinterTypes.EPSON` | ✅ Sí |
| **Zebra** | ZD410 | ZPL | Librería diferente* | ✅ Sí |
| **Zebra** | ZD420 | ZPL | Librería diferente* | ✅ Sí |
| **Epson** | TM-T20 | ESC/POS | `PrinterTypes.EPSON` | ✅ Sí |
| **Star** | TSP143 | ESC/POS | `PrinterTypes.STAR` | ✅ Sí |
| **MUNBYN** | ITPP941 | ESC/POS | `PrinterTypes.EPSON` | ✅ Sí |
| **Citizen** | CT-S310 | ESC/POS | `PrinterTypes.EPSON` | ✅ Sí |

*Para Zebra se usa otra librería pero funciona igual

---

## 🎯 Configuración por Marca

### Brother (Recomendada)

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // Brother usa protocolo EPSON
  interface: 'tcp://192.168.1.100',      // O 'usb://...'
  characterSet: 'PC858_EURO',
  options: {
    timeout: 5000
  }
};
```

**Tamaños de etiqueta que soporta**:
- 12mm × continuo
- 29mm × continuo
- 38mm × continuo
- 50mm × continuo ⭐ (recomendado para nosotros)
- 62mm × continuo ⭐ (recomendado para nosotros)

---

### Zebra

```javascript
// Con Zebra usamos ZPL en lugar de ESC/POS
// Se usa librería diferente: node-zebra

const zpl = `
^XA
^FO50,20^A0N,30,30^FDMora Gastronomia^FS
^FO50,80^A0N,50,50^FDGARCIA, MARIA^FS
^FO50,140^A0N,30,30^FDSector: Administracion^FS
^FO50,180^A0N,30,30^FDEmpresa: Zuliani Hnos.^FS
^FO50,220^A0N,30,30^FDFecha: 27/11/2026^FS
^XZ
`;

// Enviar por USB o red
printer.print(zpl);
```

**Tamaños de etiqueta que soporta**:
- 25mm a 114mm de ancho
- Largo variable
- 80mm × 50mm ⭐ (recomendado para nosotros)

---

### MUNBYN / Epson / Otras ESC/POS

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // La mayoría usa EPSON
  interface: 'usb://04b8:0e15',          // USB común
  characterSet: 'PC858_EURO',
  options: {
    timeout: 5000
  }
};
```

**Tamaños de etiqueta que soporta**:
- 20mm a 80mm de ancho
- 80mm × 50mm ⭐ (recomendado para nosotros)

---

## 📐 Tamaños de Etiqueta

### Nuestra Recomendación: 80mm × 50mm

```
┌──────────────────────────────────────┐
│                                      │  ▲
│  MORA GASTRONOMÍA                    │  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│                                      │  │
│  GARCÍA LÓPEZ, MARÍA                 │  │  50mm
│                                      │  │  alto
│  Sector: Administración              │  │
│  Empresa: Zuliani Hnos.              │  │
│  Fecha: 27/11/2026                   │  │
│  Turno: Mañana                       │  │
│                                      │  ▼
└──────────────────────────────────────┘
            80mm ancho
```

### Alternativa Compacta: 60mm × 40mm

```
┌────────────────────────────┐
│  MORA                      │  ▲
│  GARCÍA, MARÍA             │  │ 40mm
│  Admin • Zuliani           │  │ alto
│  27/11 • Mañana           │  ▼
└────────────────────────────┘
        60mm ancho
```

**Ambas funcionan con todas las impresoras** ✅

---

## 🔄 ¿Cómo Cambiar de Impresora?

### Si compraste Brother y querés cambiar a Zebra:

```javascript
// ANTES (Brother):
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100',
};

// DESPUÉS (Zebra):
// Cambias a librería node-zebra
// Y usas ZPL en lugar de métodos printer.println()
```

**Tiempo de cambio**: 30 minutos editando código

### Si compraste una Brother y comprás otra Brother:

```javascript
// Solo cambiar la IP o USB:

// Impresora 1:
interface: 'tcp://192.168.1.100'

// Impresora 2:
interface: 'tcp://192.168.1.101'
```

**Tiempo de cambio**: 1 minuto

---

## 🎨 ¿El Diseño Cambia?

### NO, el diseño es el mismo para todas

Lo que cambia es **cómo lo escribís en el código**:

#### Con ESC/POS (Brother, MUNBYN, Epson):

```javascript
printer.alignCenter();
printer.bold(true);
printer.println('MORA GASTRONOMIA');
printer.bold(false);
printer.newLine();
printer.println('GARCIA, MARIA');
```

#### Con ZPL (Zebra):

```zpl
^XA
^FO50,20^A0N,30,30^FDMora Gastronomia^FS
^FO50,80^A0N,50,50^FDGARCIA, MARIA^FS
^XZ
```

**Resultado visual**: IDÉNTICO ✅

---

## 🔍 ¿Cómo Saber Qué Protocolo Usa Mi Impresora?

### Método 1: Por la Marca

```
Brother → ESC/POS
Zebra → ZPL
Epson → ESC/POS
Star → ESC/POS
Citizen → ESC/POS
Bixolon → ESC/POS
```

### Método 2: Buscar en Google

```
"[MODELO DE IMPRESORA] protocol"
```

Ejemplo: "Brother QL-820NWB protocol" → Respuesta: ESC/POS

### Método 3: En el Manual

Buscar en el manual de la impresora:
- "Command set"
- "Programming language"
- "Supported protocols"

---

## 💻 Código Adaptable

### Versión Genérica (Funciona con Todo)

```javascript
// print-worker/server.js

// 1. Configuración (lo único que cambia)
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // ← CAMBIAR SEGÚN MARCA
  interface: 'tcp://192.168.1.100',      // ← CAMBIAR SEGÚN CONEXIÓN
  characterSet: 'PC858_EURO',            // ← Dejar así
};

// 2. El resto del código es IDÉNTICO para todas
app.post('/print', async (req, res) => {
  const { nombre, apellido, sector, empresa, fecha, turno } = req.body;
  
  const printer = new ThermalPrinter(PRINTER_CONFIG);
  
  // Este código funciona con todas las impresoras ESC/POS:
  printer.alignCenter();
  printer.bold(true);
  printer.println('MORA GASTRONOMIA');
  printer.drawLine();
  printer.bold(false);
  printer.newLine();
  
  printer.setTextSize(2, 2);
  printer.bold(true);
  printer.println(`${apellido}, ${nombre}`);
  printer.setTextNormal();
  printer.newLine();
  
  printer.alignLeft();
  printer.println(`Sector: ${sector || 'Sin asignar'}`);
  printer.println(`Empresa: ${empresa}`);
  printer.println(`Fecha: ${fecha}`);
  if (turno) {
    printer.println(`Turno: ${turno === 'MORNING' ? 'Manana' : 'Tarde'}`);
  }
  printer.newLine();
  printer.cut();
  
  await printer.execute();
  res.json({ success: true });
});
```

---

## 🛠️ Tipos Disponibles en node-thermal-printer

```javascript
PrinterTypes.EPSON    // Brother, MUNBYN, Epson, Citizen
PrinterTypes.STAR     // Star Micronics
PrinterTypes.TANCA    // Tanca
```

**La mayoría usa `PrinterTypes.EPSON`** ✅

---

## 🎯 Recomendación por Caso de Uso

### Para Empezar:

```
✅ Brother QL-820NWB
✅ Protocolo: ESC/POS (fácil)
✅ Código: 90% ya hecho en la guía
✅ Configuración: 3 líneas
```

### Para Volumen Alto (500+ viandas/día):

```
✅ Zebra ZD410
✅ Protocolo: ZPL (más robusto)
✅ Código: Hay que adaptarlo un poco
✅ Configuración: 10 líneas
```

### Para Presupuesto Ajustado:

```
✅ MUNBYN ITPP941
✅ Protocolo: ESC/POS (fácil)
✅ Código: 90% ya hecho en la guía
✅ Configuración: 3 líneas
```

---

## 🔄 Migración entre Modelos

### De Brother a Zebra:

```javascript
// 1. Instalar nueva librería
npm uninstall node-thermal-printer
npm install node-zebra

// 2. Cambiar código (30 minutos)
// 3. Probar
// 4. Listo ✅
```

**Tiempo total**: 1 hora

### De Brother a otra Brother:

```javascript
// 1. Cambiar IP/USB
interface: 'tcp://192.168.1.101'

// 2. Listo ✅
```

**Tiempo total**: 1 minuto

### De MUNBYN a Epson (ambas ESC/POS):

```javascript
// No cambiar nada, funciona igual ✅
```

**Tiempo total**: 0 minutos

---

## 📋 Checklist de Compatibilidad

Antes de comprar una impresora, verificá:

- [x] ¿Soporta etiquetas de 50-80mm de ancho? → **Debe ser SÍ**
- [x] ¿Es térmica directa? → **Debe ser SÍ**
- [x] ¿Tiene USB o WiFi? → **Al menos una de las dos**
- [x] ¿Protocolo ESC/POS o ZPL? → **Cualquiera funciona**
- [x] ¿Velocidad mayor a 50mm/s? → **Recomendado**

Si todo es ✅ → **Funciona con nuestro sistema** 🎉

---

## 🎓 Ejemplos Reales de Configuración

### Ejemplo 1: Brother QL-820NWB por WiFi

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100',      // IP de la impresora
  characterSet: 'PC858_EURO',
};
```

### Ejemplo 2: Brother QL-820NWB por USB

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,
  interface: 'usb://04f9:2042',          // Vendor:Product ID de Brother
  characterSet: 'PC858_EURO',
};
```

### Ejemplo 3: MUNBYN ITPP941 por USB

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,
  interface: 'usb://0483:5743',          // Vendor:Product ID de MUNBYN
  characterSet: 'PC858_EURO',
};
```

### Ejemplo 4: Zebra ZD410 por Red

```javascript
// Con Zebra usamos otra librería
const zebra = require('node-zebra');

zebra.print({
  hostname: '192.168.1.100',
  port: 9100,
}, zplCode);
```

---

## 🎯 Resumen Final

### ¿El sistema cambia según el modelo?

**NO**, solo cambian **3 líneas de configuración**.

### ¿Funciona con cualquier impresora?

**SÍ**, con cualquier impresora térmica que use:
- ESC/POS (90% de las impresoras) ✅
- ZPL (Zebra) ✅

### ¿Y el tamaño de etiqueta?

**Se adapta automáticamente**. Mientras la impresora soporte 50-80mm de ancho (todas lo hacen), funciona ✅

### ¿Qué pasa si compro una impresora diferente después?

**Cambias 3 líneas de código** y listo. O si es de la misma marca, **solo cambias la IP**.

---

## 💡 Conclusión

**El sistema es agnóstico al modelo de impresora** 🎉

Lo importante es que sea:
- ✅ Térmica
- ✅ De etiquetas (no de tickets)
- ✅ Con ancho de 50-80mm

El resto son **detalles de configuración** que se resuelven en minutos.

---

**Recomendación**: Empezá con **Brother QL-820NWB** porque ya está todo configurado en los ejemplos. Después podés cambiar sin drama.
