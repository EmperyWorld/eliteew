import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Loader2, GraduationCap, Sparkles } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'
import type { MasterclassCategory } from '@typings/admin'
import { useMasterclasses } from './hooks/useMasterclasses'
import { MasterclassListCard } from './components/MasterclassListCard'

const categoryLabels: Record<MasterclassCategory, string> = {
  workshop: 'Мастер-класс',
  tasting: 'Дегустация',
  education: 'Обучение',
  corporate: 'Корпоратив',
  special: 'Особый формат',
}

const categoryColors: Record<MasterclassCategory, string> = {
  workshop: 'bg-blue-100 text-blue-700 border-blue-200',
  tasting: 'bg-amber-100 text-amber-700 border-amber-200',
  education: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  corporate: 'bg-purple-100 text-purple-700 border-purple-200',
  special: 'bg-pink-100 text-pink-700 border-pink-200',
}

export const MasterclassesListPage: React.FC = () => {
  const { masterclasses, loading, toggleStatus, deleteMasterclass } = useMasterclasses()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<MasterclassCategory | 'all'>('all')

  const filteredMasterclasses = masterclasses.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const activeCount = masterclasses.filter(m => m.status === 'active').length

  if (loading && masterclasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        <p className="text-neutral-500 text-sm">Загрузка мастер-классов...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <GraduationCap className="text-blue-600" size={24} />
            </div>
            Мастер-классы
          </h1>
          <p className="text-neutral-500 mt-1">
            {masterclasses.length} событий • {activeCount} активных
          </p>
        </div>
        <Link to="/admin/masterclasses/new">
          <Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
            <Plus size={18} className="mr-2" />
            Создать мастер-класс
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию мастер-класса..."
              className="pl-11 bg-neutral-50 border-neutral-200 focus:bg-white"
              aria-label="Поиск по названию"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                categoryFilter === 'all'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Все
            </button>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setCategoryFilter(value as MasterclassCategory)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  categoryFilter === value
                    ? categoryColors[value as MasterclassCategory]
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Masterclasses List */}
      <div className="space-y-4">
        {filteredMasterclasses.map((masterclass) => (
          <MasterclassListCard
            key={masterclass.id}
            masterclass={masterclass}
            categoryLabels={categoryLabels}
            onToggleStatus={toggleStatus}
            onDelete={deleteMasterclass}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredMasterclasses.length === 0 && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {searchQuery || categoryFilter !== 'all' ? 'Ничего не найдено' : 'Нет мастер-классов'}
          </h3>
          <p className="text-neutral-500 mb-4">
            {searchQuery
              ? `По запросу "${searchQuery}" мастер-классы не найдены`
              : categoryFilter !== 'all'
                ? `Нет мастер-классов в категории "${categoryLabels[categoryFilter as MasterclassCategory]}"`
                : 'Создайте первый мастер-класс для начала работы'
            }
          </p>
          {!searchQuery && categoryFilter === 'all' && (
            <Link to="/admin/masterclasses/new">
              <Button>
                <Plus size={18} className="mr-2" />
                Создать мастер-класс
              </Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  )
}
