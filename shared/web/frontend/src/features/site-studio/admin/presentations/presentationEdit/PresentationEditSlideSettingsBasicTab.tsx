/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Basic settings tab for a presentation slide (layout, title, content, transition, templates).
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/presentationEditorPresets.ts
 */

import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Textarea } from '@components/atoms/Textarea';
import type { PresentationSlide } from '@services/api/presentations';
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import {
	type SlideTemplate,
	slideTemplates,
} from './presentationEditorPresets';
import type { PresentationEditSlideSettingsTabBaseProps } from './presentationEditSlideSettingsTypes';

export type PresentationEditSlideSettingsBasicTabProps =
	PresentationEditSlideSettingsTabBaseProps & {
		copiedStyle: Partial<PresentationSlide> | null;
		onApplyTemplate: (template: SlideTemplate) => void;
		onCopyStyle: () => void;
		onPasteStyle: () => void;
	};

export function PresentationEditSlideSettingsBasicTab({
	slide,
	slideIndex,
	onSlideChange,
	copiedStyle,
	onApplyTemplate,
	onCopyStyle,
	onPasteStyle,
}: PresentationEditSlideSettingsBasicTabProps) {
	return (
		<>
			<div>
				<label
					htmlFor={`slide-${slide.id}-layout`}
					className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
				>
					Макет слайда
				</label>
				<select
					id={`slide-${slide.id}-layout`}
					value={slide.layout}
					onChange={(e) => onSlideChange(slideIndex, 'layout', e.target.value)}
					aria-label="Макет слайда"
					className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
				>
					<option value="title-content">Заголовок + Текст</option>
					<option value="image-content">Изображение + Текст</option>
					<option value="title-image-content">
						Заголовок + Изображение + Текст
					</option>
					<option value="full-image">Полноэкранное изображение</option>
				</select>
			</div>

			{slide.layout !== 'full-image' && (
				<div>
					<label
						htmlFor={`slide-${slide.id}-slide-title`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Заголовок
					</label>
					<Input
						id={`slide-${slide.id}-slide-title`}
						value={slide.title || ''}
						onChange={(e) => onSlideChange(slideIndex, 'title', e.target.value)}
						placeholder="Введите заголовок слайда"
					/>
				</div>
			)}

			{(slide.layout === 'title-content' ||
				slide.layout === 'title-image-content' ||
				slide.layout === 'image-content') && (
				<div>
					<label
						htmlFor={`slide-${slide.id}-content`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Текст
					</label>
					<Textarea
						id={`slide-${slide.id}-content`}
						value={slide.content || ''}
						onChange={(e) =>
							onSlideChange(slideIndex, 'content', e.target.value)
						}
						placeholder="Введите текст слайда"
						rows={6}
					/>
				</div>
			)}

			<div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
				<label
					htmlFor={`slide-${slide.id}-transition`}
					className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
				>
					Переход между слайдами
				</label>
				<select
					id={`slide-${slide.id}-transition`}
					value={slide.transition || 'slide'}
					onChange={(e) =>
						onSlideChange(
							slideIndex,
							'transition',
							e.target.value as
								| 'none'
								| 'fade'
								| 'slide'
								| 'zoom'
								| 'convex'
								| 'concave'
						)
					}
					aria-label="Переход между слайдами"
					className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
				>
					<option value="none">Без перехода</option>
					<option value="fade">Плавное затухание</option>
					<option value="slide">Слайд</option>
					<option value="zoom">Масштабирование</option>
					<option value="convex">Выпуклый</option>
					<option value="concave">Вогнутый</option>
				</select>
			</div>

			<div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
				<p className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
					Шаблоны слайдов
				</p>
				<div className="grid grid-cols-3 gap-2">
					{slideTemplates.map((template) => (
						<button
							key={template.name}
							type="button"
							onClick={() => onApplyTemplate(template)}
							className="p-3 rounded-lg border border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-sm"
						>
							{template.name}
						</button>
					))}
				</div>
			</div>

			<div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-slate-700">
				<Button
					variant="outline"
					size="sm"
					type="button"
					onClick={onCopyStyle}
					className="flex-1"
				>
					<DocumentDuplicateIcon width={14} height={14} className="mr-1" />
					Копировать стиль
				</Button>
				<Button
					variant="outline"
					size="sm"
					type="button"
					onClick={onPasteStyle}
					disabled={!copiedStyle}
					className="flex-1"
				>
					Вставить стиль
				</Button>
			</div>
		</>
	);
}
