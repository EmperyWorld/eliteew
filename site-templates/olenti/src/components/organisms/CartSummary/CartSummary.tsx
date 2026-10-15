import React from 'react'
import { Card } from '@components/atoms/Card'
import { Typography } from '@components/atoms/Typography'
import { Separator } from '@components/atoms/Separator'
import { useCartStore } from '@store/slices/cartSlice'

export const CartSummary: React.FC = () => {
  const { getTotal, getItemCount } = useCartStore()
  const subtotal = getTotal()
  const shipping = subtotal > 5000 ? 0 : 500
  const total = subtotal + shipping

  return (
    <Card>
      <Typography variant="h3" className="mb-4">
        Итого
      </Typography>
      <Separator className="mb-4" />
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span>Товаров ({getItemCount()})</span>
          <span>{subtotal}₽</span>
        </div>
        <div className="flex justify-between">
          <span>Доставка</span>
          <span>{shipping === 0 ? 'Бесплатно' : `${shipping}₽`}</span>
        </div>
      </div>
      <Separator className="mb-4" />
      <div className="flex justify-between text-lg font-bold mb-4">
        <span>Всего</span>
        <span>{total}₽</span>
      </div>
      {subtotal < 5000 && (
        <p className="text-sm text-gray-600">
          Добавьте товаров на {5000 - subtotal}₽ для бесплатной доставки
        </p>
      )}
    </Card>
  )
}
