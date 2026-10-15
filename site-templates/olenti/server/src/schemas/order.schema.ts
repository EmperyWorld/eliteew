import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().min(1, 'Name is required'),
    customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
    // Телефон делаем необязательным: если указан, то должен быть валидным,
    // но заказ можно оформить и без него (идентификация по аккаунту).
    customerPhone: z.string().min(5, 'Phone number is too short').optional().or(z.literal('')),
    deliveryMethod: z.enum(['pickup', 'delivery']),
    deliveryAddress: z.string().optional(),
    deliveryCity: z.string().optional(),
    paymentMethod: z.enum(['card', 'cash', 'transfer']),
    items: z.array(z.object({
      productId: z.string().min(1),
      variantId: z.string().optional(),
      volume: z.string().optional(),
      quantity: z.number().int().positive(),
    })).nonempty('Order must contain at least one item'),
    notes: z.string().optional(),
  }),
});
