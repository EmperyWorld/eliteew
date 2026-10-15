export type MasterclassCategory = 'workshop' | 'tasting' | 'education' | 'corporate' | 'special'

export interface Masterclass {
  id: string
  slug: string
  title: string
  shortDescription: string
  fullDescription?: string | null
  price: number
  priceNote?: string | null
  duration: number
  maxParticipants: number
  image?: string | null
  category: MasterclassCategory
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}
