import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { API_ENDPOINTS } from '@constants/api'
import type { Masterclass } from '@typings/masterclass'

export interface MasterclassDetail extends Masterclass {
  fullDescription?: string | null
}

export const useMasterclasses = () => {
  return useQuery({
    queryKey: ['masterclasses'],
    queryFn: async () => {
      const { data } = await apiClient.get<Masterclass[]>(API_ENDPOINTS.MASTERCLASSES)
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export const useMasterclass = (slug: string) => {
  return useQuery({
    queryKey: ['masterclass', slug],
    queryFn: async () => {
      const { data } = await apiClient.get<MasterclassDetail>(API_ENDPOINTS.MASTERCLASS_BY_ID(slug))
      return data
    },
    enabled: !!slug,
  })
}

export const useBookMasterclass = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (masterclassId: string) => {
      const { data } = await apiClient.post(
        `${API_ENDPOINTS.MASTERCLASS_BY_ID(masterclassId)}/book`
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterclasses'] })
    },
  })
}
