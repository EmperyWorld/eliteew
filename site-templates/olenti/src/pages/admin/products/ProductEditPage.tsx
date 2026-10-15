import { Loader2 } from 'lucide-react'
import React from 'react'
import { ProductBasicInfo } from './components/ProductBasicInfo'
import { ProductImages } from './components/ProductImages'
import { ProductPublishing } from './components/ProductPublishing'
import { ProductVariants } from './components/ProductVariants'
import { PRODUCT_COLLECTION_LABELS } from '@constants/productCollections'
import { useProductEdit } from './hooks/useProductEdit'

const collectionLabels = PRODUCT_COLLECTION_LABELS

const categoryLabels: Record<string, string> = {
  perfumes: 'Каталог',
  ingredients: 'Ингредиенты',
  accessories: 'Аксессуары',
}

export const ProductEditPage: React.FC = () => {
  const {
    isNew,
    formData,
    isSaving,
    isLoading,
    handleChange,
    generateSlug,
    addVariant,
    updateVariant,
    removeVariant,
    handleSubmit,
    handleImageUpload,
    navigate
  } = useProductEdit()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        </div>
        <p className="text-neutral-500 dark:text-slate-400 text-sm">Загрузка товара...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <ProductBasicInfo
            isNew={isNew}
            name={formData.name}
            slug={formData.slug}
            collection={formData.collection}
            category={formData.category}
            description={formData.description}
            collectionLabels={collectionLabels}
            categoryLabels={categoryLabels}
            onBack={() => navigate('/admin/products')}
            onChange={(field, value) => handleChange(field as keyof typeof formData, value)}
            onGenerateSlug={generateSlug}
          />

          <ProductVariants
            variants={formData.variants}
            onAdd={addVariant}
            onUpdate={updateVariant}
            onRemove={removeVariant}
          />

          <ProductImages
            images={formData.images}
            onUpload={handleImageUpload}
            onRemove={(index) => handleChange('images', formData.images.filter((_, i) => i !== index))}
            onAddFromGallery={(url) => handleChange('images', [...formData.images, url])}
          />
        </div>

        {/* Sidebar - 1 column */}
        <div className="lg:col-span-1">
          <ProductPublishing
            inStock={formData.inStock}
            stockQuantity={formData.stockQuantity}
            isNew={formData.isNew}
            isFeatured={formData.isFeatured}
            order={formData.order}
            isSaving={isSaving}
            hasVariants={formData.variants.length > 0}
            onChange={(field, value) => handleChange(field as keyof typeof formData, value)}
            onCancel={() => navigate('/admin/products')}
          />
        </div>
      </div>
    </form>
  )
}
