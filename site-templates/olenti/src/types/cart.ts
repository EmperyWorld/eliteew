import type { Product } from './product'

export interface CartItem {
  product: Product
  quantity: number
  variantId?: string
  volume?: string
}

export interface Cart {
  items: CartItem[]
  total: number
}
