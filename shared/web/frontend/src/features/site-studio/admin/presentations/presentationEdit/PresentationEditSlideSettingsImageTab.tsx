/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Image settings tab for a presentation slide (upload, remove, position, size).
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import { Button } from '@components/atoms/Button';
import { getUploadedImageUrl } from '@utils/imageUrl';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PresentationEditSlideSettingsTabBaseProps } from './presentationEditSlideSettingsTypes';

export type PresentationEditSlideSettingsImageTabProps =
	PresentationEditSlideSettingsTabBaseProps & {
		uploadingImageIndex: number | null;
		removeImageModalTitle: string;
		onImageUpload: (index: number, file: File) => void;
		onRequestRemoveImage: () => void;
	};

export function PresentationEditSlideSettingsImageTab({
	slide,
	slideIndex,
	onSlideChange,
	uploadingImageIndex,
	removeImageModalTitle,
	onImageUpload,
	onRequestRemoveImage,
}: PresentationEditSlideSettingsImageTabProps) {
	return (
		<div className="space-y-4">
			<div>
				<p className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
					Изображение
				</p>
			</div>
			{slide.image ? (
				<div className="relative group">
					<img
						src={getUploadedImageUrl(slide.image)}
						alt="Slide"
						className="w-full h-64 object-cover rounded-xl mb-2"
						onError={(e) => {
							console.error('Failed to load image:', slide.image);
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={onRequestRemoveImage}
						className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 opacity-0 group-hover:opacity-100 transition-opacity"
						title={removeImageModalTitle}
					>
						<XMarkIcon width={16} height={16} />
					</Button>
				</div>
			) : (
				<div className="border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl p-8 text-center">
					<input
						type="file"
						accept="image/*"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) onImageUpload(slideIndex, file);
							e.target.value = '';
						}}
						className="hidden"
						id={`slide-image-${slideIndex}`}
						disabled={uploadingImageIndex === slideIndex}
					/>
					<label
						htmlFor={`slide-image-${slideIndex}`}
						className={`cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ${
							uploadingImageIndex === slideIndex
								? 'opacity-50 cursor-not-allowed'
								: ''
						}`}
					>
						{uploadingImageIndex === slideIndex ? (
							<div className="flex flex-col items-center gap-2">
								<ArrowPathIcon className="w-6 h-6 animate-spin text-primary-500" />
								<span>Загрузка изображения...</span>
							</div>
						) : (
							'Нажмите для загрузки изображения'
						)}
					</label>
				</div>
			)}

			<div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label
							htmlFor={`slide-${slide.id}-image-position`}
							className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
						>
							Позиция изображения
						</label>
						<select
							id={`slide-${slide.id}-image-position`}
							value={slide.imagePosition || 'center'}
							onChange={(e) =>
								onSlideChange(
									slideIndex,
									'imagePosition',
									e.target.value as 'top' | 'center' | 'bottom'
								)
							}
							aria-label="Позиция изображения"
							className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
						>
							<option value="top">Сверху</option>
							<option value="center">По центру</option>
							<option value="bottom">Снизу</option>
						</select>
					</div>
					<div>
						<label
							htmlFor={`slide-${slide.id}-image-size`}
							className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
						>
							Размер изображения
						</label>
						<select
							id={`slide-${slide.id}-image-size`}
							value={slide.imageSize || 'medium'}
							onChange={(e) =>
								onSlideChange(
									slideIndex,
									'imageSize',
									e.target.value as 'small' | 'medium' | 'large' | 'full'
								)
							}
							aria-label="Размер изображения"
							className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
						>
							<option value="small">Маленький</option>
							<option value="medium">Средний</option>
							<option value="large">Большой</option>
							<option value="full">Полный</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	);
}
