import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@services/api/client'

interface BookingResponse {
  id: string
  consultation?: { title: string }
  masterclass?: { title: string }
  createdAt: string
}

export const useAdminNotifications = () => {
  const { data: notifications = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: async () => {
      const res = await apiClient.get<BookingResponse[]>('/admin/bookings')
      return (res.data || []).slice(0, 5).map((b) => ({
        id: b.id,
        type: b.consultation ? 'consultation' : 'masterclass',
        title: b.consultation?.title || b.masterclass?.title || 'Запись',
        time: new Date(b.createdAt).toLocaleDateString('ru-RU')
      }))
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const error = queryError ? 'Не удалось загрузить уведомления' : null

  return { notifications, loading, error }
}
