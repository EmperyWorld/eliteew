import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { API_ENDPOINTS } from '@constants/api'
import type { Product } from '@typings/product'
import type { PaginatedResponse } from '@typings/api'

type ProductQueryParams = {
  category?: string
  collection?: string
  search?: string
  q?: string
  minPrice?: number
  maxPrice?: number
  volume?: string
  inStock?: string // 'true' to filter only in-stock products
  isNew?: string
  isFeatured?: string
}

export const useProducts = (filters?: ProductQueryParams) => {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Product>>(API_ENDPOINTS.PRODUCTS, {
        params: filters,
      })
      return data
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  })
}

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Product>(API_ENDPOINTS.PRODUCT_BY_ID(id))
      return data
    },
    enabled: !!id,
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { data } = await apiClient.post<Product>(API_ENDPOINTS.PRODUCTS, product)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data } = await apiClient.patch<Product>(API_ENDPOINTS.PRODUCT_BY_ID(id), product)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(API_ENDPOINTS.PRODUCT_BY_ID(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
