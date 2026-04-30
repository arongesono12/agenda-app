export const DOMAIN_WARNING_ROUTE = '/advertencia-dominio'
export const DOMAIN_ACQUISITION_DEADLINE = '2026-05-07T00:00:00+01:00'

export function isDomainAcquisitionExpired(now = new Date()) {
  return now.getTime() >= new Date(DOMAIN_ACQUISITION_DEADLINE).getTime()
}
