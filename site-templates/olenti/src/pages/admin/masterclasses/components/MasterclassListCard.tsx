import React from 'react'
import { Link } from 'react-router-dom'
import { Edit, Trash2, Eye, EyeOff, Users } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { getUploadedImageUrl } from '@utils/imageUrl'
import type { MasterclassAdmin, MasterclassCategory } from '@typings/admin'

interface MasterclassListCardProps {
  masterclass: MasterclassAdmin
  categoryLabels: Record<MasterclassCategory, string>
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
}

export const MasterclassListCard: React.FC<MasterclassListCardProps> = ({
  masterclass,
  categoryLabels,
  onToggleStatus,
  onDelete
}) => {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-6">
        {/* Image placeholder */}
        <div className="w-24 h-24 bg-neutral-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
          {masterclass.image ? (
            <img
              src={getUploadedImageUrl(masterclass.image)}
              alt={masterclass.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-neutral-400 text-xs">Нет фото</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-neutral-900">{masterclass.title}</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {categoryLabels[masterclass.category]}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    masterclass.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {masterclass.status === 'active' ? 'Активно' : 'Черновик'}
                </span>
              </div>
              <p className="text-neutral-600 mt-1 line-clamp-2">{masterclass.shortDescription}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleStatus(masterclass.id)}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
                title={masterclass.status === 'active' ? 'Скрыть' : 'Показать'}
                aria-label={masterclass.status === 'active' ? 'Скрыть' : 'Показать'}
              >
                {masterclass.status === 'active' ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <Link
                to={`/admin/masterclasses/${masterclass.id}`}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
                aria-label="Редактировать"
              >
                <Edit size={18} />
              </Link>
              <button
                onClick={() => onDelete(masterclass.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600 transition-colors"
                aria-label="Удалить"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 text-sm flex-wrap">
            <div>
              <span className="text-neutral-500">Цена:</span>{' '}
              <span className="font-semibold text-neutral-900">
                {masterclass.priceNote === 'от' && 'от '}
                {masterclass.price.toLocaleString('ru-RU')} ₽
                {masterclass.priceNote && masterclass.priceNote !== 'от' && ` ${masterclass.priceNote}`}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Длительность:</span>{' '}
              <span className="font-semibold text-neutral-900">{masterclass.duration} мин</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={16} className="text-neutral-400" />
              <span className="text-neutral-500">
                {masterclass.minParticipants && `${masterclass.minParticipants}-`}
                {masterclass.maxParticipants} чел.
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
