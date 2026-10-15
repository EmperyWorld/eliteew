export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Consultation {
  id: string
  slug: string
  title: string
  shortDescription: string
  fullDescription?: string | null
  price: number
  duration: number
  image?: string | null
  isPopular: boolean
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface ConsultationBooking {
  consultationId: string
  name: string
  email: string
  phone: string
  preferredDate: Date
  preferredTime: string
  notes?: string
}
