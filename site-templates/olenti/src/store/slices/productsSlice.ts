import { create } from 'zustand'
import type { Product } from '@typings/product'

interface ProductsStore {
  favorites: string[]
  recentlyViewed: Product[]
  
  addToFavorites: (productId: string) => void
  removeFromFavorites: (productId: string) => void
  addToRecentlyViewed: (product: Product) => void
  isFavorite: (productId: string) => boolean
}

export const useProductsStore = create<ProductsStore>((set, get) => ({
  favorites: [],
  recentlyViewed: [],

  addToFavorites: (productId) => {
    set((state) => ({
      favorites: [...state.favorites, productId],
    }))
  },

  removeFromFavorites: (productId) => {
    set((state) => ({
      favorites: state.favorites.filter(id => id !== productId),
    }))
  },

  addToRecentlyViewed: (product) => {
    set((state) => {
      const filtered = state.recentlyViewed.filter(p => p.id !== product.id)
      return {
        recentlyViewed: [product, ...filtered].slice(0, 10),
      }
    })
  },

  isFavorite: (productId) => {
    return get().favorites.includes(productId)
  },
}))
