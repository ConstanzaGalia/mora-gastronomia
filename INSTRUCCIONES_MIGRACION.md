# Instrucciones para Aplicar la Migración de Turnos en Remitos

## ⚠️ Importante

No pude aplicar la migración automáticamente porque Supabase requiere acceso directo al dashboard o credenciales de conexión de base de datos que no están disponibles en este entorno.

## 📋 Pasos para Aplicar la Migración Manualmente

### Opción 1: Dashboard de Supabase (Recomendado)

1. **Abrí el Dashboard de Supabase**
   - Visitá: https://supabase.com/dashboard
   - Iniciá sesión con tu cuenta

2. **Seleccioná tu Proyecto**
   - Buscá el proyecto de Mora Gastronomía

3. **Abrí el SQL Editor**
   - En el menú lateral izquierdo, hacé clic en "SQL Editor"
   - Hacé clic en "+ New Query"

4. **Copiá y Pegá el SQL**
   - Abrí el archivo: `supabase/migrations/20261127150000_remito_meal_shifts.sql`
   - Copiá TODO el contenido del archivo
   - Pegalo en el editor SQL

5. **Ejecutá la Migración**
   - Hacé clic en el botón "Run" (esquina superior derecha)
   - Deberías ver un mensaje de éxito

6. **Verificá que Funcionó**
   - Podés ejecutar esta query para verificar:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'remito_items' 
   AND column_name = 'meal_shift';
   ```
   - Debería retornar una fila mostrando la nueva columna

### Opción 2: Supabase CLI (Alternativa)

Si preferís usar la línea de comandos:

1. **Instalá Supabase CLI** (si no lo tenés)
   ```bash
   npm install -g supabase
   # o
   brew install supabase/tap/supabase
   ```

2. **Linkeá tu Proyecto**
   ```bash
   cd /ruta/al/proyecto
   supabase link --project-ref TU_PROJECT_REF
   ```

3. **Aplicá las Migraciones**
   ```bash
   supabase db push
   ```

## ✅ Después de Aplicar la Migración

Una vez aplicada la migración:

1. Los **remitos nuevos** se generarán automáticamente con los items separados por turno
2. Los **remitos existentes** mantendrán su formato original (sin turnos)
3. Para regenerar un remito existente, deberías eliminarlo de la base de datos y volver a generarlo

## 🔍 Qué Hace Esta Migración

La migración realiza estos cambios:

1. **Agrega la columna `meal_shift`** a la tabla `remito_items`
   - Tipo: `public.meal_shift` (enum: 'MORNING', 'AFTERNOON', o NULL)
   - Permite identificar a qué turno pertenece cada item

2. **Actualiza la función `get_or_create_remito`**
   - Detecta si la empresa tiene turnos activados (`meal_shifts_enabled`)
   - Agrupa los items por turno cuando corresponde
   - Mantiene compatibilidad con empresas sin turnos

3. **Crea un índice** para mejorar el rendimiento
   - Índice en `(remito_id, meal_shift, sort_order, option_name)`

## 🆘 Si Necesitás Ayuda

Si tenés problemas aplicando la migración:

1. Verificá que tenés permisos de administrador en el proyecto de Supabase
2. Asegurate de estar ejecutando el SQL en el proyecto correcto
3. Si hay errores, revisá el mensaje de error en el SQL Editor

## 📝 Contenido de la Migración

El archivo de migración está en:
```
supabase/migrations/20261127150000_remito_meal_shifts.sql
```

Tiene aproximadamente 190 líneas de SQL que:
- Alteran la tabla `remito_items`
- Reescriben la función `get_or_create_remito`
- Crean índices necesarios
