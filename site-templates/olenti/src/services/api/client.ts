import { API_TIMEOUT } from '@constants/api'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import {
    clearAdminToken,
    clearUserToken,
    getAdminToken,
    getUserToken,
} from './authStorage'

type ClientMode = 'public' | 'admin' | 'hybrid'

const isConnectionError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    return (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ERR_CONNECTION_REFUSED') ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout')
    )
  }

  return false
}

const getApiBaseURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (import.meta.env.DEV) {
    return '/api'
  }

  return '/api'
}

const normalizeRequestUrl = (url?: string) => {
  if (!url) {
    return ''
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }

  return url
}

const isAdminRequestUrl = (url?: string) => {
  const normalizedUrl = normalizeRequestUrl(url)
  return normalizedUrl.startsWith('/admin')
}

const getTokenForRequest = (mode: ClientMode, url?: string) => {
  if (mode === 'admin') {
    return getAdminToken()
  }

  if (mode === 'public') {
    return getUserToken()
  }

  return isAdminRequestUrl(url) ? getAdminToken() : getUserToken()
}

const clearTokenForRequest = (mode: ClientMode, url?: string) => {
  if (mode === 'admin' || (mode === 'hybrid' && isAdminRequestUrl(url))) {
    clearAdminToken()
    return '/admin/login'
  }

  clearUserToken()
  return '/auth/login'
}

const redirectToLogin = (targetPath: string) => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname !== targetPath) {
    window.location.href = targetPath
  }
}

const createClient = (): AxiosInstance =>
  axios.create({
    baseURL: getApiBaseURL(),
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const attachInterceptors = (client: AxiosInstance, mode: ClientMode) => {
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getTokenForRequest(mode, config.url)

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else if (config.headers.Authorization) {
        delete config.headers.Authorization
      }

      return config
    },
    (error) => {
      if (import.meta.env.DEV && isConnectionError(error)) {
        return Promise.reject(error)
      }

      return Promise.reject(error)
    }
  )

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (import.meta.env.DEV && isConnectionError(error)) {
        return Promise.reject(error)
      }

      if (error.response?.status === 401) {
        const loginPath = clearTokenForRequest(mode, error.config?.url)
        redirectToLogin(loginPath)
      }

      return Promise.reject(error)
    }
  )
}

export const publicApiClient = createClient()
export const adminApiClient = createClient()
export const apiClient = createClient()

attachInterceptors(publicApiClient, 'public')
attachInterceptors(adminApiClient, 'admin')
attachInterceptors(apiClient, 'hybrid')
