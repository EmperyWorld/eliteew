import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@typings/product'
import type { CartItem } from '@typings/cart'

interface CartStore {
  items: CartItem[]
  total: number

  addItem: (product: Product, quantity?: number, volume?: string, variantId?: string) => void
  removeItem: (productId: string, volume?: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, volume?: string, variantId?: string) => void
  clearCart: () => void

  getItemCount: () => number
  getTotal: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,

      addItem: (product, quantity = 1, volume, variantId) => {
        set((state) => {
          // Авто-нормализация: если нет variantId/volume, берем первый вариант и подставляем его цену/объем
          let selectedVariantId = variantId
          let selectedVolume = volume
          let productForCart = product

          if ((!variantId || !volume) && product.variants && product.variants.length > 0) {
            const first = product.variants[0]
            selectedVariantId = first.id
            selectedVolume = first.volume
            productForCart = {
              ...product,
              price: first.price,
              originalPrice: first.oldPrice ?? product.originalPrice,
              volume: first.volume,
            }
          }

          const existingItem = state.items.find(
            item => item.product.id === productForCart.id && item.volume === selectedVolume && item.variantId === selectedVariantId
          )

          let newItems: CartItem[]
          if (existingItem) {
            newItems = state.items.map(item =>
              item.product.id === productForCart.id && item.volume === selectedVolume && item.variantId === selectedVariantId
                ? { ...item, quantity: item.quantity + quantity, product: productForCart }
                : item
            )
          } else {
            newItems = [...state.items, { product: productForCart, quantity, volume: selectedVolume, variantId: selectedVariantId }]
          }

          const newTotal = newItems.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          )

          return { items: newItems, total: newTotal }
        })
      },

      removeItem: (productId, volume, variantId) => {
        set((state) => {
          const newItems = state.items.filter(
            item => !(item.product.id === productId && item.volume === volume && item.variantId === variantId)
          )
          const newTotal = newItems.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          )
          return { items: newItems, total: newTotal }
        })
      },

      updateQuantity: (productId, quantity, volume, variantId) => {
        set((state) => {
          const newItems = state.items.map(item =>
            item.product.id === productId && item.volume === volume && item.variantId === variantId
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          ).filter(item => item.quantity > 0)

          const newTotal = newItems.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
          )

          return { items: newItems, total: newTotal }
        })
      },

      clearCart: () => {
        set({ items: [], total: 0 })
      },

      getItemCount: () => {
        const { items } = get()
        return items.reduce((count, item) => count + item.quantity, 0)
      },

      getTotal: () => {
        return get().total
      },
    }),
    {
      name: 'cart-storage-v5',
      version: 5,
      migrate: (persistedState: unknown, fromVersion: number) => {
        // Полная очистка старых корзин, чтобы гарантировать корректные variantId и цены вариантов
        if (!persistedState || fromVersion < 5) {
          return { items: [], total: 0 }
        }
        return persistedState
      },
    }
  )
)
