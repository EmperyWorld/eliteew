import { resolveSiteSettings } from '@constants/siteDefaults'
import type { SiteSettings } from '@typings/admin'
import { adminApiClient, publicApiClient } from './client'

export async function fetchPublicSiteSettings() {
  const { data } = await publicApiClient.get<SiteSettings>('/settings')
  return resolveSiteSettings(data)
}

export async function fetchAdminSiteSettings() {
  const { data } = await adminApiClient.get<SiteSettings>('/admin/site-settings')
  return resolveSiteSettings(data)
}

export async function saveSiteSettings(settings: Partial<SiteSettings>) {
  const { data } = await adminApiClient.put<SiteSettings>('/admin/site-settings', settings)
  return resolveSiteSettings(data)
}
