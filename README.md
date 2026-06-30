# Agenda Segesa - Guia completa de la aplicacion

Agenda Segesa es una aplicacion web para registrar, asignar, consultar y dar seguimiento a tareas operativas. Esta construida con Next.js y Supabase, usa autenticacion por usuario y separa los permisos por rol para que cada persona vea y haga solo lo que corresponde a su trabajo.

Este README debe servir como fuente principal para crear manuales de usuario final, guias internas de trabajo y documentacion tecnica del proyecto.

## Regla obligatoria de mantenimiento

Cada vez que se modifique un flujo de trabajo de la aplicacion, tambien se debe actualizar este `README.md` en el mismo cambio.

Se considera cambio de flujo cualquier ajuste que afecte como un usuario:

- entra o se registra en la aplicacion;
- crea, edita, elimina, asigna, reasigna o finaliza tareas;
- consulta dashboard, agenda, alertas, busqueda, cronograma, estadisticas o historial;
- cambia permisos, roles, catalogos, responsables o departamentos;
- recibe notificaciones internas o por correo;
- configura su perfil o preferencias.

Antes de cerrar cualquier modificacion funcional, revisar la seccion afectada de este documento y dejarla alineada con el comportamiento real de la app. Si el cambio es puramente visual y no altera el uso, no hace falta ampliar el manual, pero si conviene ajustar nombres de botones, pantallas o textos si cambiaron.

## Resumen del sistema

La aplicacion centraliza el plan de trabajo en una agenda diaria. Permite:

- crear tareas con prioridad, estado, fechas, departamentos, responsables, tipo, avance y notas;
- asignar una tarea a uno o varios responsables, segun el rol del usuario;
- dar seguimiento mediante historial de ordenes, notas, avances, incidencias y recordatorios;
- finalizar tareas desde el historial, marcandolas como `Completado` y avance `100%`;
- consultar indicadores ejecutivos, estadisticas y carga por responsable;
- visualizar tareas por fechas en un cronograma mensual;
- detectar tareas vencidas, urgentes y proximas;
- mantener catalogos maestros de departamentos y responsables;
- conservar auditoria automatica de cambios;
- notificar nuevas asignaciones, vencimientos y tareas completadas.

## Roles y permisos

La aplicacion usa los roles definidos en `tipos_usuario` y calculados en `lib/access-control.ts` y `lib/role-capabilities.ts`.

| Rol | Entrada inicial | Puede ver | Puede hacer |
|---|---|---|---|
| Administrador / Administradora | `/dashboard` | Todas las pantallas principales | Crear, editar y eliminar tareas; asignar varios responsables; gestionar catalogos; ver datos globales |
| Supervisor | `/dashboard` | Agenda, dashboard, alertas, cronograma, estadisticas, busqueda, responsables e historial | Crear y editar tareas dentro de su alcance; asignar o reasignar a responsables de su departamento; no elimina tareas ni gestiona catalogos |
| Responsable | `/` | Agenda, dashboard, alertas, cronograma e historial | Consultar sus tareas asignadas, registrar avances/ordenes en historial y finalizar tareas permitidas |
| Consulta | `/dashboard` | Dashboard, alertas, busqueda, cronograma y estadisticas | Solo lectura, sin acciones de edicion |

Rutas comunes para usuarios autenticados: `/perfil`, `/configuracion` y `/forbidden`.

## Flujo de acceso

### Iniciar sesion

Ruta: `/login`

1. El usuario introduce correo corporativo y contrasena.
2. Puede mostrar u ocultar la contrasena.
3. Si olvido la contrasena, entra por el enlace de recuperacion.
4. Al iniciar sesion correctamente, la app lee el perfil y envia al usuario a su pantalla inicial segun su rol.

### Registro de usuarios

Ruta: `/registro`

1. El usuario indica nombre completo, correo, rol solicitado y departamento.
2. Define contrasena y confirmacion con minimo 8 caracteres.
3. Debe confirmar que los datos son correctos.
4. La cuenta queda creada en Supabase Auth y asociada a un perfil interno, rol y departamento.
5. El responsable tambien queda sincronizado en el catalogo de responsables.

### Recuperacion y cambio de contrasena

Rutas: `/recuperar-password` y `/actualizar-password`

1. El usuario solicita la recuperacion con su correo en `/recuperar-password`.
2. El backend genera el correo con el callback publico `/auth/callback?next=/actualizar-password`.
3. El callback intercambia el codigo temporal de Supabase por una sesion segura en cookies y abre el formulario de dos campos.
4. El formulario envia la nueva contrasena al backend, que valida la sesion temporal y actualiza Supabase Auth.
5. Al terminar, la sesion de recuperacion se cierra y el usuario vuelve al login.

En produccion, `NEXT_PUBLIC_APP_URL` debe contener el origen HTTPS publico, sin rutas. En Supabase, dentro de **Authentication > URL Configuration**, la **Site URL** debe ser ese mismo origen y **Redirect URLs** debe incluir exactamente `https://dominio-publico/auth/callback` (o un patron autorizado que lo cubra). Si falta, Supabase ignora `redirectTo` y utiliza la Site URL configurada, que no debe apuntar a localhost.

## Modulos de la aplicacion

| Modulo | Ruta | Uso principal |
|---|---|---|
| Agenda diaria | `/` | Gestion y seguimiento principal de tareas |
| Dashboard | `/dashboard` | KPIs, graficos y resumen ejecutivo |
| Alertas | `/alertas` | Riesgos por vencimiento y alertas personales |
| Calendario | `/calendario` | Festivos y eventos institucionales del organismo |
| Cronograma | `/cronograma` | Vista mensual tipo Gantt por fecha de inicio y fin |
| Estadisticas | `/estadisticas` | Analisis por prioridad, tipo y departamento |
| Busqueda | `/busqueda` | Filtros avanzados sobre tareas |
| Responsable | `/responsable` | Consulta de carga individual por responsable |
| Historial | `/historial` | Auditoria y bitacora de cambios |
| Catalogos | `/catalogos` | Gestion de departamentos, responsables y valores base |
| Reuniones | `/reuniones` | Programacion de reuniones del organismo con invitaciones y enlaces Google Meet |
| Perfil | `/perfil` | Datos personales, avatar y contrasena |
| Configuracion | `/configuracion` | Tema visual y preferencias personales |
| Privacidad | `/privacidad` | Información pública sobre tratamiento de datos y derechos |
| Términos | `/terminos` | Condiciones públicas de acceso y uso del servicio |

## Documentos legales

Las rutas `/privacidad` y `/terminos` son públicas y están enlazadas desde login, registro y footer. El registro exige aceptar ambos documentos y el backend guarda en los metadatos de Supabase Auth la versión y fecha aceptadas.

La identidad mostrada se configura mediante `LEGAL_ENTITY_NAME`, `LEGAL_PRODUCT_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_PRIVACY_EMAIL` y `LEGAL_SUPPORT_EMAIL`. Antes de producción se deben verificar la razón social, domicilio y existencia de los buzones publicados, y obtener revisión de un profesional cualificado en Guinea Ecuatorial.

La Política de Privacidad describe el modelo multi-organismo, los datos tratados, cookies técnicas, proveedores, transferencias internacionales, conservación, seguridad y derechos de información, acceso, rectificación, cancelación y oposición conforme a la Ley Núm. 1/2016 de Protección de Datos Personales.

## Agenda diaria

Ruta: `/`

Es la pantalla principal de trabajo. Muestra tareas paginadas con KPIs, filtros, tabla de tareas, tarjetas en movil y panel lateral de detalle.

### Indicadores visibles

La cabecera puede mostrar:

- total de tareas;
- pendientes;
- en proceso;
- completadas;
- alta prioridad;
- urgentes;
- vencidas.

Cada usuario puede ocultar o mostrar estos KPIs desde `/configuracion`.

### Filtros disponibles

La agenda permite buscar y filtrar por:

- texto en tarea o responsable;
- prioridad;
- departamento;
- estado;
- tipo de tarea.

Los filtros pueden abrirse por defecto si el usuario activa esa preferencia en configuracion.

### Acciones sobre tareas

Segun permisos, el usuario puede:

- recargar la lista;
- crear una nueva tarea;
- abrir el detalle completo;
- editar la tarea;
- abrir el historial;
- eliminar la tarea.

La eliminacion requiere confirmacion y solo esta disponible para administradores.

## Crear o editar tareas

Modal usado desde la agenda.

Campos principales:

- `Tarea`: descripcion obligatoria del objetivo o entregable;
- `ID de tarea manual`: codigo numerico opcional;
- `Prioridad`: Alta, Media o Baja;
- `Estado`: Pendiente, En Proceso, Completado o Cancelado;
- `Departamentos`: uno o varios departamentos;
- `Seccion`: area o frente de trabajo;
- `Responsables`: responsables asignados;
- `Tipo de tarea`: valor sugerido o texto personalizado;
- `Fecha inicio` y `Fecha fin`;
- `Avance`: porcentaje entre 0 y 100;
- `Notas`: observaciones, dependencias o contexto.

Reglas importantes:

- La descripcion de la tarea es obligatoria.
- El ID manual debe ser entero si se usa.
- Los responsables deben existir en Catalogos.
- Para recibir notificaciones, el responsable debe tener un usuario asociado a su correo.
- Los administradores pueden asignar varios responsables.
- Los supervisores solo pueden asignar una tarea a responsables con rol Responsable de su mismo departamento.
- Los administradores no pueden asignar tareas a usuarios administradores.
- Al cambiar responsables, se sincronizan asignaciones y alertas.

## Historial de una tarea

Se abre desde la accion `Historial` en agenda, busqueda o enlaces de alertas. Tambien existe una vista general en `/historial`.

Tipos de entrada manual:

- Orden;
- Nota;
- Avance;
- Cambio de Estado;
- Incidencia;
- Recordatorio.

Flujo de seguimiento:

1. El usuario abre el historial de una tarea.
2. Revisa la bitacora existente.
3. Si tiene permisos y la tarea no esta `Completado` ni `Cancelado`, registra una nueva entrada.
4. Puede escribir observaciones, valor nuevo o ambas cosas.
5. Puede marcar la tarea como finalizada.

Al marcar como finalizada:

- el estado cambia a `Completado`;
- el avance pasa a `100%`;
- se registra el cambio en historial;
- se notifica a administradores.

Las tareas completadas o canceladas mantienen historial visible, pero bloquean nuevas entradas.

### Reasignacion por supervisor

Un supervisor puede transferir una tarea a otro responsable si:

- la tarea le fue asignada previamente;
- el nuevo responsable pertenece al mismo departamento;
- el nuevo responsable tiene rol Responsable;
- la tarea no esta completada ni cancelada.

La reasignacion queda registrada en historial y actualiza las alertas de asignacion.

## Dashboard

Ruta: `/dashboard`

Presenta una lectura ejecutiva del trabajo:

- total de tareas;
- tareas activas;
- completadas;
- en proceso;
- pendientes;
- alta prioridad;
- vencidas;
- urgentes;
- proximas;
- avance promedio;
- alertas sin leer;
- reuniones proximas;
- eventos del calendario del dia;
- tareas por departamento;
- distribucion por estado;
- carga por responsable;
- distribucion por prioridad;
- tareas recientes;
- alertas recientes;
- proximas reuniones;
- proximos eventos del calendario;
- movimientos recientes del historial;
- trazabilidad de asignaciones, mostrando a quien se asigno una tarea y quien la asigno;
- resumen ejecutivo de avance global.

El titulo y subtitulo cambian segun el rol: dashboard ejecutivo, dashboard de seguimiento, mis indicadores o panel de consulta.

## Alertas

Ruta: `/alertas`

Centraliza riesgos y avisos personales.

Clasificacion por fecha fin:

- `Vencidas`: fecha fin anterior a hoy y tarea no finalizada;
- `Urgentes`: vencen en 0 a 2 dias;
- `Proximas`: vencen en 3 a 5 dias.

La pantalla:

- recalcula vencimientos al cargar;
- muestra KPIs de vencidas, urgentes y proximas;
- lista alertas personales internas;
- permite marcar una alerta como leida;
- permite marcar todas como leidas;
- enlaza alertas de tareas hacia su historial.

El endpoint `/api/alertas/vencimientos` tambien puede ejecutarse por cron externo con token.

## Cronograma

Ruta: `/cronograma`

Muestra las tareas con fecha de inicio y fecha fin dentro del mes seleccionado.

Funciones:

- cambiar al mes anterior o siguiente;
- recargar datos;
- ver barras por rango de fechas;
- distinguir estados por color;
- resaltar el dia actual;
- marcar fines de semana;
- ver una version resumida en movil.

Solo aparecen tareas con fechas asignadas que cruzan el mes visible.

## Estadisticas

Ruta: `/estadisticas`

Modulo analitico con:

- analisis por prioridad;
- analisis por tipo de tarea;
- avance por departamento;
- radar por departamento.

Usa `/api/estadisticas`. Si existen las RPCs de escalabilidad, la API usa calculos agregados en SQL; si no, calcula con TypeScript como respaldo.

## Busqueda avanzada

Ruta: `/busqueda`

Permite encontrar tareas combinando filtros:

- descripcion, ID interno o codigo manual;
- responsable;
- prioridad;
- departamento;
- estado;
- tipo de tarea;
- fecha fin desde;
- fecha fin hasta.

Los resultados muestran datos clave y permiten abrir el historial de cada tarea. La busqueda usa paginacion de 50 elementos.

## Vista por responsable

Ruta: `/responsable`

Permite seleccionar un responsable y ver:

- total de tareas;
- tareas en proceso;
- completadas;
- pendientes;
- avance promedio;
- tabla o tarjetas con prioridad, departamento, fecha fin, avance, semaforo y estado.

Sirve para revisar carga individual y backlog asignado por persona.

## Historial general

Ruta: `/historial`

Muestra la auditoria del sistema con paginacion de 25 registros.

Columnas principales:

- fecha;
- usuario;
- tarea;
- modulo;
- tipo de cambio;
- valor anterior;
- valor nuevo;
- observaciones.

Si se abre como `/historial?tarea_id=123`, muestra la trazabilidad de una tarea concreta.

## Catalogos

Ruta: `/catalogos`

Reservado para administradores.

### Departamentos

Permite:

- ver departamentos activos;
- ver cuantos usuarios asociados tiene cada departamento;
- agregar nuevos departamentos;
- eliminar departamentos con confirmacion.

### Responsables

Permite:

- ver responsables, cargo, correo, departamento, rol y estado de asociacion con usuario;
- agregar responsables con nombre, correo, cargo y departamento;
- editar departamento y rol de acceso;
- eliminar responsables con confirmacion.

El correo del responsable es obligatorio y debe tener formato valido.

### Valores del sistema

Muestra los valores base usados por la aplicacion:

- estados de tarea;
- prioridades;
- tipos de tarea.

## Reuniones

Ruta: `/reuniones`

Permite programar reuniones del organismo, invitar miembros y registrar la confirmacion de participacion.

Funciones principales:

- crear reuniones virtuales, presenciales o hibridas;
- cargar desde el backend los miembros activos del organismo seleccionado y sus correos;
- buscar y seleccionar invitados por nombre o correo, conservando su usuario interno para alertas y confirmaciones;
- agregar nuevos participantes a una reunion programada desde la accion `Participantes`;
- reenviar convocatorias existentes con enlaces publicos de confirmacion renovados;
- enviar alertas internas y correos de invitacion;
- confirmar, rechazar o responder como tentativo;
- permitir que invitados externos respondan sin iniciar sesion mediante un enlace individual firmado con `token_confirmacion`;
- cancelar reuniones programadas;
- abrir el enlace de acceso desde la tarjeta de reunion.

Para reuniones virtuales o hibridas, el usuario puede:

- escribir manualmente un enlace externo;
- activar `Crear enlace automaticamente con Google Meet`.

Cuando se activa Google Meet, la API `/api/reuniones` crea un espacio mediante `spaces.create` y guarda su `meetingUri` como enlace visible para invitados confirmados, alertas y correos. La fecha, duracion, descripcion y lista de participantes continúan gestionadas por la agenda.

Google Meet REST API requiere OAuth 2.0 con el scope `https://www.googleapis.com/auth/meetings.space.created`. Una API key puede identificar el proyecto, pero no autoriza crear reuniones por si sola.

La aplicacion admite dos formas de obtener el token OAuth:

- una cuenta organizadora con `GOOGLE_MEET_CLIENT_ID`, `GOOGLE_MEET_CLIENT_SECRET` y `GOOGLE_MEET_REFRESH_TOKEN`;
- una cuenta de servicio con delegacion de dominio mediante `GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY` y `GOOGLE_MEET_IMPERSONATED_USER`.

`GOOGLE_MEET_API_KEY` es opcional y nunca sustituye uno de esos dos metodos OAuth. La API de Google Meet debe estar habilitada en el mismo proyecto de Google Cloud.

Funcionamiento:

1. El administrador programa la reunion y activa la generacion automatica.
2. El backend obtiene un access token OAuth y crea el espacio de Google Meet.
3. La agenda guarda el enlace y envia convocatorias individuales.
4. Los invitados confirman mediante su token publico.
5. Los usuarios acceden con `Entrar en Google Meet` o desde el enlace mostrado tras confirmar.

La agenda conserva `google_meet_space_name` (`spaces/{space}`) como identificador estable. `google_meet_code` se guarda solo como referencia auxiliar porque Google puede desvincularlo y reutilizarlo. Al cancelar o finalizar una reunion, el backend llama a `spaces.endActiveConference` para cerrar cualquier conferencia activa del espacio.

Los correos de invitacion usan la URL publica de `NEXT_PUBLIC_APP_URL` y apuntan a `/reuniones/confirmar?token=...`. Esa pantalla es publica, muestra los datos de la convocatoria y permite confirmar, rechazar o marcar asistencia tentativa. El enlace de acceso a la reunion solo se muestra despues de confirmar.

## Perfil

Ruta: `/perfil`

Cada usuario puede:

- ver su nombre, correo, rol, fecha de alta y ultimo cambio;
- editar nombre visible;
- subir foto de perfil JPG, PNG o WEBP hasta 5 MB;
- quitar foto;
- cambiar contrasena;
- guardar cambios.

Si el usuario deja la contrasena vacia, solo se actualizan nombre y foto.

## Configuracion

Ruta: `/configuracion`

Preferencias personales:

- tema visual: claro, oscuro o sistema;
- mostrar u ocultar KPIs en la agenda diaria;
- abrir filtros automaticamente al entrar en la agenda.

Las preferencias se guardan en el perfil del usuario y se aplican al volver a cargar la aplicacion.

## Notificaciones

La aplicacion usa alertas internas y, si esta configurado Resend, correos electronicos.

Eventos que generan avisos:

- nueva tarea asignada;
- tarea vencida;
- tarea finalizada por responsable;
- reasignacion de tarea;
- cambio de responsables;
- invitacion a reunion y enlace de acceso cuando aplica.

Las alertas internas viven en la tabla `alertas`. Algunas alertas pueden marcarse como leidas desde la pantalla `/alertas`.

Cuando una alerta corresponde a una tarea asignada, los administradores ven la trazabilidad de asignacion enriquecida: `Asignada a` y `Asignada por`. Esto evita leer una alerta global como si hubiera sido asignada al propio administrador.

## Calendario

Ruta: `/calendario`

Muestra los dias festivos y eventos institucionales del organismo activo.

Funciones:

- vista mensual con eventos por dia;
- seleccion de un dia para ver sus eventos;
- resumen de festivos del mes;
- eventos de uno o varios dias;
- colores por tipo de evento.

Permisos:

- administradores y administradoras pueden crear, editar y eliminar eventos;
- supervisor, responsable y consulta solo pueden visualizar el calendario;
- todos los datos se filtran por `organismo_id`.

Tipos disponibles:

- Festivo;
- Evento;
- Actividad;
- Aviso;
- Fecha limite.

Festivos base de Guinea Ecuatorial:

- 1 de enero: Dia de Ano Nuevo;
- Viernes Santo: fecha movil calculada por Pascua;
- 1 de mayo: Dia del Trabajo;
- 5 de junio: Dia del Presidente;
- Corpus Christi: fecha movil calculada como Pascua + 60 dias;
- 3 de agosto: Dia de la Libertad / Fuerzas Armadas;
- 15 de agosto: Dia de la Constitucion;
- 12 de octubre: Dia de la Independencia;
- 1 de noviembre: Dia de Todos los Santos;
- 17 de noviembre: Santa Isabel de Hungria, evento local de referencia en Malabo;
- 8 de diciembre: Inmaculada Concepcion;
- 25 de diciembre: Navidad.

La migracion de festivos oficiales carga automaticamente el ano actual y los cuatro anos siguientes para todos los organismos activos. Los nuevos organismos tambien reciben esos festivos al crearse.

## Datos principales de una tarea

La entidad `tareas` contiene:

| Campo | Descripcion |
|---|---|
| `id` | Identificador interno automatico |
| `codigo_id` | Identificador manual opcional |
| `tarea` | Descripcion del trabajo |
| `prioridad` | Alta, Media o Baja |
| `departamento` | Departamento principal heredado |
| `departamentos` | Relacion con uno o varios departamentos |
| `seccion` | Area o frente de trabajo |
| `responsable` | Responsable principal heredado |
| `responsable_id` | ID del responsable principal |
| `responsable_usuario_id` | Usuario asociado al responsable principal |
| `asignaciones` | Relacion con uno o varios responsables |
| `fecha_inicio` | Fecha de inicio |
| `fecha_fin` | Fecha limite |
| `dias_totales` | Dias entre inicio y fin |
| `dias_restantes` | Dias hasta fecha fin |
| `semaforo` | Estado temporal calculado |
| `porcentaje_avance` | Avance de 0 a 100 |
| `estado` | Pendiente, En Proceso, Completado o Cancelado |
| `tipo_tarea` | Tipo sugerido o personalizado |
| `notas` | Observaciones libres |
| `ultima_actualizacion` | Fecha de actualizacion funcional |
| `created_at` / `updated_at` | Auditoria tecnica |

## Semaforo de tareas

El semaforo se calcula por fecha fin:

- `Vencida`: fecha fin anterior a hoy;
- `Urgente`: fecha fin entre hoy y 2 dias;
- `Proxima`: fecha fin entre 3 y 5 dias;
- `A tiempo`: fecha fin mayor a 5 dias;
- `Sin fecha`: no hay fecha fin.

Las tareas `Completado` y `Cancelado` quedan fuera de las alertas de vencimiento.

## Base de datos y migraciones

Ejecutar en Supabase SQL Editor en este orden recomendado:

1. `supabase/schema.sql`
2. `supabase/migration_user_profiles.sql`
3. `supabase/migration_user_avatars.sql`
4. `supabase/migration_user_preferences.sql`
5. `supabase/migration_security_hardening.sql`
6. `supabase/migration_responsables_notificaciones.sql`
7. `supabase/migration_scalability_phase2.sql`
8. `supabase/migration_task_multi_departments.sql`
9. `supabase/migration_task_multi_assignments.sql`
10. `supabase/migration_task_assignment_owner.sql`
11. `supabase/migration_role_key_improvements.sql`
12. `supabase/migration_historial_index.sql`
13. `supabase/migration_auth_policies.sql`
14. `supabase/migration_reuniones.sql`
15. `supabase/migration_reuniones_google_meet.sql`
16. `supabase/migration_calendario_eventos.sql`
17. `supabase/migration_calendario_festivos_gq.sql`

Scripts auxiliares disponibles:

- `supabase/seed_agenda_users.sql`
- `supabase/assign_user_types.sql`
- `supabase/migration_annzamio_supervisor.sql`
- `scripts/promote-annzamio-supervisor.mjs`

## Variables de entorno

Crear `.env.local` desde `.env.example` y completar:

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

Para procesar vencimientos automaticamente, configurar un cron externo o Vercel Cron que invoque:

```http
GET /api/alertas/vencimientos
Authorization: Bearer <AGENDA_ALERTS_CRON_TOKEN>
```

Tambien se acepta `POST /api/alertas/vencimientos`.

## Instalacion y ejecucion local

Requisitos:

- Node.js 18 o superior;
- npm;
- proyecto Supabase configurado.

Comandos:

```bash
npm install
npm run dev
```

La aplicacion se abre en:

```text
http://localhost:3004
```

Otros comandos:

```bash
npm run build
npm run start
npm run lint
```

## APIs principales

| API | Uso |
|---|---|
| `/api/tareas` | Listar, crear, editar y eliminar tareas con paginacion y filtros |
| `/api/dashboard` | Datos del dashboard |
| `/api/estadisticas` | Datos analiticos |
| `/api/historial` | Leer y registrar historial |
| `/api/catalogos` | Departamentos y responsables |
| `/api/register` | Registro de usuarios |
| `/api/alertas` | Alertas personales |
| `/api/calendario` | Festivos y eventos institucionales por organismo |
| `/api/alertas/unread` | Conteo de alertas no leidas |
| `/api/alertas/marcar-leida` | Marcar alertas como leidas |
| `/api/alertas/vencimientos` | Generar alertas por vencimientos |
| `/api/bootstrap/agenda-users` | Bootstrap inicial de usuarios |

## Stack tecnico

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Supabase Auth, Database y Storage
- Recharts
- Lucide React
- date-fns
- Resend

## Escalabilidad y seguridad

- Las pantallas de agenda y busqueda usan `/api/tareas` con paginacion, filtros server-side y limite maximo de pagina.
- Dashboard y estadisticas pueden usar RPCs SQL para lecturas agregadas cuando las migraciones de escala estan aplicadas.
- El sistema mantiene fallback TypeScript si las RPCs no existen.
- El alcance por rol restringe rutas y datos visibles.
- Administradores gestionan todo.
- Supervisores operan por departamento o asignacion.
- Responsables ven y actualizan solo su trabajo asignado.
- Consulta mantiene lectura sin edicion.
- Los clientes Supabase usan el contrato tipado de `lib/database.types.ts`.

## Guia rapida para usuarios finales

1. Entrar con correo y contrasena.
2. Revisar el dashboard para entender estado general o personal.
3. Abrir Agenda diaria para trabajar sobre tareas.
4. Usar filtros para encontrar tareas concretas.
5. Abrir el detalle o historial de una tarea.
6. Registrar avances, notas, incidencias u ordenes desde Historial.
7. Marcar la tarea como finalizada cuando corresponda.
8. Revisar Alertas para atender vencimientos y asignaciones nuevas.
9. Usar Cronograma para planificar por fechas.
10. Usar Busqueda para consultas especificas.
11. Actualizar Perfil y Configuracion segun preferencias personales.

## Guia rapida para administradores

1. Mantener departamentos y responsables en Catalogos.
2. Asociar responsables a correos reales para habilitar notificaciones.
3. Crear tareas con fechas, prioridad, departamentos y responsables claros.
4. Revisar alertas y dashboard diariamente.
5. Usar historial para auditar cambios y avances.
6. Mantener este README actualizado cada vez que cambie un flujo.
