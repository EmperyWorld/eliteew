import { useCartStore } from '@store/slices/cartSlice'
import { useToast } from '@components/atoms/Toast'
import type { Product } from '@typings/product'

export const useCart = () => {
  const { addItem, removeItem, updateQuantity, clearCart, getItemCount, getTotal } = useCartStore()
  const toast = useToast()

  return {
    addToCart: (product: Product, quantity?: number, volume?: string, variantId?: string) => {
      addItem(product, quantity, volume, variantId)
      toast.success(`${product.name} добавлен в корзину`)
    },
    removeFromCart: (productId: string, volume?: string, variantId?: string) => {
      removeItem(productId, volume, variantId)
    },
    updateCartQuantity: (productId: string, quantity: number, volume?: string, variantId?: string) => {
      updateQuantity(productId, quantity, volume, variantId)
    },
    clearCartItems: () => {
      clearCart()
    },
    getItemCount,
    getTotal,
  }
}
