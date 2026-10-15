/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Color settings tab for a presentation slide (schemes, gradients, individual colors).
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/PresentationEditColorSchemePreviewButton.tsx
 */

import { Input } from '@components/atoms/Input';
import { useLayoutEffect, useRef } from 'react';
import { PresentationEditColorSchemePreviewButton } from './PresentationEditColorSchemePreviewButton';
import { assignDomCssVars } from './presentationDomCssVars';
import {
	type ColorScheme,
	backgroundGradients,
	colorSchemes,
} from './presentationEditorPresets';
import type { PresentationEditSlideSettingsTabBaseProps } from './presentationEditSlideSettingsTypes';

export type PresentationEditSlideSettingsColorsTabProps =
	PresentationEditSlideSettingsTabBaseProps & {
		onApplyColorScheme: (scheme: ColorScheme) => void;
	};

export function PresentationEditSlideSettingsColorsTab({
	slide,
	slideIndex,
	onSlideChange,
	onApplyColorScheme,
}: PresentationEditSlideSettingsColorsTabProps) {
	const slideGradientPreviewRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const el = slideGradientPreviewRef.current;
		const grad = slide.backgroundGradient;
		if (!el || !grad) return;
		assignDomCssVars(el, {
			'--gradient-value': grad,
		});
	}, [slide.backgroundGradient]);

	return (
		<div className="space-y-4">
			<div>
				<p className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
					Предустановленные схемы
				</p>
				<div className="grid grid-cols-3 gap-2">
					{colorSchemes.map((scheme) => (
						<PresentationEditColorSchemePreviewButton
							key={scheme.name}
							scheme={scheme}
							onApply={() => onApplyColorScheme(scheme)}
						/>
					))}
				</div>
			</div>

			<div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
				<label
					htmlFor={`slide-${slide.id}-bg-gradient`}
					className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
				>
					Градиент фона
				</label>
				<select
					id={`slide-${slide.id}-bg-gradient`}
					value={
						backgroundGradients.find(
							(g) => g.value === slide.backgroundGradient
						)?.name || 'Нет'
					}
					onChange={(e) => {
						const gradient = backgroundGradients.find(
							(g) => g.name === e.target.value
						);
						onSlideChange(slideIndex, 'backgroundGradient', gradient?.value);
					}}
					aria-label="Градиент фона"
					className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
				>
					{backgroundGradients.map((gradient) => (
						<option key={gradient.name} value={gradient.name}>
							{gradient.name}
						</option>
					))}
				</select>
				{slide.backgroundGradient && (
					<div
						ref={slideGradientPreviewRef}
						className="mt-2 h-12 rounded-lg border border-neutral-200 dark:border-slate-700 gradient-preview"
					/>
				)}
			</div>

			<div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
				<p className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-3">
					Индивидуальные настройки
				</p>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label
							htmlFor={`slide-${slide.id}-bg-color`}
							className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2"
						>
							Цвет фона
						</label>
						<div className="flex items-center gap-2">
							<input
								id={`slide-${slide.id}-bg-color`}
								type="color"
								value={slide.backgroundColor || '#ffffff'}
								onChange={(e) =>
									onSlideChange(slideIndex, 'backgroundColor', e.target.value)
								}
								aria-label="Цвет фона слайда"
								className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
							/>
							<Input
								value={slide.backgroundColor || '#ffffff'}
								onChange={(e) =>
									onSlideChange(slideIndex, 'backgroundColor', e.target.value)
								}
								placeholder="#ffffff"
								className="flex-1 text-xs"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor={`slide-${slide.id}-text-color`}
							className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2"
						>
							Цвет текста
						</label>
						<div className="flex items-center gap-2">
							<input
								id={`slide-${slide.id}-text-color`}
								type="color"
								value={slide.textColor || '#000000'}
								onChange={(e) =>
									onSlideChange(slideIndex, 'textColor', e.target.value)
								}
								aria-label="Цвет текста слайда"
								className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
							/>
							<Input
								value={slide.textColor || '#000000'}
								onChange={(e) =>
									onSlideChange(slideIndex, 'textColor', e.target.value)
								}
								placeholder="#000000"
								className="flex-1 text-xs"
							/>
						</div>
					</div>
					{slide.layout !== 'full-image' && (
						<>
							<div>
								<label
									htmlFor={`slide-${slide.id}-title-color`}
									className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2"
								>
									Цвет заголовка
								</label>
								<div className="flex items-center gap-2">
									<input
										id={`slide-${slide.id}-title-color`}
										type="color"
										value={slide.titleColor || slide.textColor || '#000000'}
										onChange={(e) =>
											onSlideChange(slideIndex, 'titleColor', e.target.value)
										}
										aria-label="Цвет заголовка слайда"
										className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
									/>
									<Input
										value={slide.titleColor || slide.textColor || '#000000'}
										onChange={(e) =>
											onSlideChange(slideIndex, 'titleColor', e.target.value)
										}
										placeholder="Авто"
										className="flex-1 text-xs"
									/>
								</div>
							</div>
							<div>
								<label
									htmlFor={`slide-${slide.id}-content-color`}
									className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2"
								>
									Цвет контента
								</label>
								<div className="flex items-center gap-2">
									<input
										id={`slide-${slide.id}-content-color`}
										type="color"
										value={slide.contentColor || slide.textColor || '#000000'}
										onChange={(e) =>
											onSlideChange(slideIndex, 'contentColor', e.target.value)
										}
										aria-label="Цвет контента слайда"
										className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
									/>
									<Input
										value={slide.contentColor || slide.textColor || '#000000'}
										onChange={(e) =>
											onSlideChange(slideIndex, 'contentColor', e.target.value)
										}
										placeholder="Авто"
										className="flex-1 text-xs"
									/>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
