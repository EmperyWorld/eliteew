import React from 'react'
import { MasterclassBasicInfo } from './components/MasterclassBasicInfo'
import { MasterclassImage } from './components/MasterclassImage'
import { MasterclassParams } from './components/MasterclassParams'
import { MasterclassPublishing } from './components/MasterclassPublishing'
import { useMasterclassEdit } from './hooks/useMasterclassEdit'
import type { MasterclassCategory } from '@typings/admin'

const categoryLabels: Record<MasterclassCategory, string> = {
  workshop: 'Мастер-класс',
  tasting: 'Дегустация',
  education: 'Обучение',
  corporate: 'Корпоратив',
  special: 'Особый формат',
}

const levelLabels = {
  beginner: 'Начальный',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
  all: 'Для всех',
}

export const MasterclassEditPage: React.FC = () => {
  const {
    isNew,
    formData,
    isSaving,
    handleChange,
    generateSlug,
    handleSubmit,
    handleImageUpload,
    navigate
  } = useMasterclassEdit()

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        <MasterclassBasicInfo
          isNew={isNew}
          title={formData.title}
          slug={formData.slug}
          category={formData.category}
          level={formData.level}
          shortDescription={formData.shortDescription}
          description={formData.description}
          categoryLabels={categoryLabels}
          levelLabels={levelLabels}
          onBack={() => navigate('/admin/masterclasses')}
          onChange={handleChange as (field: string, value: string) => void}
          onGenerateSlug={generateSlug}
        />

        <MasterclassImage
          image={formData.image}
          onChange={(value) => handleChange('image', value)}
          onUpload={handleImageUpload}
        />
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <MasterclassPublishing
          status={formData.status}
          isSaving={isSaving}
          onChange={(value) => handleChange('status', value)}
          onCancel={() => navigate('/admin/masterclasses')}
        />

        <MasterclassParams
          price={formData.price}
          priceNote={formData.priceNote || ''}
          duration={formData.duration}
          minParticipants={formData.minParticipants}
          maxParticipants={formData.maxParticipants}
          order={formData.order}
          onChange={handleChange as (field: string, value: number | string | undefined) => void}
        />
      </div>
    </form>
  )
}
