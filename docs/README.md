# Documentación - Mora Gastronomía

## 🚀 Inicio Rápido

**¿Primera vez aquí?** → Lee [`INICIO-RAPIDO.md`](./INICIO-RAPIDO.md) (5 minutos)

**¿Querés decidir?** → Lee [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md) (10 minutos)

**¿Vas a implementar?** → Lee [`ejemplo-implementacion-basica.md`](./ejemplo-implementacion-basica.md) (20 minutos)

---

## Índice de Documentos

### 🖨️ Sistema de Impresión de Etiquetas

Documentación completa para implementar impresión térmica de etiquetas para viandas.

#### ⚡ [Inicio Rápido](./INICIO-RAPIDO.md) **(EMPIEZA AQUÍ)**
Guía de 5 minutos para saber qué es esto y qué hacer.
- Resumen ultra-rápido
- Checklist de decisión
- Por dónde empezar según tu rol

**Tiempo de lectura**: 5 minutos  
**Audiencia**: Todos

#### 🔌 [Conexiones Simples](./CONEXIONES-SIMPLES.md) **(¿NECESITO UN RASPBERRY PI?)**
Explicación simple de cómo se conecta todo físicamente.
- ✅ NO necesitás Raspberry Pi si ya tenés una PC
- Diagramas de conexión USB y WiFi
- Comparación de opciones
- Respuestas a preguntas sobre conexiones

**Tiempo de lectura**: 8 minutos  
**Audiencia**: Quien va a instalar físicamente el sistema

#### 📊 [Resumen Ejecutivo](./RESUMEN-EJECUTIVO.md)
Vista ejecutiva del proyecto completo.
- Inversión requerida (USD 300-450)
- ROI y métricas de éxito
- Timeline de 6 semanas
- Riesgos y mitigaciones
- Checklist de decisión
- Recomendaciones finales

**Tiempo de lectura**: 10 minutos  
**Audiencia**: Gerentes, dueños, tomadores de decisión

#### 📋 [Plan de Impresión Térmica](./plan-impresora-termica.md)
Documento completo de investigación y planificación que incluye:
- Análisis del sistema actual
- Opciones de hardware (Zebra, Brother, MUNBYN)
- Protocolos de impresión (ZPL, ESC/POS)
- Bibliotecas de software recomendadas
- Tres arquitecturas propuestas
- Diseño de etiquetas
- Plan de implementación en 5 fases
- Consideraciones técnicas (seguridad, rendimiento, errores)
- Costos estimados
- Recomendación final
- FAQ y recursos

**Tiempo de lectura**: 20-30 minutos  
**Audiencia**: Desarrolladores, gerentes técnicos, tomadores de decisión

#### 🚀 [Ejemplo de Implementación Básica](./ejemplo-implementacion-basica.md)
Guía práctica paso a paso para tener un prototipo funcionando rápidamente:
- Instalación del print worker (Node.js + Express)
- Configuración de impresora USB o red
- Creación de API route en Next.js
- Componente React para imprimir
- Integración en la página de comensales
- Troubleshooting común
- Scripts útiles

**Tiempo de implementación**: ~1 hora  
**Nivel**: Intermedio  
**Audiencia**: Desarrolladores que implementarán el sistema

---

## Estructura de Archivos del Proyecto

```
mora-gastronomia/
├── app/
│   ├── (app)/
│   │   ├── comensales/
│   │   │   └── imprimir/page.tsx  # Página de impresión (punto de integración)
│   │   └── viandas/page.tsx       # Informe de viandas
│   └── api/
│       └── labels/
│           └── print/route.ts     # API endpoint para impresión (a crear)
├── components/
│   ├── diner-table.tsx            # Tabla de comensales (a modificar)
│   └── print-label-button.tsx     # Botón de impresión (a crear)
├── lib/
│   └── diners.ts                  # Lógica de comensales
├── print-worker/                   # Worker de impresión (a crear)
│   ├── server.js
│   ├── package.json
│   └── README.md
└── docs/                          # Esta carpeta
    ├── README.md                  # Este archivo
    ├── plan-impresora-termica.md
    └── ejemplo-implementacion-basica.md
```

---

## Decisiones Pendientes

Antes de comenzar la implementación, es necesario decidir:

1. **Hardware**: ¿Qué modelo de impresora comprar?
   - [ ] Zebra ZD410 (USD 350) - Recomendada
   - [ ] Brother QL-820NWB (USD 220)
   - [ ] MUNBYN ITPP941 (USD 120)

2. **Arquitectura**: ¿Qué enfoque usar?
   - [ ] Worker Local (Recomendado)
   - [ ] QZ Tray
   - [ ] WebUSB

3. **Tamaño de etiqueta**: ¿Qué dimensiones?
   - [ ] 80mm × 50mm (Recomendado)
   - [ ] 60mm × 40mm (Compacto)
   - [ ] 100mm × 60mm (Extra grande)

4. **Ubicación**: ¿Dónde estará la impresora?
   - [ ] Cocina
   - [ ] Área de despacho
   - [ ] Oficina administrativa

5. **Volumen**: ¿Cuántas viandas por día?
   - [ ] < 50
   - [ ] 50 - 100
   - [ ] 100 - 500
   - [ ] > 500

---

## Próximos Pasos

### 1. Aprobar Presupuesto ⏳
- Revisar costos en el plan completo
- Aprobar compra de hardware

### 2. Comprar Hardware ⏳
- Impresora térmica
- Rollos de etiquetas
- Cables adicionales si son necesarios

### 3. Desarrollo 🔧
- Seguir la guía de implementación básica
- Testing con datos reales
- Ajustes de diseño de etiqueta

### 4. Deploy 🚀
- Instalar impresora en ubicación final
- Configurar worker en servidor
- Capacitar al personal
- Monitorear primeros días

---

## Contacto y Soporte

Para preguntas sobre la implementación:
- Revisar primero la sección de Troubleshooting
- Consultar FAQ en el plan completo
- Contactar al equipo de desarrollo

---

## Changelog

### 2026-11-27
- ✅ Creación de documentación inicial
- ✅ Plan completo de implementación
- ✅ Guía de implementación básica
- ✅ Este archivo README

---

## Licencia y Uso

Esta documentación es parte del proyecto Mora Gastronomía y es de uso interno.
No compartir fuera de la organización sin autorización.
