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
7. Ejecuta despues [migration_security_hardening.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_security_hardening.sql) para aplicar permisos por rol y endurecer RLS.
8. Ejecuta despues [migration_responsables_notificaciones.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_responsables_notificaciones.sql) para asociar responsables con usuarios, alertas internas y emails.
9. Ejecuta despues [migration_scalability_phase2.sql](C:/Users/admesono/Desktop/Proyectos/agenda-app/supabase/migration_scalability_phase2.sql) para activar RLS por alcance, RPCs agregadas e indices de escala.
10. Copia la URL del proyecto y la clave anon desde `Settings -> API`.

### 2. Variables de entorno

Usa el archivo de ejemplo:

```bash
copy .env.example .env.local
```

Completa `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
AGENDA_BOOTSTRAP_TOKEN=token-largo-y-aleatorio
AGENDA_BOOTSTRAP_USERS=[{"email":"admin@empresa.com","password":"ChangeMe123!"}]
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=Agenda <agenda@tu-dominio.com>
AGENDA_ALERTS_CRON_TOKEN=otro-token-largo-y-aleatorio
```

Para procesar vencimientos automaticamente, configura un cron externo o Vercel Cron que invoque `GET` o `POST /api/alertas/vencimientos` con el header `Authorization: Bearer <AGENDA_ALERTS_CRON_TOKEN>`.

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

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Recharts
- Lucide React
- date-fns

## Escalabilidad

- Las pantallas de agenda y busqueda usan `/api/tareas` con paginacion, filtros server-side y limite maximo de pagina.
- Dashboard y estadisticas usan RPCs SQL (`api_dashboard_data`, `api_estadisticas_data`) cuando la migracion de escala esta aplicada; si no existe, las APIs hacen fallback a calculos TypeScript.
- La migracion de escala endurece RLS por alcance: administradores gestionan todo, supervisores operan por departamento o asignacion, responsables solo sus tareas, consulta mantiene lectura.
- Los clientes Supabase usan el contrato tipado de [database.types.ts](C:/Users/admesono/Desktop/Proyectos/agenda-app/lib/database.types.ts). En CI se recomienda regenerarlo con Supabase CLI cuando cambie el esquema.
