import { z } from 'zod'

export const consultationBookingSchema = z.object({
  name: z.string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя слишком длинное'),

  email: z.string()
    .email('Укажите корректный email'),

  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Укажите корректный номер телефона'),

  consultationType: z.enum([
    'intro-session',
    'strategy-call',
    'content-audit',
    'launch-support',
  ], { message: 'Выберите тип консультации' }),

  preferredDate: z.string()
    .min(1, 'Выберите дату'),

  preferredTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Укажите корректное время'),

  notes: z.string()
    .max(500, 'Заметки слишком длинные')
    .optional(),

  agreeToTerms: z.boolean()
    .refine(val => val === true, {
      message: 'Согласитесь с условиями использования'
    }),
})

export type ConsultationBookingData = z.infer<typeof consultationBookingSchema>
