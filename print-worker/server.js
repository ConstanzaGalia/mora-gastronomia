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
  type: PrinterTypes.EPSON,              // Para Brother, MUNBYN, Epson, Sch410b
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
