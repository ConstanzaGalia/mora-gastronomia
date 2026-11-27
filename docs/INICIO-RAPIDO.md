# 🚀 Inicio Rápido: 5 Minutos

## ¿Qué es esto?

Sistema para **imprimir etiquetas** automáticamente para las viandas con:
- Nombre del empleado
- Sector
- Empresa
- Fecha

## ¿Qué necesito?

1. **Impresora térmica** (USD 120-350)
   - Recomendada: Brother QL-820NWB (USD 220)
   
2. **Rollos de etiquetas** 80×50mm (USD 25-40)

3. **Computadora/Raspberry Pi** para correr el print worker

## ¿Cuánto cuesta?

- **Inicial**: USD 300-450
- **Mensual**: USD 10-30 en etiquetas
- **Software**: GRATIS

## ¿Cuánto tarda?

- **Leer documentación**: 1 hora
- **Decidir y comprar**: 1 semana
- **Implementar**: 4-5 semanas
- **Total**: 6 semanas

## ¿Qué leo primero?

### Si sos quien decide (gerente/dueño):
👉 **Leé**: [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md)
- **Tiempo**: 10 minutos
- **Qué tiene**: Costos, beneficios, ROI, timeline

### Si sos quien implementa (developer):
👉 **Leé**: [`ejemplo-implementacion-basica.md`](./ejemplo-implementacion-basica.md)
- **Tiempo**: 20 minutos
- **Qué tiene**: Código completo, paso a paso

### Si querés entenderlo todo:
👉 **Leé**: [`plan-impresora-termica.md`](./plan-impresora-termica.md)
- **Tiempo**: 25 minutos
- **Qué tiene**: Análisis completo, 3 opciones de hardware, 3 arquitecturas

### Si sos visual:
👉 **Leé**: [`diagramas-arquitectura.md`](./diagramas-arquitectura.md)
- **Tiempo**: 15 minutos
- **Qué tiene**: Diagramas de todo el sistema

## ¿Cómo funciona?

```
Usuario click "Imprimir 🏷️"
        ↓
   (2 segundos)
        ↓
   Sale etiqueta
```

Detrás de escena:
1. Browser → Next.js API
2. API → Print Worker (Node.js)
3. Worker → Impresora
4. ¡Listo! 🏷️

## Checklist de Decisión

- [ ] ¿Leí el resumen ejecutivo?
- [ ] ¿Tengo presupuesto? (USD 300-500)
- [ ] ¿Tengo espacio para la impresora?
- [ ] ¿Tengo tiempo para implementar? (4-5 semanas)
- [ ] ¿El personal está dispuesto?

**¿Todos ✅?** → ¡Adelante!

## ¿Qué hago ahora?

### Opción 1: Estudiar más (Recomendado)
1. Ir a [`README.md`](./README.md)
2. Leer el índice completo
3. Elegir qué leer según tu rol

### Opción 2: Empezar ya (Si ya tenés la impresora)
1. Ir a [`ejemplo-implementacion-basica.md`](./ejemplo-implementacion-basica.md)
2. Seguir paso a paso
3. En 1 hora tenés un prototipo funcionando

### Opción 3: Presentar a stakeholders
1. Abrir [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md)
2. Leerlo en reunión (10 min)
3. Tomar decisión

## Contacto

**¿Dudas técnicas?**
→ Ver sección Troubleshooting en [`ejemplo-implementacion-basica.md`](./ejemplo-implementacion-basica.md)

**¿Dudas de negocio?**
→ Ver sección ROI en [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md)

**¿Querés ver todo?**
→ Empezar por [`README.md`](./README.md)

---

## Resumen Ultra-Rápido

| Aspecto | Respuesta |
|---------|-----------|
| ¿Qué es? | Sistema de etiquetas automáticas para viandas |
| ¿Cuánto cuesta? | USD 300-450 inicial + USD 10-30/mes |
| ¿Cuánto tarda? | 6 semanas |
| ¿Es difícil? | No, hay guías paso a paso |
| ¿Vale la pena? | Sí, ROI 600-800% anual |
| ¿Qué hardware? | Brother QL-820NWB (USD 220) |
| ¿Qué software? | Todo gratis (Node.js + Express) |
| ¿Próximo paso? | Leer [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md) |

---

**Creado**: 27 de noviembre de 2026  
**Propósito**: Ayudarte a empezar en 5 minutos  
**Siguiente paso**: [`README.md`](./README.md) o [`RESUMEN-EJECUTIVO.md`](./RESUMEN-EJECUTIVO.md)
