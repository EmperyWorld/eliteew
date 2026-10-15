export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export interface Filter {
  category?: string
  priceRange?: [number, number]
  rating?: number
}

export type SortOption = 'newest' | 'popular' | 'price-asc' | 'price-desc'
