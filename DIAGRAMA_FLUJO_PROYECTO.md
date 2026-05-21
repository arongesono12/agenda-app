# Diagrama visual del proyecto

Este documento resume el flujo de trabajo de la aplicacion: registro, seleccion o creacion de organo, gestion de tareas, asignaciones, alertas, dashboards y control por roles.

## Flujo principal de usuario

```mermaid
flowchart TD
  A[Usuario entra a la aplicacion] --> B{Tiene sesion activa?}
  B -- No --> C[Login o Registro]
  B -- Si --> D[Middleware valida sesion]

  C --> E{Registro nuevo?}
  E -- Login --> D
  E -- Registro --> F[Formulario de registro]

  F --> G{Correo termina en @segesa.gq?}
  G -- Si --> H[Asignar al organo Segesa]
  G -- No --> I{Elige organo existente?}

  I -- Si --> J[Crear membresia en organismo_miembros]
  I -- No --> K[Redirigir a Crear Organo]

  K --> L[Seleccionar plan]
  L --> M[Crear organo]
  M --> N[Comprador queda como administrador]

  H --> D
  J --> D
  N --> D

  D --> O{Tiene organo activo?}
  O -- No --> P[Seleccionar o crear organo]
  O -- Si --> Q[Resolver rol activo en el organo]

  Q --> R{Suscripcion activa?}
  R -- No --> S[Facturacion o planes]
  R -- Si --> T[Entrar al modulo permitido]

  T --> U[Agenda / Dashboard / Catalogos / Alertas / Historial]
```

## Arquitectura tecnica

```mermaid
flowchart LR
  subgraph Frontend[Frontend Next.js]
    UI[Paginas y componentes]
    Session[UserSessionProvider]
    Forms[Formularios: Registro, Login, Tareas, Catalogos]
  end

  subgraph Middleware[Middleware]
    Auth[Validar sesion Supabase]
    Org[Resolver organismo activo]
    Role[Resolver rol activo]
    Headers[Inyectar headers internos]
  end

  subgraph API[API Routes]
    Register[/api/register]
    Organismos[/api/organismos]
    Tareas[/api/tareas]
    Catalogos[/api/catalogos]
    Dashboard[/api/dashboard]
    Estadisticas[/api/estadisticas]
    Alertas[/api/alertas]
    Historial[/api/historial]
    Billing[/api/billing/*]
  end

  subgraph Supabase[Supabase]
    AuthDB[auth.users]
    Profiles[perfiles_usuario]
    Orgs[organismos]
    Members[organismo_miembros]
    Subs[organismo_suscripciones]
    Tasks[tareas]
    Assignments[tarea_asignaciones]
    Depts[departamentos]
    Responsables[responsables]
    Alerts[alertas]
    History[historial]
  end

  UI --> Session
  Forms --> API
  UI --> API
  Session --> Middleware

  Middleware --> Auth
  Auth --> Org
  Org --> Role
  Role --> Headers
  Headers --> API

  Register --> AuthDB
  Register --> Profiles
  Register --> Members

  Organismos --> Orgs
  Organismos --> Members
  Organismos --> Subs

  Tareas --> Tasks
  Tareas --> Assignments
  Tareas --> Alerts
  Tareas --> History

  Catalogos --> Depts
  Catalogos --> Responsables
  Dashboard --> Tasks
  Estadisticas --> Tasks
  Alertas --> Alerts
  Historial --> History
  Billing --> Subs
```

## Control de organos, roles y permisos

```mermaid
flowchart TD
  A[Request autenticada] --> B[Middleware lee cookie organismo_activo_id]
  B --> C[Buscar membresias del usuario]
  C --> D{Cookie coincide con una membresia activa?}

  D -- Si --> E[Usar ese organismo]
  D -- No --> F{Usuario pertenece a Segesa?}
  F -- Si --> G[Usar Segesa como organismo por defecto]
  F -- No --> H{Tiene un solo organismo?}
  H -- Si --> I[Usar unico organismo]
  H -- No --> J[Redirigir a seleccionar-organismo]

  E --> K[Leer rol_codigo en organismo_miembros]
  G --> K
  I --> K

  K --> L[Inyectar x-organismo-id]
  K --> M[Inyectar x-organismo-rol]

  L --> N[API filtra datos por organismo_id]
  M --> O[API aplica permisos por rol activo]

  O --> P{Rol activo}
  P -- Administrador --> Q[Ver y gestionar todo el organo]
  P -- Supervisor --> R[Gestionar tareas dentro de su alcance]
  P -- Responsable --> S[Ver y actualizar tareas asignadas]
  P -- Consulta --> T[Solo lectura permitida]
```

## Flujo de tareas

```mermaid
sequenceDiagram
  actor Admin as Administrador / Supervisor
  participant UI as Pantalla Agenda
  participant API as /api/tareas
  participant DB as Supabase
  participant Alertas as Alertas / Email

  Admin->>UI: Crea o edita una tarea
  UI->>API: Envia datos de tarea y responsables
  API->>API: Valida rol activo del organo
  API->>DB: Guarda tarea con organismo_id
  API->>DB: Sincroniza tarea_asignaciones
  API->>Alertas: Notifica a responsables nuevos
  API-->>UI: Devuelve tarea actualizada

  actor Responsable as Responsable
  Responsable->>UI: Abre sus tareas
  UI->>API: Consulta tareas
  API->>API: Aplica scope por usuario asignado
  API->>DB: Lee tareas asignadas
  API-->>UI: Lista filtrada

  Responsable->>UI: Actualiza avance/historial
  UI->>API: PATCH historial o tarea
  API->>DB: Guarda avance y trazabilidad
  API-->>UI: Confirma actualizacion
```

## Flujo de datos por modulos

```mermaid
flowchart TD
  A[Organismo activo] --> B[Tareas]
  A --> C[Responsables]
  A --> D[Departamentos]
  A --> E[Alertas]
  A --> F[Historial]
  A --> G[Suscripcion]

  B --> H[Agenda principal]
  B --> I[Dashboard]
  B --> J[Estadisticas]
  B --> K[Cronograma]
  B --> L[Busqueda]

  C --> M[Catalogos]
  D --> M
  C --> N[Asignacion de tareas]
  D --> N

  E --> O[Centro de alertas]
  F --> P[Auditoria y trazabilidad]
  G --> Q[Planes y facturacion]
```

## Estado especial de Segesa

```mermaid
flowchart TD
  A[Datos existentes de la aplicacion] --> B[Script ensure_segesa_organismo_scope.sql]
  B --> C[Crear organo Segesa con UUID fijo]
  B --> D[Asignar tareas, responsables, departamentos, historial y alertas a Segesa]
  B --> E[Asignar usuarios existentes como miembros de Segesa]
  B --> F[Crear suscripcion empresa activa]

  G[Nuevo usuario @segesa.gq] --> H[Registro detecta dominio Segesa]
  H --> I[Se vincula directamente al organo Segesa]
  I --> J[Elige rol dentro de Segesa]
  J --> K[Accede con la dinamica original]

  K --> L[Administradores ven tareas creadas y asignadas]
  K --> M[Responsables ven sus tareas asignadas]
  K --> N[Supervisores gestionan segun permisos]
```

