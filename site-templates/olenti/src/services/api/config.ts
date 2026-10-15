import { adminApiClient } from './client'

export type ConfigItem = {
  id: string
  namespace: string
  key: string
  type: string
  valueJson: unknown
  description?: string | null
  updatedBy?: string | null
  updatedAt: string
}

export async function fetchConfig(namespace = 'site') {
  const { data } = await adminApiClient.get<{ namespace: string; items: ConfigItem[] }>('/admin/config', {
    params: { namespace },
  })
  return data.items
}

export async function upsertConfigItems(namespace: string, items: Array<{ key: string; type: string; value: unknown; description?: string }>) {
  const { data } = await adminApiClient.put('/admin/config', {
    namespace,
    items,
  })
  return data.items as ConfigItem[]
}

export async function fetchFeatureFlags() {
  const { data } = await adminApiClient.get('/admin/flags')
  return data as Array<{
    id: string
    key: string
    isEnabled: boolean
    scope?: string | null
    rollout?: number | null
    description?: string | null
  }>
}

export async function upsertFeatureFlags(items: Array<{ key: string; isEnabled?: boolean; scope?: string; rollout?: number | null; description?: string }>) {
  const { data } = await adminApiClient.put('/admin/flags', { items })
  return data.items as Array<{
    id: string
    key: string
    isEnabled: boolean
    scope?: string | null
    rollout?: number | null
    description?: string | null
  }>
}
