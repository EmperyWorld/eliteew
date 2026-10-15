import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { API_ENDPOINTS } from '@constants/api'
import type { Order } from '@typings/order'
import type { LoginRequest, RegisterRequest } from '@typings/auth'

export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const { data } = await apiClient.post(API_ENDPOINTS.AUTH_LOGIN, credentials)
      return data
    },
  })
}

export const useRegister = () => {
  return useMutation({
    mutationFn: async (userData: RegisterRequest) => {
      const { data } = await apiClient.post(API_ENDPOINTS.AUTH_REGISTER, userData)
      return data
    },
  })
}

export const useLogout = () => {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT)
    },
  })
}

export const useCreateOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderData: Partial<Order>) => {
      const { data } = await apiClient.post<Order>(API_ENDPOINTS.ORDERS, orderData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
