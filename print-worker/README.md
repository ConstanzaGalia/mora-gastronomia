# Print Worker - Mora Gastronomía

Servidor Node.js para imprimir etiquetas térmicas.

## Instalación

```bash
cd print-worker
npm install
```

## Configuración

Editar `server.js` línea 11-20 con los datos de tu impresora:

```javascript
const PRINTER_CONFIG = {
  type: PrinterTypes.EPSON,              // Para Brother, MUNBYN, Epson, Sch410b
  interface: 'tcp://192.168.1.100',      // ← CAMBIAR por tu IP o USB
  characterSet: 'PC858_EURO',
};
```

### Opciones de conexión:

**Por USB:**
```javascript
interface: 'usb://04f9:2042'  // Vendor:Product ID
```

**Por Red (IP):**
```javascript
interface: 'tcp://192.168.1.100'  // IP de la impresora
```

## Uso

### Iniciar el servidor:

```bash
npm start
```

### Probar la conexión:

```bash
# Health check
curl http://localhost:3001/health

# Imprimir prueba
curl -X POST http://localhost:3001/test
```

## Endpoints

### GET /health
Verificar que el servidor está corriendo.

### POST /print
Imprimir una etiqueta individual.

```json
{
  "nombre": "María",
  "apellido": "García",
  "sector": "Administración",
  "empresa": "Zuliani Hnos.",
  "fecha": "2026-11-27",
  "turno": "MORNING"
}
```

### POST /print-batch
Imprimir múltiples etiquetas.

```json
{
  "labels": [
    {
      "nombre": "María",
      "apellido": "García",
      "sector": "Administración",
      "empresa": "Zuliani Hnos.",
      "fecha": "2026-11-27",
      "turno": "MORNING"
    },
    ...
  ]
}
```

### POST /test
Imprimir una etiqueta de prueba.

## Troubleshooting

### Error: "Impresora no conectada"

1. Verificar que la impresora está encendida
2. Verificar cable USB o conexión de red
3. En Linux, verificar permisos: `sudo chmod 666 /dev/usb/lp0`
4. Revisar la configuración en `PRINTER_CONFIG`

### Texto con caracteres raros

Cambiar el `characterSet` en `PRINTER_CONFIG`:
- `PC858_EURO`
- `PC437_USA`
- `WPC1252`
