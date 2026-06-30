export const LEGAL_VERSION = '1.0'
export const LEGAL_UPDATED_AT = '30 de junio de 2026'

export function getLegalConfig() {
  return {
    entityName: process.env.LEGAL_ENTITY_NAME?.trim() || 'SEGESA',
    productName: process.env.LEGAL_PRODUCT_NAME?.trim() || 'Agenda SEGESA',
    address: process.env.LEGAL_ENTITY_ADDRESS?.trim() || 'Malabo, República de Guinea Ecuatorial',
    privacyEmail: process.env.LEGAL_PRIVACY_EMAIL?.trim() || 'privacidad@agendasegesa.com',
    supportEmail: process.env.LEGAL_SUPPORT_EMAIL?.trim() || 'soporte@agendasegesa.com',
  }
}
