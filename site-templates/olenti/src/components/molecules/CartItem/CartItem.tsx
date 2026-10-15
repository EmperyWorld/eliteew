import React from 'react'
import { Trash2, Plus, Minus } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { PriceTag } from '@components/molecules/PriceTag'
import type { CartItem } from '@typings/cart'

export interface CartItemProps {
  item: CartItem
  onUpdateQuantity: (productId: string, quantity: number, variantId?: string, volume?: string) => void
  onRemove: (productId: string, variantId?: string, volume?: string) => void
}

export const CartItemComponent: React.FC<CartItemProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
}) => {
  return (
    <Card className="flex items-center gap-4 p-4">
      <img
        src={item.product.image}
        alt={item.product.name}
        loading="lazy"
        decoding="async"
        className="w-20 h-20 object-cover rounded"
      />
      <div className="grow">
        <h4 className="font-semibold text-gray-900">{item.product.name}</h4>
        {item.volume && (
          <p className="text-sm text-gray-600">Объем: {item.volume}</p>
        )}
        <PriceTag price={item.product.price * item.quantity} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1, item.variantId, item.volume)}
          aria-label="Уменьшить количество"
          className="p-1 rounded hover:bg-gray-100"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1, item.variantId, item.volume)}
          aria-label="Увеличить количество"
          className="p-1 rounded hover:bg-gray-100"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => onRemove(item.product.id, item.variantId, item.volume)}
          aria-label="Удалить из корзины"
          className="p-2 text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  )
}
