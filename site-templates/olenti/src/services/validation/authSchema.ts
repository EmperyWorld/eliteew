import { z } from 'zod'

export const authSchema = z.object({
  email: z.string().email('Укажите корректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
})

export const registerSchema = authSchema.extend({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Укажите корректный номер телефона').optional(),
})

export type LoginFormData = z.infer<typeof authSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
