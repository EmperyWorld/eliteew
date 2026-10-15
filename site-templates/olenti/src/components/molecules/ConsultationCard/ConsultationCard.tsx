import React from 'react'
import { Clock, DollarSign } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { Badge } from '@components/atoms/Badge'
import type { Consultation } from '@typings/consultation'

export interface ConsultationCardProps {
  consultation: Consultation
  onBook: (consultationId: string) => void
  isBooked?: boolean
}

export const ConsultationCard: React.FC<ConsultationCardProps> = ({
  consultation,
  onBook,
  isBooked = false,
}) => {
  return (
    <Card hover>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {consultation.title}
        </h3>
        {consultation.isPopular && (
          <Badge variant="warning">Популярное</Badge>
        )}
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
        {consultation.shortDescription}
      </p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Clock size={18} className="text-primary-600" />
          <span className="text-sm">{consultation.duration} минут</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <DollarSign size={18} className="text-primary-600" />
          <span className="text-sm font-semibold">{consultation.price.toLocaleString('ru-RU')}₽</span>
        </div>
      </div>

      <Button
        variant={isBooked ? 'secondary' : 'primary'}
        fullWidth
        disabled={isBooked}
        onClick={() => onBook(consultation.id)}
      >
        {isBooked ? 'Уже забронирована' : 'Забронировать'}
      </Button>
    </Card>
  )
}
