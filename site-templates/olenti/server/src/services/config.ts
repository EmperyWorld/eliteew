import { prisma } from '../index.js'

const allowedTypes = ['string', 'int', 'bool', 'json', 'url', 'email', 'phone']
const cache = new Map<string, unknown>()

function cacheKey(namespace: string, key: string) {
  return `${namespace}:${key}`
}

function coerceValue(type: string, value: unknown) {
  switch (type) {
    case 'int':
      if (typeof value === 'number') return value
      if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
        return Number(value)
      }
      throw new Error('Invalid int value')
    case 'bool':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') return value.toLowerCase() === 'true'
      throw new Error('Invalid bool value')
    case 'json':
      if (typeof value === 'object' && value !== null) return value
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          throw new Error('Invalid json value')
        }
      }
      throw new Error('Invalid json value')
    case 'string':
    case 'url':
    case 'email':
    case 'phone':
    default:
      if (value === undefined || value === null) return ''
      return String(value)
  }
}

export async function getConfigValue(namespace: string, key: string, defaultValue?: unknown) {
  const k = cacheKey(namespace, key)
  if (cache.has(k)) return cache.get(k)

  const entry = await prisma.config.findUnique({
    where: { namespace_key: { namespace, key } },
  })
  const val = entry ? entry.valueJson : defaultValue
  cache.set(k, val)
  return val
}

export async function getNamespace(namespace: string) {
  const list = await prisma.config.findMany({
    where: { namespace },
    orderBy: [{ key: 'asc' }],
  })
  list.forEach((item) => cache.set(cacheKey(namespace, item.key), item.valueJson))
  return list
}

export async function setConfigValue(params: {
  namespace: string
  key: string
  type: string
  value: unknown
  description?: string
  updatedBy?: string
}) {
  const { namespace, key, type, value, description, updatedBy } = params

  if (!allowedTypes.includes(type)) {
    throw new Error('Unsupported type')
  }

  const coerced = coerceValue(type, value)

  const saved = await prisma.config.upsert({
    where: { namespace_key: { namespace, key } },
    update: {
      type,
      valueJson: coerced as any,
      description,
      updatedBy,
    },
    create: {
      namespace,
      key,
      type,
      valueJson: coerced as any,
      description,
      updatedBy,
    },
  })

  cache.set(cacheKey(namespace, key), saved.valueJson)
  return saved
}

export function invalidateConfig(namespace?: string, key?: string) {
  if (namespace && key) {
    cache.delete(cacheKey(namespace, key))
    return
  }
  if (namespace) {
    Array.from(cache.keys()).forEach((k) => {
      if (k.startsWith(`${namespace}:`)) cache.delete(k)
    })
    return
  }
  cache.clear()
}

export function getAllowedTypes() {
  return allowedTypes
}

