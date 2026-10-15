const STORAGE_PREFIX = 'template-core'

export const USER_TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}:user-token`
export const ADMIN_TOKEN_STORAGE_KEY = `${STORAGE_PREFIX}:admin-token`
export const USER_STORE_STORAGE_KEY = `${STORAGE_PREFIX}:user-session`
export const ADMIN_STORE_STORAGE_KEY = `${STORAGE_PREFIX}:admin-session`
export const ADMIN_THEME_STORAGE_KEY = `${STORAGE_PREFIX}:admin-theme`

const isBrowser = typeof window !== 'undefined'

const getStorage = () => {
  if (!isBrowser) {
    return null
  }

  return window.localStorage
}

export const getUserToken = () => getStorage()?.getItem(USER_TOKEN_STORAGE_KEY) ?? null

export const setUserToken = (token: string) => {
  getStorage()?.setItem(USER_TOKEN_STORAGE_KEY, token)
}

export const clearUserToken = () => {
  getStorage()?.removeItem(USER_TOKEN_STORAGE_KEY)
}

export const getAdminToken = () => getStorage()?.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? null

export const setAdminToken = (token: string) => {
  getStorage()?.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
}

export const clearAdminToken = () => {
  getStorage()?.removeItem(ADMIN_TOKEN_STORAGE_KEY)
}
