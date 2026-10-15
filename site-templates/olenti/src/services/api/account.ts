import { API_ENDPOINTS } from '@constants/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Product } from '@typings/product'
import { apiClient } from './client'

// ==================== TYPES ====================

export interface OrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  product: Product
}

export interface UserOrder {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryMethod: string
  deliveryAddress?: string
  deliveryCity?: string
  paymentMethod: string
  subtotal: number
  deliveryPrice: number
  totalPrice: number
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  notes?: string
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

export interface UserBooking {
  id: string
  consultationId?: string
  masterclassId?: string
  date: string
  time: string
  participants: number
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  notes?: string
  totalPrice: number
  createdAt: string
  updatedAt: string
  consultation?: {
    id: string
    title: string
    shortDescription: string
    price: number
    duration: number
  }
  masterclass?: {
    id: string
    title: string
    shortDescription: string
    price: number
    duration: number
  }
}

export interface UserFavorite {
  id: string
  productId: string
  createdAt: string
  product: Product
}

// ==================== ORDERS ====================

export function useUserOrders() {
  return useQuery({
    queryKey: ['user', 'orders'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserOrder[]>(API_ENDPOINTS.MY_ORDERS)
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useUserOrder(orderId: string) {
  return useQuery({
    queryKey: ['user', 'orders', orderId],
    queryFn: async () => {
      const { data } = await apiClient.get<UserOrder>(API_ENDPOINTS.ORDER_BY_ID(orderId))
      return data
    },
    enabled: !!orderId,
  })
}

// ==================== BOOKINGS ====================

export function useUserBookings() {
  return useQuery({
    queryKey: ['user', 'bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserBooking[]>(API_ENDPOINTS.MY_BOOKINGS)
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data } = await apiClient.patch(API_ENDPOINTS.BOOKING_CANCEL(bookingId))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'bookings'] })
    },
  })
}

// ==================== FAVORITES ====================

export function useUserFavorites() {
  return useQuery({
    queryKey: ['user', 'favorites'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserFavorite[]>(API_ENDPOINTS.FAVORITES)
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useAddFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      const { data } = await apiClient.post<UserFavorite>(API_ENDPOINTS.FAVORITE_BY_PRODUCT(productId))
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] })
    },
  })
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.delete(API_ENDPOINTS.FAVORITE_BY_PRODUCT(productId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] })
    },
  })
}

export function useCheckFavorite(productId: string) {
  return useQuery({
    queryKey: ['user', 'favorites', 'check', productId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ isFavorite: boolean }>(API_ENDPOINTS.FAVORITE_CHECK(productId))
      return data.isFavorite
    },
    enabled: !!productId,
    staleTime: 1000 * 60,
  })
}

// ==================== PROFILE ====================

export interface UpdateProfileData {
  name?: string
  phone?: string
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const { data: result } = await apiClient.patch(API_ENDPOINTS.AUTH_ME, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}

// ==================== COUNTS (for profile menu) ====================

export function useAccountCounts() {
  const { data: orders } = useUserOrders()
  const { data: bookings } = useUserBookings()
  const { data: favorites } = useUserFavorites()

  const now = new Date()

  const ordersCount = orders?.filter(o =>
    o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  ).length ?? 0

  const upcomingBookingsCount = bookings?.filter(b => {
    const bookingDate = new Date(`${b.date}T${b.time}`)
    return bookingDate >= now && b.status !== 'CANCELLED' && b.status !== 'COMPLETED'
  }).length ?? 0

  const favoritesCount = favorites?.length ?? 0

  return {
    orders: ordersCount,
    bookings: upcomingBookingsCount,
    favorites: favoritesCount,
  }
}
