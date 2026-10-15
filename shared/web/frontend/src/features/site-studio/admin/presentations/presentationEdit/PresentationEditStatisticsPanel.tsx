/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentation and current-slide statistics panel for the editor sidebar.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEditorStats.ts
 */

import type { PresentationSlide } from '@services/api/presentations';
import { ChartBarSquareIcon } from '@heroicons/react/24/outline';
import { getPresentationStats, getSlideStats } from './presentationEditorStats';

export type PresentationEditStatisticsPanelProps = {
	slides: PresentationSlide[];
	selectedSlide: PresentationSlide;
};

export function PresentationEditStatisticsPanel({
	slides,
	selectedSlide,
}: PresentationEditStatisticsPanelProps) {
	const stats = getPresentationStats(slides);
	const slideStats = getSlideStats(selectedSlide);

	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<div className="flex items-center gap-2 mb-4">
				<ChartBarSquareIcon
					width={18}
					height={18}
					className="text-primary-600 dark:text-primary-400"
				/>
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
					Статистика
				</h2>
			</div>
			<div className="space-y-3">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
						<div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
							Всего слайдов
						</div>
						<div className="text-lg font-semibold text-neutral-900 dark:text-white">
							{stats.totalSlides}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
						<div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
							С изображениями
						</div>
						<div className="text-lg font-semibold text-neutral-900 dark:text-white">
							{stats.slidesWithImages}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
						<div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
							Всего слов
						</div>
						<div className="text-lg font-semibold text-neutral-900 dark:text-white">
							{stats.totalWords}
						</div>
					</div>
					<div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
						<div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
							Символов
						</div>
						<div className="text-lg font-semibold text-neutral-900 dark:text-white">
							{stats.totalChars.toLocaleString()}
						</div>
					</div>
				</div>
				<div className="pt-3 border-t border-neutral-200 dark:border-slate-700">
					<div className="text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
						Текущий слайд:
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-neutral-600 dark:text-slate-400">Слов:</span>
						<span className="font-semibold text-neutral-900 dark:text-white">
							{slideStats.words}
						</span>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span className="text-neutral-600 dark:text-slate-400">
							Символов:
						</span>
						<span className="font-semibold text-neutral-900 dark:text-white">
							{slideStats.chars}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
