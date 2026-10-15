import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ProductBasicInfo } from './components/ProductBasicInfo';
import { ProductImages } from './components/ProductImages';
import { ProductPublishing } from './components/ProductPublishing';
import { ProductVariants } from './components/ProductVariants';
import { useProductEdit } from './hooks/useProductEdit';
import { PRODUCT_COLLECTION_LABELS } from '@/features/site-studio/shared/constants/productCollections';

const collectionLabels = PRODUCT_COLLECTION_LABELS;

const categoryLabels: Record<string, string> = {
	perfumes: 'Каталог',
	ingredients: 'Ингредиенты',
	accessories: 'Аксессуары',
};

export const ProductEditPage: React.FC = () => {
	const {
		isNew,
		formData,
		isSaving,
		isLoading,
		fieldErrors,
		handleChange,
		generateSlug,
		addVariant,
		updateVariant,
		removeVariant,
		handleSubmit,
		handleImageUpload,
		navigate,
	} = useProductEdit();

	const editSteps = [
		{
			id: 'product-edit-step-basic',
			label: 'Основное',
			hint: 'Название, коллекция, описание',
		},
		{
			id: 'product-edit-step-variants',
			label: 'Варианты',
			hint: 'Объёмы, цены, остатки',
		},
		{
			id: 'product-edit-step-images',
			label: 'Изображения',
			hint: 'Фото и галерея',
		},
		{
			id: 'product-edit-step-publish',
			label: 'Публикация',
			hint: 'Наличие, витрина, сортировка',
		},
	] as const;

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-[60vh] gap-4">
				<div className="relative">
					<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
						<ArrowPathIcon className="w-8 h-8 animate-spin text-primary-500" />
					</div>
				</div>
				<p className="text-neutral-500 dark:text-slate-400 text-sm">
					Загрузка товара...
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="pb-12">
			<nav
				className="mb-6 rounded-2xl border border-neutral-200/80 bg-white/90 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90"
				aria-label="Шаги заполнения карточки товара"
			>
				<p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
					Порядок работы
				</p>
				<ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
					{editSteps.map((step, index) => (
						<li key={step.id} className="min-w-0 flex-1 sm:flex-initial">
							<a
								href={`#${step.id}`}
								className={clsx(
									'flex min-h-11 flex-col justify-center rounded-xl border px-3 py-2 text-left text-sm transition-colors',
									'border-neutral-200 bg-neutral-50/80 hover:border-primary-300 hover:bg-primary-50/50',
									'dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-primary-600 dark:hover:bg-primary-950/30',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900'
								)}
							>
								<span className="font-semibold text-neutral-900 dark:text-white">
									<span className="text-primary-600 dark:text-primary-400">
										{index + 1}.
									</span>{' '}
									{step.label}
								</span>
								<span className="text-xs text-neutral-500 dark:text-slate-400">
									{step.hint}
								</span>
							</a>
						</li>
					))}
				</ol>
			</nav>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main content - 2 columns */}
				<div className="lg:col-span-2 space-y-6">
					<div id="product-edit-step-basic" className="scroll-mt-28">
						<ProductBasicInfo
							isNew={isNew}
							name={formData.name}
							slug={formData.slug}
							collection={formData.collection}
							category={formData.category}
							description={formData.description}
							collectionLabels={collectionLabels}
							categoryLabels={categoryLabels}
							fieldErrors={fieldErrors}
							onBack={() => navigate('/admin/products')}
							onChange={(field, value) =>
								handleChange(field as keyof typeof formData, value)
							}
							onGenerateSlug={generateSlug}
						/>
					</div>

					<div id="product-edit-step-variants" className="scroll-mt-28">
						<ProductVariants
							variants={formData.variants}
							onAdd={addVariant}
							onUpdate={updateVariant}
							onRemove={removeVariant}
						/>
					</div>

					<div id="product-edit-step-images" className="scroll-mt-28">
						<ProductImages
							images={formData.images}
							onUpload={handleImageUpload}
							onRemove={(index) =>
								handleChange(
									'images',
									formData.images.filter((_, i) => i !== index)
								)
							}
							onAddFromGallery={(url) =>
								handleChange('images', [...formData.images, url])
							}
						/>
					</div>
				</div>

				{/* Sidebar - 1 column */}
				<div className="lg:col-span-1">
					<div id="product-edit-step-publish" className="scroll-mt-28">
						<ProductPublishing
							inStock={formData.inStock}
							stockQuantity={formData.stockQuantity}
							isNew={formData.isNew}
							isFeatured={formData.isFeatured}
							order={formData.order}
							isSaving={isSaving}
							hasVariants={formData.variants.length > 0}
							onChange={(field, value) =>
								handleChange(field as keyof typeof formData, value)
							}
							onCancel={() => navigate('/admin/products')}
						/>
					</div>
				</div>
			</div>
		</form>
	);
};
