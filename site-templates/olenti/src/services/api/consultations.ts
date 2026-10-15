import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { API_ENDPOINTS } from '@constants/api'
import type { Consultation, ConsultationBooking } from '@typings/consultation'

export interface ConsultationDetail extends Consultation {
  fullDescription?: string | null
}

export const useConsultations = () => {
  return useQuery({
    queryKey: ['consultations'],
    queryFn: async () => {
      const { data } = await apiClient.get<Consultation[]>(API_ENDPOINTS.CONSULTATIONS)
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

export const useConsultation = (slug: string) => {
  return useQuery({
    queryKey: ['consultation', slug],
    queryFn: async () => {
      const { data } = await apiClient.get<ConsultationDetail>(API_ENDPOINTS.CONSULTATION_BY_ID(slug))
      return data
    },
    enabled: !!slug,
  })
}

export const useBookConsultation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ consultationId, booking }: {
      consultationId: string
      booking: ConsultationBooking
    }) => {
      const { data } = await apiClient.post(
        `${API_ENDPOINTS.CONSULTATION_BY_ID(consultationId)}/book`,
        booking
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
    },
  })
}
