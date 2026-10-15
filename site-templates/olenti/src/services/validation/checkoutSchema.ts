import { z } from 'zod'

export const checkoutSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Укажите корректный email'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Укажите корректный номер телефона'),
  street: z.string().min(5, 'Укажите адрес'),
  city: z.string().min(2, 'Укажите город'),
  postalCode: z.string().min(5, 'Укажите почтовый индекс'),
  country: z.string().min(2, 'Укажите страну'),
  paymentMethod: z.enum(['card', 'paypal', 'bank-transfer']),
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>
