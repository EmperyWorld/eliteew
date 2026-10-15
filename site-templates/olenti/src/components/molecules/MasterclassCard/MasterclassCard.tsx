import React from 'react'
import { Users, Calendar, Clock } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Badge } from '@components/atoms/Badge'
import { Button } from '@components/atoms/Button'
import type { Masterclass } from '@typings/masterclass'

const categoryLabels: Record<string, string> = {
  workshop: 'Мастер-класс',
  tasting: 'Дегустация',
  education: 'Обучение',
  corporate: 'Корпоратив',
  special: 'Особый формат',
}

export interface MasterclassCardProps {
  masterclass: Masterclass
  onViewDetails: (id: string) => void
  onBook?: (id: string) => void
}

export const MasterclassCard: React.FC<MasterclassCardProps> = ({
  masterclass,
  onViewDetails,
  onBook,
}) => {
  const formatPrice = () => {
    if (masterclass.priceNote === 'от') {
      return `от ${masterclass.price.toLocaleString('ru-RU')}₽`
    }
    if (masterclass.priceNote) {
      return `${masterclass.price.toLocaleString('ru-RU')}₽ ${masterclass.priceNote}`
    }
    return `${masterclass.price.toLocaleString('ru-RU')}₽`
  }

  return (
    <Card hover className="flex flex-col h-full group overflow-hidden">
      <div className="relative mb-4 -mx-6 -mt-6 overflow-hidden rounded-t-xl">
        <div className="aspect-video w-full bg-gradient-to-br from-accent-200 via-primary-200 to-emerald-200 relative overflow-hidden">
          {masterclass.image && (
            <img
              src={masterclass.image}
              alt={masterclass.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        <div className="absolute top-3 left-3">
          <Badge variant="info" className="shadow-lg backdrop-blur-sm bg-white/90">
            {categoryLabels[masterclass.category] || masterclass.category}
          </Badge>
        </div>
      </div>

      <div className="grow flex flex-col">
        <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-primary-700 transition-colors">
          {masterclass.title}
        </h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 grow">
          {masterclass.shortDescription}
        </p>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold gradient-text">
              {formatPrice()}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users size={16} />
              <span className="font-medium">до {masterclass.maxParticipants}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock size={14} />
            <span>{Math.floor(masterclass.duration / 60)} ч {masterclass.duration % 60 > 0 ? `${masterclass.duration % 60} мин` : ''}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => onViewDetails(masterclass.id)}
          className="group/btn"
        >
          Подробнее
        </Button>
        {onBook && (
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onBook(masterclass.id)}
            className="group/btn"
          >
            <Calendar size={16} className="mr-1.5 group-hover/btn:scale-110 transition-transform" />
            Записаться
          </Button>
        )}
      </div>
    </Card>
  )
}
