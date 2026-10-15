import { Button } from '@components/atoms/Button';
import { Card } from '@components/atoms/Card';
import { apiClient } from '@services/api/client';
import {
	useCreateGalleryImage,
	useDeleteGalleryImage,
	useGalleryImages,
	useUpdateGalleryImage,
} from '@services/api/gallery';
import React, { useMemo, useState } from 'react';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	PhotoIcon,
	PlusIcon,
} from '@heroicons/react/24/outline';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { getUploadedImageUrl } from '@utils/imageUrl';
import { toErrorText } from '@/utils/toErrorText';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { GalleryImageItem } from './components/GalleryImageItem';

const categories = {
	brand: 'Бренд / О бренде',
	consultations: 'Консультации',
	masterclasses: 'Мастер-классы',
	diplomas: 'Дипломы и сертификаты',
	products: 'Продукция',
	founder: 'Основатель / Портрет (legacy)',
	workshop: 'Мастер-классы (legacy)',
	certificates: 'Дипломы и сертификаты (legacy)',
};

export const GalleryPage: React.FC = () => {
	const [selectedCategory, setSelectedCategory] = useState<
		keyof typeof categories | 'all'
	>('all');
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const { data: images = [], isLoading } = useGalleryImages();
	const createMutation = useCreateGalleryImage();
	const updateMutation = useUpdateGalleryImage();
	const deleteMutation = useDeleteGalleryImage();

	const filteredImages = images.filter(
		(img) => selectedCategory === 'all' || img.category === selectedCategory
	);

	const handleUpload = async (files: FileList | null) => {
		if (!files) return;
		setIsUploading(true);
		setUploadError(null);

		try {
			for (const file of Array.from(files)) {
				// ArrowUpTrayIcon file first
				const formData = new FormData();
				formData.append('image', file);

				const { data: uploadResult } = await apiClient.post<{ url: string }>(
					'/admin/upload',
					formData,
					{
						headers: { 'Content-Type': 'multipart/form-data' },
					}
				);

				// Create gallery image record
				await createMutation.mutateAsync({
					url: uploadResult.url,
					alt: file.name.replace(/\.[^/.]+$/, ''),
					category: selectedCategory === 'all' ? 'diplomas' : selectedCategory,
					order: images.length + 1,
				});
			}
		} catch (error: unknown) {
			console.error('ArrowUpTrayIcon failed:', error);
			setUploadError(toErrorText(error));
		} finally {
			setIsUploading(false);
		}
	};

	const pendingDeleteImage = useMemo(
		() =>
			pendingDeleteId
				? images.find((i) => i.id === pendingDeleteId)
				: undefined,
		[images, pendingDeleteId]
	);

	const requestDeleteImage = (id: string) => {
		setPendingDeleteId(id);
	};

	const updateImageAlt = (id: string, alt: string) => {
		updateMutation.mutate({ id, alt });
	};

	const updateImageCategory = (id: string, category: string) => {
		updateMutation.mutate({ id, category });
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{uploadError ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
				>
					<span>{uploadError}</span>
					<button
						type="button"
						onClick={() => setUploadError(null)}
						className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-950/60 dark:text-red-100 dark:hover:bg-red-900/50"
					>
						Закрыть
					</button>
				</div>
			) : null}

			<AdminPageHeader
				eyebrow="Контент"
				title="Галерея"
				titleIcon={
					<PhotoIcon
						className="text-primary-600 dark:text-primary-400"
						width={24}
						height={24}
					/>
				}
				description="Управление изображениями сайта"
				actions={
					<label>
						<Button disabled={isUploading}>
							<PlusIcon width={20} height={20} className="mr-2" />
							{isUploading ? 'Загрузка...' : 'Загрузить'}
						</Button>
						<input
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={(e) => handleUpload(e.target.files)}
						/>
					</label>
				}
			/>

			{/* Category filter */}
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setSelectedCategory('all')}
					className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
						selectedCategory === 'all'
							? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
							: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
					}`}
				>
					Все ({images.length})
				</button>
				{Object.entries(categories).map(([key, label]) => {
					const count = images.filter((img) => img.category === key).length;
					return (
						<button
							type="button"
							key={key}
							onClick={() =>
								setSelectedCategory(key as keyof typeof categories)
							}
							className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
								selectedCategory === key
									? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
									: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
							}`}
						>
							{label} ({count})
						</button>
					);
				})}
			</div>

			{/* ArrowUpTrayIcon area */}
			<Card className="p-8">
				<section
					aria-label="Загрузка изображений перетаскиванием"
					className="border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-primary-300 dark:hover:border-primary-500 transition-colors"
					onDragOver={(e) => {
						e.preventDefault();
						e.currentTarget.classList.add(
							'border-primary-400',
							'bg-primary-50',
							'dark:border-primary-500',
							'dark:bg-primary-900/20'
						);
					}}
					onDragLeave={(e) => {
						e.currentTarget.classList.remove(
							'border-primary-400',
							'bg-primary-50',
							'dark:border-primary-500',
							'dark:bg-primary-900/20'
						);
					}}
					onDrop={(e) => {
						e.preventDefault();
						e.currentTarget.classList.remove(
							'border-primary-400',
							'bg-primary-50',
							'dark:border-primary-500',
							'dark:bg-primary-900/20'
						);
						handleUpload(e.dataTransfer.files);
					}}
				>
					<ArrowUpTrayIcon className="mx-auto h-12 w-12 text-neutral-400 dark:text-slate-500" />
					<p className="mt-2 text-sm text-neutral-600 dark:text-slate-300">
						Перетащите изображения сюда или{' '}
						<label className="text-primary-600 hover:text-primary-700 cursor-pointer">
							выберите файлы
							<input
								type="file"
								accept="image/*"
								multiple
								className="hidden"
								onChange={(e) => handleUpload(e.target.files)}
							/>
						</label>
					</p>
					<p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">
						PNG, JPG до 5MB
					</p>
				</section>
			</Card>

			{/* Images grid */}
			{filteredImages.length > 0 ? (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{filteredImages.map((image) => (
						<GalleryImageItem
							key={image.id}
							image={image}
							categories={categories}
							onDelete={requestDeleteImage}
							onUpdateAlt={updateImageAlt}
							onUpdateCategory={updateImageCategory}
						/>
					))}
				</div>
			) : (
				<Card className="p-12 text-center">
					<PhotoIcon
						width={48}
						height={48}
						className="mx-auto text-neutral-300 dark:text-slate-600 mb-4"
					/>
					<p className="text-neutral-500 dark:text-slate-400">
						{selectedCategory === 'all'
							? 'Нет загруженных изображений'
							: `Нет изображений в категории "${categories[selectedCategory]}"`}
					</p>
				</Card>
			)}

			<ConfirmDeleteModal
				isOpen={pendingDeleteId !== null}
				onClose={() => setPendingDeleteId(null)}
				onConfirm={async () => {
					if (!pendingDeleteId) return;
					await deleteMutation.mutateAsync(pendingDeleteId);
				}}
				title="Удалить изображение?"
				warningMessage={
					pendingDeleteImage?.alt
						? `Будет удалено изображение «${pendingDeleteImage.alt}». Это действие нельзя отменить.`
						: 'Изображение будет удалено из галереи. Это действие нельзя отменить.'
				}
				itemPreview={
					pendingDeleteImage?.url ? (
						<img
							src={getUploadedImageUrl(pendingDeleteImage.url)}
							alt=""
							className="mx-auto max-h-40 rounded-lg object-contain"
						/>
					) : undefined
				}
				cancelButtonLabel="Отмена"
				confirmButtonLabel="Удалить"
				confirmButtonLoadingLabel="Удаление…"
			/>
		</div>
	);
};
