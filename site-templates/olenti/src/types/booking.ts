import type { BookingStatus } from './consultation'

export interface Booking {
  id: string
  consultationId: string
  userId: string
  date: Date
  time: string
  status: BookingStatus
  notes?: string
  createdAt: Date
}
