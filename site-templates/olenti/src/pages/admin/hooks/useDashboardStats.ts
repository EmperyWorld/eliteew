import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@services/api/client'

export interface ScheduleSlot {
  id: string
  date: string
  time: string
  type: string
  title: string
  maxBookings: number
  currentBookings: number
  isAvailable: boolean
}

export interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalBookings: number
  totalUsers: number
  totalRevenue: number
  totalConsultations: number
  totalMasterclasses: number
  pendingOrders: number
  pendingBookings: number
  recentOrders: Array<{ id: string; customerName: string; totalPrice: number; status: string; createdAt: string }>
  recentBookings: Array<{
    id: string
    status: string
    createdAt: string
    guestName?: string | null
    user?: { name: string | null } | null
    consultation?: { title: string } | null
    masterclass?: { title: string } | null
  }>
}

const INITIAL_STATS: DashboardStats = {
  totalProducts: 0,
  totalOrders: 0,
  totalBookings: 0,
  totalUsers: 0,
  totalRevenue: 0,
  totalConsultations: 0,
  totalMasterclasses: 0,
  pendingOrders: 0,
  pendingBookings: 0,
  recentOrders: [],
  recentBookings: [],
}

export const useDashboardStats = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [upcomingSlots, setUpcomingSlots] = useState<ScheduleSlot[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, slotsRes, pendingOrdersRes, bookingsRes] = await Promise.all([
        apiClient.get<DashboardStats>('/admin/stats'),
        apiClient.get('/schedule'),
        apiClient.get('/admin/orders?status=PENDING'),
        apiClient.get('/admin/bookings')
      ])
      
      const statsData = statsRes.data
      
      // Add calculated pending counts
      statsData.pendingOrders = Array.isArray(pendingOrdersRes.data) ? pendingOrdersRes.data.length : 0
      statsData.pendingBookings = Array.isArray(bookingsRes.data) 
        ? bookingsRes.data.filter((b: { status: string }) => b.status === 'PENDING').length 
        : 0

      setStats(statsData)
      
      // Filter upcoming slots (today and future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const upcoming = (slotsRes.data || [])
        .filter((slot: ScheduleSlot) => new Date(slot.date) >= today)
        .sort((a: ScheduleSlot, b: ScheduleSlot) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5)
      setUpcomingSlots(upcoming)
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err)
      setStats(INITIAL_STATS)
      setUpcomingSlots([])
      setError('Не удалось загрузить данные дашборда')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    loading,
    stats,
    upcomingSlots,
    error,
    refetch: fetchData
  }
}
