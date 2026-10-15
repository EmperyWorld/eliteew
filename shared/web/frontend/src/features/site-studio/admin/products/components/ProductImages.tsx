import { GalleryImagePickerModal } from '@/features/site-studio/admin/components/GalleryImagePickerModal';
import { getUploadedImageUrl } from '@/features/site-studio/shared/utils/imageUrl';
import * as React from 'react';
import { useRef, useState } from 'react';
import {
	ArrowUpTrayIcon,
	Bars2Icon,
	MagnifyingGlassPlusIcon,
	PhotoIcon,
	StarIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

interface ProductImagesProps {
	images: string[];
	onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemove: (index: number) => void;
	onAddFromGallery?: (url: string) => void;
}

export const ProductImages: React.FC<ProductImagesProps> = ({
	images,
	onUpload,
	onRemove,
	onAddFromGallery,
}) => {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [isDragging, setIsDragging] = useState(false);
	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => {
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		// Handle dropped files - convert to change event format
		const files = e.dataTransfer.files;
		if (files.length > 0 && fileInputRef.current) {
			const dataTransfer = new DataTransfer();
			for (const file of Array.from(files)) {
				dataTransfer.items.add(file);
			}
			fileInputRef.current.files = dataTransfer.files;
			fileInputRef.current.dispatchEvent(
				new Event('change', { bubbles: true })
			);
		}
	};

	return (
		<>
			<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
				{/* Header */}
				<div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
					<h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
						<PhotoIcon width={18} height={18} className="text-blue-500" />
						Изображения
					</h2>
					<p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
						Загрузите фотографии товара
					</p>
				</div>

				{/* Content */}
				<div className="p-6 space-y-6">
					{/* ArrowUpTrayIcon area */}
					<section
						aria-label="Зона загрузки изображений"
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center transition-[color,background-color,border-color,transform] duration-200 motion-reduce:transition-none
              ${
								isDragging
									? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02] motion-reduce:scale-100'
									: 'border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-neutral-50 dark:hover:bg-slate-900/50'
							}
            `}
					>
						<div
							className={`
              w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-[color,background-color] duration-200 motion-reduce:transition-none
              ${
								isDragging
									? 'bg-primary-100 dark:bg-primary-900/40'
									: 'bg-neutral-100 dark:bg-slate-700'
							}
            `}
						>
							<ArrowUpTrayIcon
								className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary-500' : 'text-neutral-400 dark:text-slate-500'}`}
							/>
						</div>
						<p className="text-sm text-neutral-600 dark:text-slate-400">
							{onAddFromGallery && (
								<>
									<button
										type="button"
										onClick={() => setGalleryPickerOpen(true)}
										className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium underline inline-flex items-center gap-1.5 mr-1"
									>
										<PhotoIcon width={16} height={16} className="inline" />
										Выбрать из галереи
									</button>
									{' · '}
								</>
							)}
							Перетащите изображения сюда или{' '}
							<label className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer font-medium">
								выберите файлы
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									multiple
									className="hidden"
									onChange={onUpload}
								/>
							</label>
						</p>
						<p className="text-xs text-neutral-400 dark:text-slate-500 mt-2">
							PNG, JPG, WebP до 5MB. Рекомендуемый размер: 800×800px
						</p>
					</section>

					{/* PhotoIcon grid */}
					{images.length > 0 && (
						<div className="space-y-3">
							<div className="flex items-center justify-between flex-wrap gap-2">
								<p className="text-sm font-medium text-neutral-700 dark:text-slate-300">
									Загружено: {images.length} изображени
									{images.length === 1 ? 'е' : images.length < 5 ? 'я' : 'й'}
								</p>
								<div className="flex items-center gap-2">
									{onAddFromGallery && (
										<button
											type="button"
											onClick={() => setGalleryPickerOpen(true)}
											className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
										>
											<PhotoIcon width={14} height={14} />
											Добавить из галереи
										</button>
									)}
									<p className="text-xs text-neutral-400 dark:text-slate-500">
										Первое изображение — главное
									</p>
								</div>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
								{images.map((image, index) => (
									<div
										key={image}
										className={`
                      group relative aspect-square rounded-xl overflow-hidden
                      ${
												index === 0
													? 'ring-2 ring-primary-500 dark:ring-primary-400 ring-offset-2 dark:ring-offset-slate-800'
													: 'border border-neutral-200 dark:border-slate-700'
											}
                    `}
									>
										<img
											src={getUploadedImageUrl(image)}
											alt={`Product ${index + 1}`}
											className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
										/>

										{/* Overlay */}
										<div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
											<button
												type="button"
												onClick={() =>
													setPreviewImage(getUploadedImageUrl(image))
												}
												className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg text-neutral-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-[color,background-color,transform] duration-200 motion-reduce:transition-none hover:scale-110 motion-reduce:hover:scale-100"
												aria-label="Просмотреть"
											>
												<MagnifyingGlassPlusIcon width={18} height={18} />
											</button>
											<button
												type="button"
												onClick={() => onRemove(index)}
												className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg text-red-500 hover:bg-white dark:hover:bg-slate-700 transition-[color,background-color,transform] duration-200 motion-reduce:transition-none hover:scale-110 motion-reduce:hover:scale-100"
												aria-label="Удалить изображение"
											>
												<TrashIcon width={18} height={18} />
											</button>
										</div>

										{/* Main badge */}
										{index === 0 && (
											<div className="absolute top-2 left-2 px-2 py-1 bg-primary-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-lg">
												<StarIcon width={12} height={12} fill="currentColor" />{' '}
												Главное
											</div>
										)}

										{/* Index badge */}
										<div className="absolute bottom-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded-lg flex items-center justify-center">
											{index + 1}
										</div>

										{/* Drag handle */}
										<div className="absolute top-2 right-2 p-1 bg-white/80 dark:bg-slate-800/80 rounded-lg text-neutral-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity">
											<Bars2Icon width={14} height={14} />
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			<GalleryImagePickerModal
				open={galleryPickerOpen}
				onClose={() => setGalleryPickerOpen(false)}
				onSelect={(url) => onAddFromGallery?.(url)}
				title="Выбрать изображение товара из галереи"
			/>

			{/* Image Preview Modal */}
			{previewImage && (
				<div
					className="fixed inset-0 flex items-center justify-center p-4"
					style={{ zIndex: embeddedModalZ.backdrop }}
				>
					<button
						type="button"
						className="absolute inset-0 border-0 bg-black/80 backdrop-blur-sm animate-in fade-in p-0 cursor-default"
						onClick={() => setPreviewImage(null)}
						aria-label="Закрыть просмотр"
					/>
					<div
						className="relative max-w-4xl max-h-[90vh]"
						style={{ zIndex: embeddedModalZ.content }}
					>
						<img
							src={getUploadedImageUrl(previewImage)}
							alt="Preview"
							className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
						/>
						<button
							type="button"
							onClick={() => setPreviewImage(null)}
							aria-label="Закрыть просмотр изображения"
							title="Закрыть"
							className="absolute -top-3 -right-3 p-2 bg-white dark:bg-slate-800 rounded-full text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white shadow-lg transition-colors"
						>
							<XMarkIcon width={20} height={20} aria-hidden />
						</button>
					</div>
				</div>
			)}
		</>
	);
};
