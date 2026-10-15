import { getNamespace, setConfigValue } from './config.js'

export interface SiteSettingsPayload {
  id: string
  contactPhone: string
  contactEmail: string
  contactAddress: string
  workingHours: string
  siteTitle?: string
  siteDescription?: string
  defaultTheme?: string
  frontendUrl?: string
  shopUrl?: string
  updatedAt: string
}

type ConfigEntry = {
  key: string
  valueJson: unknown
}

export const DEFAULT_SITE_SETTINGS: SiteSettingsPayload = {
  id: 'main',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  workingHours: '',
  siteTitle: 'Template Site',
  siteDescription: 'Reusable storefront and booking platform',
  defaultTheme: 'verdant-aurora',
  frontendUrl: '',
  shopUrl: '',
  updatedAt: new Date(0).toISOString(),
}

export function buildSiteSettingsResponse(config: ConfigEntry[]): SiteSettingsPayload {
  const map = new Map(config.map((item) => [item.key, item.valueJson]))

  return {
    id: 'main',
    contactPhone: (map.get('contactPhone') as string) || DEFAULT_SITE_SETTINGS.contactPhone,
    contactEmail: (map.get('contactEmail') as string) || DEFAULT_SITE_SETTINGS.contactEmail,
    contactAddress: (map.get('contactAddress') as string) || DEFAULT_SITE_SETTINGS.contactAddress,
    workingHours: (map.get('workingHours') as string) || DEFAULT_SITE_SETTINGS.workingHours,
    siteTitle: (map.get('siteTitle') as string) || DEFAULT_SITE_SETTINGS.siteTitle,
    siteDescription:
      (map.get('siteDescription') as string) || DEFAULT_SITE_SETTINGS.siteDescription,
    defaultTheme: (map.get('defaultTheme') as string) || DEFAULT_SITE_SETTINGS.defaultTheme,
    frontendUrl: (map.get('frontendUrl') as string) || DEFAULT_SITE_SETTINGS.frontendUrl,
    shopUrl: (map.get('shopUrl') as string) || DEFAULT_SITE_SETTINGS.shopUrl,
    updatedAt: new Date().toISOString(),
  }
}

export async function getSiteSettings() {
  const config = await getNamespace('site')
  return buildSiteSettingsResponse(config)
}

export async function saveSiteSettings(
  payload: Partial<SiteSettingsPayload>,
  updatedBy?: string
) {
  const entries = [
    { key: 'contactPhone', type: 'string', value: payload.contactPhone },
    { key: 'contactEmail', type: 'string', value: payload.contactEmail },
    { key: 'contactAddress', type: 'string', value: payload.contactAddress },
    { key: 'workingHours', type: 'string', value: payload.workingHours },
    { key: 'siteTitle', type: 'string', value: payload.siteTitle },
    { key: 'siteDescription', type: 'string', value: payload.siteDescription },
    { key: 'defaultTheme', type: 'string', value: payload.defaultTheme },
    { key: 'frontendUrl', type: 'url', value: payload.frontendUrl },
    { key: 'shopUrl', type: 'url', value: payload.shopUrl },
  ].filter((entry) => entry.value !== undefined && entry.value !== null)

  if (entries.length === 0) {
    return getSiteSettings()
  }

  for (const entry of entries) {
    await setConfigValue({
      namespace: 'site',
      key: entry.key,
      type: entry.type,
      value: entry.value,
      updatedBy,
    })
  }

  return getSiteSettings()
}
