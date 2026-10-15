import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface GalleryImage {
  id: string
  url: string
  alt: string
  title?: string
  category: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateGalleryImageData {
  url: string
  alt: string
  title?: string
  category: string
  order?: number
}

export function useGalleryImages(category?: string) {
  return useQuery({
    queryKey: ['gallery', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : ''
      const { data } = await apiClient.get<GalleryImage[]>(`/gallery${params}`)
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateGalleryImageData) => {
      const { data: result } = await apiClient.post<GalleryImage>('/gallery', data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}

export function useUpdateGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<GalleryImage> & { id: string }) => {
      const { data: result } = await apiClient.patch<GalleryImage>(`/gallery/${id}`, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}

export function useDeleteGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/gallery/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}
