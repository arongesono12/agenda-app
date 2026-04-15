# Control Automatizado - Plan de Trabajo

Sistema de gestion de tareas y seguimiento operativo construido con Next.js y Supabase.

## Modulos

| Modulo | Ruta | Descripcion |
|---|---|---|
| Agenda diaria | `/` | Tabla principal con filtros, semaforo, avance y acciones |
| Dashboard | `/dashboard` | KPIs ejecutivos, graficos por area y avance global |
| Alertas | `/alertas` | Seguimiento de vencidas, urgentes y proximas |
| Cronograma | `/cronograma` | Vista tipo Gantt por dias del mes |
| Estadisticas | `/estadisticas` | Analisis por prioridad, tipo y departamento |
| Busqueda | `/busqueda` | Filtros combinados sobre las tareas |
| Perfil | `/perfil` | Perfil del usuario autenticado con cambio de nombre y contrasena |
| Configuracion | `/configuracion` | Preferencias personales de la agenda por usuario |
| Responsables | `/responsable` | Panel personal por responsable |
| Historial | `/historial` | Auditoria automatica de cambios |
| Catalogos | `/catalogos` | Gestion de departamentos y responsables |

## Requisitos

- Node.js 18 o superior
- npm
- Un proyecto de Supabase

## Configuracion

### 1. Base de datos en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Abre el SQL Editor.
3. Ejecuta el contenido de [schema.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/schema.sql).
4. Ejecuta despues [migration_user_profiles.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_user_profiles.sql) para habilitar perfiles y tipos de usuario.
5. Ejecuta luego [migration_user_avatars.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_user_avatars.sql) para habilitar fotos de perfil.
6. Ejecuta despues [migration_user_preferences.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_user_preferences.sql) para guardar preferencias por usuario.
7. Copia la URL del proyecto y la clave anon desde `Settings -> API`.

### 2. Variables de entorno

Usa el archivo de ejemplo:

```bash
copy .env.local.example .env.local
```

Completa `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

### 3. Instalar y ejecutar

```bash
npm install
npm run dev
```

La app se abre en [http://localhost:3004](http://localhost:3004).

## Datos principales

La tabla `tareas` incluye:

- `codigo_id`: identificador manual de tarea
- `tarea`: descripcion
- `prioridad`: Alta, Media o Baja
- `departamento`
- `responsable`
- `fecha_inicio`
- `fecha_fin`
- `dias_totales`
- `dias_restantes`
- `semaforo`
- `porcentaje_avance`
- `estado`
- `tipo_tarea`
- `notas`

## Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Recharts
- Lucide React
- date-fns
