/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slide editor chrome: slide index header, reorder/duplicate/delete actions, settings tab bar.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/PresentationEditSlideSettings*Tab.tsx
 */

import { Button } from '@components/atoms/Button';
import type { PresentationSlide } from '@services/api/presentations';
import {
	ArrowDownIcon,
	ArrowUpIcon,
	Cog6ToothIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
	SwatchIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import type { PresentationEditSettingsTabId } from './presentationEditSlideSettingsTypes';

export type PresentationEditSlideEditorChromeProps = {
	selectedSlide: PresentationSlide;
	selectedSlideIndex: number;
	slidesLength: number;
	activeSettingsTab: PresentationEditSettingsTabId;
	onActiveSettingsTabChange: (tab: PresentationEditSettingsTabId) => void;
	onMoveSlide: (index: number, direction: 'up' | 'down') => void;
	onDuplicateSlide: (index: number) => void;
	onRequestDeleteSlide: (index: number) => void;
	children: ReactNode;
};

export function PresentationEditSlideEditorChrome({
	selectedSlide,
	selectedSlideIndex,
	slidesLength,
	activeSettingsTab,
	onActiveSettingsTabChange,
	onMoveSlide,
	onDuplicateSlide,
	onRequestDeleteSlide,
	children,
}: PresentationEditSlideEditorChromeProps) {
	const showImageTab =
		selectedSlide.layout === 'image-content' ||
		selectedSlide.layout === 'title-image-content' ||
		selectedSlide.layout === 'full-image';

	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
					Слайд {selectedSlideIndex + 1} из {slidesLength}
				</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={() => onMoveSlide(selectedSlideIndex, 'up')}
						disabled={selectedSlideIndex === 0}
					>
						<ArrowUpIcon width={16} height={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={() => onMoveSlide(selectedSlideIndex, 'down')}
						disabled={selectedSlideIndex === slidesLength - 1}
					>
						<ArrowDownIcon width={16} height={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={() => onDuplicateSlide(selectedSlideIndex)}
						title="Дублировать слайд"
					>
						<DocumentDuplicateIcon width={16} height={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={() => onRequestDeleteSlide(selectedSlideIndex)}
						disabled={slidesLength === 1}
						className="text-red-600 hover:text-red-700"
						title="Удалить слайд"
					>
						<TrashIcon width={16} height={16} />
					</Button>
				</div>
			</div>

			<div className="mb-4 border-b border-neutral-200 dark:border-slate-700">
				<div className="flex gap-2 overflow-x-auto">
					<button
						type="button"
						onClick={() => onActiveSettingsTabChange('basic')}
						className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
							activeSettingsTab === 'basic'
								? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
								: 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
						}`}
					>
						<Cog6ToothIcon width={16} height={16} className="inline mr-1.5" />
						Основные
					</button>
					<button
						type="button"
						onClick={() => onActiveSettingsTabChange('typography')}
						className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
							activeSettingsTab === 'typography'
								? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
								: 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
						}`}
					>
						<DocumentTextIcon
							width={16}
							height={16}
							className="inline mr-1.5"
						/>
						Типографика
					</button>
					<button
						type="button"
						onClick={() => onActiveSettingsTabChange('colors')}
						className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
							activeSettingsTab === 'colors'
								? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
								: 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
						}`}
					>
						<SwatchIcon width={16} height={16} className="inline mr-1.5" />
						Цвета
					</button>
					{showImageTab && (
						<button
							type="button"
							onClick={() => onActiveSettingsTabChange('image')}
							className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
								activeSettingsTab === 'image'
									? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
									: 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
							}`}
						>
							Изображение
						</button>
					)}
				</div>
			</div>

			<div className="space-y-4">{children}</div>
		</div>
	);
}
