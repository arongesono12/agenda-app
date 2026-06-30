import Link from 'next/link'
import LegalDocument, { type LegalSection } from '@/components/legal/LegalDocument'
import { getLegalConfig, LEGAL_UPDATED_AT, LEGAL_VERSION } from '@/lib/legal-config'

export const metadata = {
  title: 'Política de Privacidad | Agenda SEGESA',
  description: 'Información sobre el tratamiento de datos personales en Agenda SEGESA.',
}

export default function PrivacyPage() {
  const legal = getLegalConfig()

  const sections: LegalSection[] = [
    {
      id: 'responsable',
      title: 'Responsable y alcance',
      content: (
        <>
          <p><strong>{legal.entityName}</strong>, con dirección de contacto en {legal.address}, opera {legal.productName} y gestiona los datos necesarios para prestar, proteger y administrar la plataforma.</p>
          <p>Cuando un organismo utiliza la aplicación para gestionar a sus trabajadores, tareas, departamentos o reuniones, ese organismo determina el contenido y las finalidades laborales del tratamiento. En ese ámbito, el organismo actúa como responsable de sus datos y {legal.entityName} presta la infraestructura y el soporte técnico conforme a sus instrucciones.</p>
          <p>Esta política se aplica a usuarios registrados, administradores de organismos, participantes internos y personas externas invitadas a reuniones.</p>
        </>
      ),
    },
    {
      id: 'datos',
      title: 'Datos que tratamos',
      content: (
        <>
          <p>Según el uso de la plataforma, podemos tratar las siguientes categorías:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Cuenta e identidad:</strong> nombre, correo, identificador de usuario, contraseña cifrada por el proveedor de autenticación, avatar, preferencias y fecha de alta.</li>
            <li><strong>Información organizativa:</strong> organismo, departamento, cargo, rol, estado de membresía y relaciones de supervisión o responsabilidad.</li>
            <li><strong>Contenido operativo:</strong> tareas, prioridades, fechas, responsables, estados, avances, observaciones, historial, eventos, festivos y datos de catálogos.</li>
            <li><strong>Reuniones:</strong> título, descripción, fecha, ubicación, participantes, correo de invitados, respuesta de asistencia y enlace de Google Meet.</li>
            <li><strong>Auditoría y seguridad:</strong> acciones realizadas, actor, rol, fecha, cambios, alertas, sesiones, dirección IP y registros técnicos cuando sean generados por la infraestructura.</li>
            <li><strong>Facturación:</strong> plan, estado de suscripción, importes, referencias de cliente, pago o factura. La plataforma no almacena el número completo de tarjeta.</li>
            <li><strong>Soporte y comunicaciones:</strong> mensajes enviados, incidencias y entrega de correos transaccionales.</li>
          </ul>
          <p>No solicitamos deliberadamente datos sensibles. Los usuarios no deben introducir información de salud, origen étnico, religión, afiliación política o sindical, vida sexual, antecedentes penales u otros datos especialmente protegidos salvo autorización legal, necesidad institucional documentada y medidas reforzadas.</p>
        </>
      ),
    },
    {
      id: 'finalidades',
      title: 'Finalidades y legitimación',
      content: (
        <>
          <p>Tratamos los datos para crear y mantener cuentas; organizar organismos y permisos; registrar, asignar y controlar tareas; conservar trazabilidad; mostrar paneles e informes; programar reuniones; enviar alertas; gestionar suscripciones; atender soporte; prevenir fraude y proteger la plataforma.</p>
          <p>El tratamiento se apoya, según corresponda, en la ejecución del servicio solicitado, la relación laboral o institucional gestionada por el organismo, el consentimiento inequívoco, el cumplimiento de obligaciones legales y el interés legítimo en mantener la seguridad, continuidad y auditoría del sistema.</p>
          <p>Los datos no se venden ni se utilizan para publicidad comportamental.</p>
        </>
      ),
    },
    {
      id: 'origen',
      title: 'Origen de los datos',
      content: (
        <p>Los datos proceden del propio usuario, de un administrador autorizado de su organismo, de un supervisor que asigna trabajo, de una invitación institucional, de la actividad realizada dentro de la plataforma o de los proveedores técnicos al registrar eventos de autenticación, entrega, pago o seguridad.</p>
      ),
    },
    {
      id: 'acceso',
      title: 'Acceso interno y separación por organismos',
      content: (
        <>
          <p>El acceso se limita mediante autenticación, organismo activo y permisos por rol. Administradores y administradoras pueden consultar la actividad global del organismo; supervisores acceden al ámbito que gestionan; responsables acceden principalmente a sus asignaciones; el rol de consulta dispone de acceso de lectura.</p>
          <p>Los administradores del organismo pueden consultar datos laborales y de auditoría cuando resulte necesario para coordinar, controlar o investigar la actividad. Cada usuario es responsable de no compartir credenciales y de cerrar sesión en dispositivos compartidos.</p>
        </>
      ),
    },
    {
      id: 'proveedores',
      title: 'Destinatarios y proveedores',
      content: (
        <>
          <p>Podemos comunicar datos a proveedores que actúan como encargados o proveedores independientes cuando es imprescindible para el servicio:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Supabase:</strong> autenticación, base de datos y almacenamiento de avatares.</li>
            <li><strong>Vercel:</strong> alojamiento, despliegue y registros técnicos de la aplicación.</li>
            <li><strong>Resend:</strong> envío de alertas, recuperación e invitaciones por correo.</li>
            <li><strong>Stripe:</strong> suscripciones, pagos, portal de facturación y facturas.</li>
            <li><strong>Google Meet:</strong> creación y acceso a espacios de reunión mediante una cuenta organizadora autorizada.</li>
          </ul>
          <p>También podremos comunicar información cuando exista obligación legal, requerimiento judicial o solicitud válida de una autoridad competente. Los organismos deberán informar a sus miembros sobre cualquier destinatario adicional que incorporen mediante el contenido de trabajo.</p>
        </>
      ),
    },
    {
      id: 'transferencias',
      title: 'Tratamiento y transferencias internacionales',
      content: (
        <>
          <p>Algunos proveedores pueden almacenar o procesar información fuera de Guinea Ecuatorial. Antes de habilitarlos, el responsable debe comprobar la ubicación aplicable, las condiciones contractuales, las medidas de seguridad y las garantías exigidas por la Ley Núm. 1/2016.</p>
          <p>Cuando sea necesaria una autorización del órgano competente o el consentimiento inequívoco del interesado para una transferencia internacional, el responsable deberá obtenerla antes del tratamiento.</p>
        </>
      ),
    },
    {
      id: 'conservacion',
      title: 'Conservación y eliminación',
      content: (
        <>
          <p>Los datos se conservan mientras la cuenta u organización esté activa y durante el tiempo necesario para cumplir la finalidad, gestionar responsabilidades, conservar auditoría, resolver controversias o atender obligaciones legales y contractuales.</p>
          <p>Los periodos concretos pueden depender del plan contratado, la política documental del organismo y la naturaleza del registro. Cuando los datos dejen de ser necesarios, serán eliminados, bloqueados o anonimizados de forma razonable. Las copias de seguridad pueden permanecer temporalmente hasta completar su ciclo seguro de rotación.</p>
        </>
      ),
    },
    {
      id: 'derechos',
      title: 'Derechos de las personas',
      content: (
        <>
          <p>Conforme a la Ley Núm. 1/2016, puedes solicitar información, acceso, rectificación, cancelación u oposición respecto de tus datos. También puedes retirar un consentimiento cuando esa sea la base del tratamiento, sin afectar al tratamiento previo ni a las obligaciones que deban conservarse.</p>
          <p>Envía la solicitud a <a href={`mailto:${legal.privacyEmail}`} className="font-semibold text-teal-700 hover:text-teal-900">{legal.privacyEmail}</a>, indicando el derecho solicitado y la información necesaria para verificar tu identidad. Si los datos son gestionados por tu empleador u organismo, podremos remitir la solicitud a su administrador autorizado.</p>
        </>
      ),
    },
    {
      id: 'seguridad',
      title: 'Seguridad e incidentes',
      content: (
        <>
          <p>Aplicamos controles de acceso por rol y organismo, sesiones autenticadas, validación de solicitudes, políticas de base de datos, registros de auditoría y comunicaciones cifradas mediante HTTPS. Las credenciales secretas de integraciones se mantienen en variables privadas del servidor.</p>
          <p>Ningún sistema es infalible. Ante un incidente relevante, se aplicarán medidas de contención, investigación y comunicación conforme a la naturaleza del riesgo y las obligaciones aplicables. Los usuarios deben comunicar accesos sospechosos a {legal.supportEmail}.</p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies y almacenamiento local',
      content: (
        <>
          <p>La aplicación utiliza cookies técnicas necesarias para autenticación, mantenimiento de sesión y selección del organismo activo. También utiliza almacenamiento local para recordar el tema visual, el estado del sidebar y qué alertas emergentes ya se mostraron.</p>
          <p>No se instalan cookies publicitarias ni de seguimiento comercial. Deshabilitar el almacenamiento técnico puede impedir el inicio de sesión o degradar funciones esenciales.</p>
        </>
      ),
    },
    {
      id: 'menores',
      title: 'Menores y uso laboral',
      content: (
        <p>La plataforma está dirigida a organizaciones y personas autorizadas para desarrollar actividad laboral o institucional. No está diseñada para menores ni para recopilar deliberadamente sus datos. El organismo es responsable de verificar que sus altas e invitaciones sean legítimas.</p>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios y contacto',
      content: (
        <>
          <p>Podemos actualizar esta política para reflejar cambios legales, técnicos o funcionales. La versión y fecha visibles permiten identificar la revisión vigente. Los cambios materiales se comunicarán por medios razonables.</p>
          <p>Responsable: {legal.entityName}. Dirección: {legal.address}. Privacidad: <a href={`mailto:${legal.privacyEmail}`} className="font-semibold text-teal-700">{legal.privacyEmail}</a>. Soporte: <a href={`mailto:${legal.supportEmail}`} className="font-semibold text-teal-700">{legal.supportEmail}</a>.</p>
          <p>Consulta también los <Link href="/terminos" className="font-semibold text-teal-700 hover:text-teal-900">Términos y Condiciones de Uso</Link>.</p>
        </>
      ),
    },
  ]

  return (
    <LegalDocument
      kind="privacy"
      eyebrow="Protección de datos"
      title="Política de Privacidad"
      summary="Explica qué información trata Agenda SEGESA, para qué se utiliza, quién puede acceder y cómo ejercer los derechos sobre los datos personales."
      updatedAt={LEGAL_UPDATED_AT}
      version={LEGAL_VERSION}
      sections={sections}
    />
  )
}
