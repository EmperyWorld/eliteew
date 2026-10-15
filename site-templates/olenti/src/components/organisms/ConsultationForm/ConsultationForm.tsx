import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField } from '@components/molecules/FormField'
import { Button } from '@components/atoms/Button'

const consultationSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Укажите корректный email'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Укажите корректный номер телефона'),
  preferredDate: z.string().min(1, 'Выберите дату'),
  preferredTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Укажите корректное время'),
  notes: z.string().max(500, 'Заметки слишком длинные').optional(),
})

type ConsultationFormData = z.infer<typeof consultationSchema>

export interface ConsultationFormProps {
  consultationType: string
  onSubmit: (data: ConsultationFormData) => Promise<void>
}

export const ConsultationForm: React.FC<ConsultationFormProps> = ({
  consultationType: _consultationType,
  onSubmit,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(consultationSchema),
    mode: 'onBlur',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={control}
        name="name"
        label="Имя"
        placeholder="Ваше имя"
        error={errors.name?.message}
        required
      />

      <FormField
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        required
      />

      <FormField
        control={control}
        name="phone"
        label="Телефон"
        type="tel"
        placeholder="+7 (999) 123-45-67"
        error={errors.phone?.message}
        required
      />

      <FormField
        control={control}
        name="preferredDate"
        label="Предпочтительная дата"
        type="date"
        error={errors.preferredDate?.message}
        required
      />

      <FormField
        control={control}
        name="preferredTime"
        label="Предпочтительное время"
        type="time"
        error={errors.preferredTime?.message}
        required
      />

      <FormField
        control={control}
        name="notes"
        label="Дополнительные заметки"
        placeholder="Расскажите о ваших предпочтениях..."
        error={errors.notes?.message}
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        Забронировать консультацию
      </Button>
    </form>
  )
}
