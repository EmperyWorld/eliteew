import React from 'react'
import { Loader2 } from 'lucide-react'
import { ConsultationBasicInfo } from './components/ConsultationBasicInfo'
import { ConsultationImage } from './components/ConsultationImage'
import { ConsultationParams } from './components/ConsultationParams'
import { ConsultationPublishing } from './components/ConsultationPublishing'
import { useConsultationEdit } from './hooks/useConsultationEdit'

export const ConsultationEditPage: React.FC = () => {
  const {
    isNew,
    formData,
    isSaving,
    isLoading,
    handleChange,
    generateSlug,
    handleSubmit,
    handleImageUpload,
    navigate
  } = useConsultationEdit()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        </div>
        <p className="text-neutral-500 dark:text-slate-400 text-sm">Загрузка консультации...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <ConsultationBasicInfo
            isNew={isNew}
            title={formData.title}
            slug={formData.slug}
            shortDescription={formData.shortDescription}
            description={formData.description}
            onBack={() => navigate('/admin/consultations')}
            onChange={handleChange as (field: string, value: string) => void}
            onGenerateSlug={generateSlug}
          />

          <ConsultationImage
            image={formData.image}
            onChange={(value) => handleChange('image', value)}
            onUpload={handleImageUpload}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-24 space-y-6">
            <ConsultationPublishing
              status={formData.status}
              popular={formData.popular}
              isSaving={isSaving}
              onChange={handleChange as (field: string, value: string | boolean) => void}
              onCancel={() => navigate('/admin/consultations')}
            />

            <ConsultationParams
              price={formData.price}
              duration={formData.duration}
              order={formData.order}
              onChange={handleChange as (field: string, value: number) => void}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
