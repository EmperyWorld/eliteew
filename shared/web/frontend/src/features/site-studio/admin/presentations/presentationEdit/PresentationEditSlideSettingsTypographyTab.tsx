/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typography settings tab for a presentation slide (sizes, alignment, line height).
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type { PresentationEditSlideSettingsTabBaseProps } from './presentationEditSlideSettingsTypes';

export type PresentationEditSlideSettingsTypographyTabProps =
	PresentationEditSlideSettingsTabBaseProps;

export function PresentationEditSlideSettingsTypographyTab({
	slide,
	slideIndex,
	onSlideChange,
}: PresentationEditSlideSettingsTypographyTabProps) {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label
						htmlFor={`slide-${slide.id}-title-font-size`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Размер заголовка
					</label>
					<select
						id={`slide-${slide.id}-title-font-size`}
						value={slide.titleFontSize || '2.5em'}
						onChange={(e) =>
							onSlideChange(slideIndex, 'titleFontSize', e.target.value)
						}
						aria-label="Размер заголовка"
						className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
					>
						<option value="1.5em">Маленький</option>
						<option value="2em">Средний</option>
						<option value="2.5em">Большой</option>
						<option value="3em">Очень большой</option>
						<option value="4em">Огромный</option>
					</select>
				</div>
				<div>
					<label
						htmlFor={`slide-${slide.id}-content-font-size`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Размер текста
					</label>
					<select
						id={`slide-${slide.id}-content-font-size`}
						value={slide.contentFontSize || '1.1em'}
						onChange={(e) =>
							onSlideChange(slideIndex, 'contentFontSize', e.target.value)
						}
						aria-label="Размер текста"
						className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
					>
						<option value="0.9em">Маленький</option>
						<option value="1em">Обычный</option>
						<option value="1.1em">Средний</option>
						<option value="1.3em">Большой</option>
						<option value="1.5em">Очень большой</option>
					</select>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div>
					<label
						htmlFor={`slide-${slide.id}-title-align`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Выравнивание заголовка
					</label>
					<select
						id={`slide-${slide.id}-title-align`}
						value={slide.titleAlign || 'center'}
						onChange={(e) =>
							onSlideChange(
								slideIndex,
								'titleAlign',
								e.target.value as 'left' | 'center' | 'right'
							)
						}
						aria-label="Выравнивание заголовка"
						className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
					>
						<option value="left">Слева</option>
						<option value="center">По центру</option>
						<option value="right">Справа</option>
					</select>
				</div>
				<div>
					<label
						htmlFor={`slide-${slide.id}-text-align`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Выравнивание текста
					</label>
					<select
						id={`slide-${slide.id}-text-align`}
						value={slide.textAlign || 'left'}
						onChange={(e) =>
							onSlideChange(
								slideIndex,
								'textAlign',
								e.target.value as 'left' | 'center' | 'right' | 'justify'
							)
						}
						aria-label="Выравнивание текста"
						className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
					>
						<option value="left">Слева</option>
						<option value="center">По центру</option>
						<option value="right">Справа</option>
						<option value="justify">По ширине</option>
					</select>
				</div>
			</div>
			<div>
				<label
					htmlFor={`slide-${slide.id}-line-height`}
					className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
				>
					Межстрочный интервал
				</label>
				<select
					id={`slide-${slide.id}-line-height`}
					value={slide.lineHeight || '1.6'}
					onChange={(e) =>
						onSlideChange(slideIndex, 'lineHeight', e.target.value)
					}
					aria-label="Межстрочный интервал"
					className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
				>
					<option value="1.2">Плотный</option>
					<option value="1.4">Компактный</option>
					<option value="1.6">Обычный</option>
					<option value="1.8">Просторный</option>
					<option value="2">Очень просторный</option>
				</select>
			</div>
		</div>
	);
}
