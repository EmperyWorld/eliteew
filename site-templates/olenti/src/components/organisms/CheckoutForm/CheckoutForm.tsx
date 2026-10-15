import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField } from '@components/molecules/FormField'
import { Button } from '@components/atoms/Button'
import { Card } from '@components/atoms/Card'

const checkoutSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Укажите корректный email'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Укажите корректный номер телефона'),
  street: z.string().min(5, 'Укажите адрес'),
  city: z.string().min(2, 'Укажите город'),
  postalCode: z.string().min(5, 'Укажите почтовый индекс'),
  country: z.string().min(2, 'Укажите страну'),
  paymentMethod: z.enum(['card', 'paypal', 'bank-transfer']),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

export interface CheckoutFormProps {
  onSubmit: (data: CheckoutFormData) => Promise<void>
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ onSubmit }) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Контактная информация</h3>
        <FormField
          control={control}
          name="name"
          label="Имя"
          error={errors.name?.message}
          required
        />
        <FormField
          control={control}
          name="email"
          label="Email"
          type="email"
          error={errors.email?.message}
          required
        />
        <FormField
          control={control}
          name="phone"
          label="Телефон"
          type="tel"
          error={errors.phone?.message}
          required
        />
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Адрес доставки</h3>
        <FormField
          control={control}
          name="street"
          label="Улица и дом"
          error={errors.street?.message}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="city"
            label="Город"
            error={errors.city?.message}
            required
          />
          <FormField
            control={control}
            name="postalCode"
            label="Почтовый индекс"
            error={errors.postalCode?.message}
            required
          />
        </div>
        <FormField
          control={control}
          name="country"
          label="Страна"
          error={errors.country?.message}
          required
        />
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Способ оплаты</h3>
        <Controller
          name="paymentMethod"
          control={control}
          render={({ field }) => (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Метод оплаты <span className="text-red-500">*</span>
              </label>
              <select
                {...field}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="card">Банковская карта</option>
                <option value="paypal">PayPal</option>
                <option value="bank-transfer">Банковский перевод</option>
              </select>
              {errors.paymentMethod && (
                <p className="mt-1 text-sm text-red-500">{errors.paymentMethod.message}</p>
              )}
            </div>
          )}
        />
      </Card>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        size="lg"
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        Оформить заказ
      </Button>
    </form>
  )
}
