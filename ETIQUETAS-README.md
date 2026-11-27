# 🏷️ Sistema de Etiquetas Térmicas - Mora Gastronomía

## ✅ Implementación Completa

El sistema de etiquetas térmicas está **completamente implementado** en el código.

## 📂 Archivos Creados

### Print Worker (Backend)
```
print-worker/
├── server.js           ← Servidor Node.js completo
├── package.json        ← Dependencias
└── README.md           ← Instrucciones de uso
```

### API Routes (Next.js)
```
app/api/labels/
├── print/route.ts              ← Impresión individual
└── print-batch/route.ts        ← Impresión masiva
```

### Componentes React
```
components/
├── print-label-button.tsx              ← Botón 🏷️ individual
└── print-labels-batch-button.tsx       ← Botón masivo
```

### Archivos Modificados
```
app/(app)/comensales/page.tsx           ← Integración del botón masivo
components/diner-table.tsx               ← Integración de columna de etiquetas
```

## 🚀 Cómo Usar

### Paso 1: Instalar Print Worker

```bash
cd print-worker
npm install
```

### Paso 2: Configurar Impresora

Editar `print-worker/server.js` líneas 11-20:

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // Para Brother, MUNBYN, Epson, Sch410b
  interface: 'tcp://192.168.1.100',      // ← CAMBIAR por tu IP o USB
  characterSet: 'PC858_EURO',
};
```

**Opciones:**
- **Por USB**: `interface: 'usb://04f9:2042'`
- **Por Red**: `interface: 'tcp://192.168.1.100'`

### Paso 3: Configurar Variables de Entorno

Crear `.env.local` en la raíz del proyecto:

```bash
PRINT_WORKER_URL=http://localhost:3001
```

(Ver `.env.local.example` para referencia)

### Paso 4: Iniciar Print Worker

```bash
cd print-worker
npm start
```

Deberías ver:

```
🖨️  ════════════════════════════════════════════════
🖨️   MORA - Print Worker
🖨️  ════════════════════════════════════════════════
🖨️   Server:    http://localhost:3001
🖨️   Printer:   tcp://192.168.1.100
🖨️   Type:      EPSON
🖨️  ════════════════════════════════════════════════
✅  Listo para recibir trabajos de impresión
```

### Paso 5: Probar Conexión

```bash
# Health check
curl http://localhost:3001/health

# Imprimir etiqueta de prueba
curl -X POST http://localhost:3001/test
```

Si sale una etiqueta de prueba: ✅ **¡Funciona!**

### Paso 6: Usar en la Aplicación

1. Iniciar Next.js: `pnpm dev`
2. Ir a `/comensales`
3. Seleccionar fecha y empresa
4. Click en **"Imprimir Etiquetas (N)"** → Imprime todas 🎉
5. O click en **🏷️** de cada fila → Imprime solo esa

## 📸 Resultado

### Vista de la Página `/comensales`

```
┌────────────────────────────────────────────────────┐
│ COMENSALES                                         │
│ Zuliani Hnos.                                      │
│                                                    │
│ [Exportar PDF]  [🏷️ Imprimir Etiquetas (45)]     │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ EMPLEADO    │ TURNO  │ ... │ ETIQUETA      │  │
│ ├──────────────────────────────────────────────┤  │
│ │ García, M.  │ Mañana │ ... │ 🏷️            │  │
│ │ López, J.   │ Tarde  │ ... │ 🏷️            │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Etiqueta Impresa

```
┌────────────────────────────────┐
│  MORA GASTRONOMÍA              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                │
│  GARCÍA, MARÍA                 │
│                                │
│  Sector: Administración        │
│  Empresa: Zuliani Hnos.        │
│  Fecha: Viernes 27 de noviembre│
│  Turno: MAÑANA                 │
│                                │
└────────────────────────────────┘
```

## 🔧 Troubleshooting

### Error: "Impresora no conectada"

1. ✅ Verificar que la impresora está encendida
2. ✅ Verificar cable USB o conexión de red
3. ✅ Revisar IP/USB en `PRINTER_CONFIG`
4. ✅ En Linux: `sudo chmod 666 /dev/usb/lp0`

### Error: "Cannot connect to print worker"

1. ✅ Verificar que el print worker está corriendo
2. ✅ Verificar que `PRINT_WORKER_URL` está en `.env.local`
3. ✅ Verificar firewall/antivirus

### Texto con caracteres raros

Cambiar `characterSet` en `PRINTER_CONFIG`:
- `PC858_EURO`
- `PC437_USA`
- `WPC1252`

## 📚 Documentación Completa

Toda la documentación está en la carpeta `/docs`:

- **[PLAN-IMPLEMENTACION-ETIQUETAS.md](./docs/PLAN-IMPLEMENTACION-ETIQUETAS.md)** - Plan completo paso a paso
- **[CONEXIONES-SIMPLES.md](./docs/CONEXIONES-SIMPLES.md)** - Cómo conectar físicamente
- **[COMPATIBILIDAD-IMPRESORAS.md](./docs/COMPATIBILIDAD-IMPRESORAS.md)** - Compatibilidad con diferentes modelos
- **[ANALISIS-SCH410B.md](./docs/ANALISIS-SCH410B.md)** - Análisis de la impresora Sch410b
- **[plan-impresora-termica.md](./docs/plan-impresora-termica.md)** - Plan completo de investigación

## 💡 Próximos Pasos

1. ✅ Código implementado → **COMPLETADO**
2. ⏳ Comprar impresora térmica → **PENDIENTE**
3. ⏳ Configurar impresora → **PENDIENTE**
4. ⏳ Probar con datos reales → **PENDIENTE**
5. ⏳ Capacitar al personal → **PENDIENTE**

## 🎯 Funcionalidades Implementadas

✅ Impresión individual (botón 🏷️ en cada fila)
✅ Impresión masiva (botón "Imprimir Etiquetas")
✅ Validación de permisos
✅ Manejo de errores
✅ Feedback visual (✅ / ❌ / ⏳)
✅ Confirmación antes de imprimir lote
✅ Progreso en tiempo real
✅ Formato de etiqueta con todos los datos
✅ Normalización de texto (sin acentos)
✅ Fecha en español

## 📞 Soporte

Para cualquier problema o pregunta, revisar la documentación en `/docs` o los README específicos en cada carpeta.

---

**Estado**: ✅ Implementación completa - Listo para usar cuando tengan la impresora
