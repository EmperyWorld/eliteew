import React from 'react'
import { Link } from 'react-router-dom'
import { Edit, Trash2, Eye, EyeOff, Clock, DollarSign, MessageSquare } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { getUploadedImageUrl } from '@utils/imageUrl'
import type { ConsultationAdmin } from '@typings/admin'

interface ConsultationListCardProps {
  consultation: ConsultationAdmin
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  viewMode?: 'list' | 'grid'
}

export const ConsultationListCard: React.FC<ConsultationListCardProps> = ({
  consultation,
  onToggleStatus,
  onDelete,
  viewMode = 'list'
}) => {
  const isGrid = viewMode === 'grid'

  if (isGrid) {
    return (
      <Card className="p-4 group hover:shadow-lg transition-all duration-200 border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Image */}
        <div className="w-full h-48 bg-neutral-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 overflow-hidden relative">
          {consultation.image ? (
            <img
              src={getUploadedImageUrl(consultation.image)}
              alt={consultation.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <MessageSquare size={48} className="text-neutral-300 dark:text-slate-600" />
          )}
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleStatus(consultation.id)}
              className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
              aria-label={consultation.status === 'active' ? 'Скрыть консультацию' : 'Опубликовать консультацию'}
            >
              {consultation.status === 'active' ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <Link
              to={`/admin/consultations/${consultation.id}`}
              className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-neutral-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              aria-label="Редактировать консультацию"
            >
              <Edit size={16} />
            </Link>
            <button
              onClick={() => onDelete(consultation.id)}
              className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label="Удалить консультацию"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white line-clamp-2 flex-1">
              {consultation.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {consultation.popular && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                Популярное
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                consultation.status === 'active'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400'
              }`}
            >
              {consultation.status === 'active' ? 'Активно' : 'Черновик'}
            </span>
          </div>

          {consultation.shortDescription && (
            <p className="text-sm text-neutral-600 dark:text-slate-400 line-clamp-2">
              {consultation.shortDescription}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-slate-700">
            <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-slate-400">
              <DollarSign size={14} />
              <span className="font-semibold text-neutral-900 dark:text-white">
                {consultation.price.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-slate-400">
              <Clock size={14} />
              <span>{consultation.duration} мин</span>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 group hover:shadow-md transition-all duration-200 border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-start gap-6">
        {/* Image placeholder */}
        <div className="w-24 h-24 bg-neutral-100 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
          {consultation.image ? (
            <img
              src={getUploadedImageUrl(consultation.image)}
              alt={consultation.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <MessageSquare size={32} className="text-neutral-300 dark:text-slate-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{consultation.title}</h3>
                {consultation.popular && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                    Популярное
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    consultation.status === 'active'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-400'
                  }`}
                >
                  {consultation.status === 'active' ? 'Активно' : 'Черновик'}
                </span>
              </div>
              {consultation.shortDescription && (
                <p className="text-sm text-neutral-600 dark:text-slate-400 line-clamp-2 mb-3">
                  {consultation.shortDescription}
                </p>
              )}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1 text-neutral-600 dark:text-slate-400">
                  <DollarSign size={14} />
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {consultation.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex items-center gap-1 text-neutral-600 dark:text-slate-400">
                  <Clock size={14} />
                  <span>{consultation.duration} мин</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onToggleStatus(consultation.id)}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 transition-colors"
                title={consultation.status === 'active' ? 'Скрыть' : 'Показать'}
                aria-label={consultation.status === 'active' ? 'Скрыть консультацию' : 'Опубликовать консультацию'}
              >
                {consultation.status === 'active' ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <Link
                to={`/admin/consultations/${consultation.id}`}
                className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-neutral-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                aria-label="Редактировать консультацию"
              >
                <Edit size={18} />
              </Link>
              <button
                onClick={() => onDelete(consultation.id)}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Удалить консультацию"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
