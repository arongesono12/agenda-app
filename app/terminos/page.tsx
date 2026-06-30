import Link from 'next/link'
import LegalDocument, { type LegalSection } from '@/components/legal/LegalDocument'
import { getLegalConfig, LEGAL_UPDATED_AT, LEGAL_VERSION } from '@/lib/legal-config'

export const metadata = {
  title: 'Términos y Condiciones | Agenda SEGESA',
  description: 'Condiciones aplicables al acceso y uso de Agenda SEGESA.',
}

export default function TermsPage() {
  const legal = getLegalConfig()

  const sections: LegalSection[] = [
    {
      id: 'titular',
      title: 'Titular y objeto',
      content: (
        <>
          <p>Estos Términos regulan el acceso y uso de <strong>{legal.productName}</strong>, plataforma operada por <strong>{legal.entityName}</strong>, con dirección de contacto en {legal.address}.</p>
          <p>La plataforma facilita la planificación, asignación y seguimiento de tareas; gestión de organismos, departamentos y responsables; auditoría; alertas; calendario; reuniones; reportes y facturación. No sustituye los procedimientos formales, obligaciones legales ni decisiones profesionales de cada organismo.</p>
        </>
      ),
    },
    {
      id: 'aceptacion',
      title: 'Aceptación y representación',
      content: (
        <>
          <p>Al registrarte, aceptar una invitación, iniciar sesión o utilizar el servicio declaras haber leído y aceptado estos Términos y la Política de Privacidad.</p>
          <p>Si utilizas la plataforma en nombre de un organismo, declaras que estás autorizado para vincularlo y para realizar las acciones correspondientes a tu rol. El administrador que habilita usuarios garantiza que cuenta con una base legítima para introducir sus datos laborales.</p>
        </>
      ),
    },
    {
      id: 'cuentas',
      title: 'Cuentas y credenciales',
      content: (
        <>
          <p>La información de registro debe ser correcta, actualizada y verificable. Cada cuenta es personal y no puede compartirse. El usuario debe proteger su contraseña, dispositivos y métodos de recuperación, y comunicar inmediatamente cualquier acceso no autorizado.</p>
          <p>Podremos solicitar verificación adicional, corregir asociaciones erróneas o bloquear temporalmente una cuenta cuando sea necesario para proteger al usuario, al organismo o a la plataforma.</p>
        </>
      ),
    },
    {
      id: 'roles',
      title: 'Organismos, roles y permisos',
      content: (
        <>
          <p>Las funciones disponibles dependen del organismo activo, la suscripción y el rol asignado. Administradores y administradoras gestionan usuarios, catálogos y actividad general; supervisores coordinan su ámbito; responsables trabajan sobre sus asignaciones; consulta dispone de funciones de lectura.</p>
          <p>Los permisos técnicos reducen accesos indebidos, pero cada organismo debe definir internamente quién puede conocer, editar, asignar o auditar información y revisar periódicamente sus membresías.</p>
        </>
      ),
    },
    {
      id: 'uso',
      title: 'Uso permitido',
      content: (
        <>
          <p>El usuario se compromete a utilizar la plataforma para fines legítimos, profesionales e institucionales, dentro de sus atribuciones y respetando la confidencialidad.</p>
          <p>No está permitido:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>acceder a cuentas, organismos o información sin autorización;</li>
            <li>alterar registros, identidades, evidencias o auditorías de forma engañosa;</li>
            <li>introducir malware, automatizar ataques, eludir controles o degradar el servicio;</li>
            <li>utilizar la plataforma para acoso, discriminación, fraude, amenazas o actividades ilícitas;</li>
            <li>publicar secretos, datos sensibles o documentos de terceros sin legitimación y protección adecuada;</li>
            <li>revender, copiar, descompilar o explotar el servicio fuera de lo autorizado.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'contenido',
      title: 'Contenido y responsabilidad del organismo',
      content: (
        <>
          <p>El organismo y sus usuarios conservan la titularidad y responsabilidad sobre tareas, observaciones, archivos, reuniones, nombres, correos y demás contenido que incorporen. Conceden al operador una autorización limitada para alojarlo, procesarlo, transmitirlo y respaldarlo exclusivamente para prestar y proteger el servicio.</p>
          <p>Quien registra una instrucción, comentario o estado debe asegurarse de que sea exacto, respetuoso y pertinente. El historial constituye una herramienta de trazabilidad interna, pero su valor probatorio dependerá de la legislación, políticas y controles aplicables.</p>
        </>
      ),
    },
    {
      id: 'reuniones',
      title: 'Reuniones y servicios de Google',
      content: (
        <>
          <p>Cuando se solicita la creación automática de una reunión, la plataforma utiliza Google Meet mediante una cuenta organizadora autorizada. El acceso, disponibilidad, grabación, moderación y tratamiento dentro de Meet también están sujetos a las condiciones y políticas de Google.</p>
          <p>Los usuarios no deben compartir públicamente enlaces de reunión ni tokens de confirmación. La plataforma no garantiza que una persona externa pueda acceder sin solicitar admisión, ya que la configuración del dominio y del organizador puede imponer controles adicionales.</p>
        </>
      ),
    },
    {
      id: 'planes',
      title: 'Planes, pagos y facturación',
      content: (
        <>
          <p>Las funciones, límites, historial, alertas por correo y número de usuarios pueden depender del plan contratado. Los precios, impuestos, moneda, periodicidad y condiciones de renovación se mostrarán antes de contratar o constarán en la propuesta comercial.</p>
          <p>Los pagos electrónicos pueden ser gestionados por Stripe. Salvo indicación contraria, la cancelación evita futuras renovaciones, pero no genera devolución automática de periodos ya iniciados. Cualquier devolución o ajuste se resolverá conforme a la oferta, la causa y la normativa obligatoria aplicable.</p>
        </>
      ),
    },
    {
      id: 'disponibilidad',
      title: 'Disponibilidad y cambios',
      content: (
        <>
          <p>Trabajamos para mantener el servicio disponible y seguro, pero pueden producirse mantenimientos, fallos de red, interrupciones de proveedores, cambios de API o eventos fuera de control razonable.</p>
          <p>Podremos modificar, mejorar, sustituir o retirar funciones cuando resulte necesario por seguridad, cumplimiento, rendimiento o evolución del producto. Procuraremos comunicar con antelación razonable los cambios que afecten materialmente al uso contratado.</p>
        </>
      ),
    },
    {
      id: 'propiedad',
      title: 'Propiedad intelectual',
      content: (
        <p>El software, interfaz, marca, documentación, diseños y elementos propios de la plataforma pertenecen a {legal.entityName} o a sus licenciantes. El acceso concede únicamente un derecho limitado, revocable, no exclusivo y no transferible para utilizar el servicio durante la relación autorizada.</p>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspensión y terminación',
      content: (
        <>
          <p>Podremos suspender o limitar accesos ante impago, riesgo de seguridad, uso ilícito, incumplimiento grave, requerimiento de autoridad o necesidad de proteger datos y sistemas. Cuando sea razonable, se notificará al administrador y se permitirá corregir el incumplimiento.</p>
          <p>Al terminar el servicio, cesará el acceso. La exportación, devolución, conservación o eliminación de información se realizará conforme al contrato, la Política de Privacidad y las obligaciones legales. El organismo debe planificar la conservación de sus propios registros esenciales.</p>
        </>
      ),
    },
    {
      id: 'responsabilidad',
      title: 'Responsabilidad y garantías',
      content: (
        <>
          <p>La plataforma es una herramienta de apoyo operativo. Cada organismo sigue siendo responsable de sus decisiones, instrucciones, plazos, controles laborales, copias documentales y cumplimiento normativo.</p>
          <p>En la medida permitida por la ley, no responderemos por daños causados exclusivamente por datos incorrectos introducidos por usuarios, credenciales compartidas, uso contrario a estos Términos, decisiones del organismo, servicios de terceros o eventos fuera de control razonable. Nada en estos Términos excluye responsabilidades que legalmente no puedan limitarse.</p>
        </>
      ),
    },
    {
      id: 'privacidad',
      title: 'Privacidad y confidencialidad',
      content: (
        <p>El tratamiento de datos personales se describe en la <Link href="/privacidad" className="font-semibold text-teal-700 hover:text-teal-900">Política de Privacidad</Link>. Los usuarios deben tratar como confidencial toda información no pública a la que accedan por razón de su puesto, incluso después de terminar su acceso.</p>
      ),
    },
    {
      id: 'ley',
      title: 'Ley aplicable y controversias',
      content: (
        <>
          <p>Estos Términos se interpretarán conforme a las leyes de la República de Guinea Ecuatorial, sin perjuicio de las normas obligatorias que resulten aplicables por el domicilio o condición de las partes.</p>
          <p>Antes de iniciar una reclamación judicial, las partes procurarán resolverla de buena fe mediante contacto escrito. Si no fuera posible, será competente la jurisdicción que determine la normativa aplicable.</p>
        </>
      ),
    },
    {
      id: 'contacto',
      title: 'Cambios y contacto',
      content: (
        <>
          <p>Podremos actualizar estos Términos para reflejar cambios legales, técnicos o comerciales. La versión y fecha visibles identifican el texto vigente; los cambios materiales se comunicarán por medios razonables.</p>
          <p>Consultas contractuales o soporte: <a href={`mailto:${legal.supportEmail}`} className="font-semibold text-teal-700">{legal.supportEmail}</a>. Privacidad: <a href={`mailto:${legal.privacyEmail}`} className="font-semibold text-teal-700">{legal.privacyEmail}</a>.</p>
        </>
      ),
    },
  ]

  return (
    <LegalDocument
      kind="terms"
      eyebrow="Condiciones del servicio"
      title="Términos y Condiciones de Uso"
      summary="Regulan el acceso a Agenda SEGESA, las responsabilidades de usuarios y organismos, el uso permitido y las condiciones generales del servicio."
      updatedAt={LEGAL_UPDATED_AT}
      version={LEGAL_VERSION}
      sections={sections}
    />
  )
}
