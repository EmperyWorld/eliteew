/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slide list sidebar with search, undo/redo, add slide, and drag-and-drop reorder.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - PresentationEditSlideListThumbnail.tsx
 */

import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import type { PresentationSlide } from '@services/api/presentations';
import {
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	Bars2Icon,
	MagnifyingGlassIcon,
	PlusIcon,
} from '@heroicons/react/24/outline';
import type * as React from 'react';
import { PresentationEditSlideListThumbnail } from './PresentationEditSlideListThumbnail';
import { getSlideStats } from './presentationEditorStats';

export type PresentationEditSlidesSidebarProps = {
	slides: PresentationSlide[];
	selectedSlideIndex: number;
	slideSearchQuery: string;
	draggedSlideIndex: number | null;
	historyIndex: number;
	historyLength: number;
	onSlideSearchQueryChange: (query: string) => void;
	onSelectSlide: (index: number) => void;
	onAddSlide: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onDragStart: (index: number) => void;
	onDragOver: (e: React.DragEvent, index: number) => void;
	onDragEnd: () => void;
	onDrop: (e: React.DragEvent) => void;
};

export function PresentationEditSlidesSidebar({
	slides,
	selectedSlideIndex,
	slideSearchQuery,
	draggedSlideIndex,
	historyIndex,
	historyLength,
	onSlideSearchQueryChange,
	onSelectSlide,
	onAddSlide,
	onUndo,
	onRedo,
	onDragStart,
	onDragOver,
	onDragEnd,
	onDrop,
}: PresentationEditSlidesSidebarProps) {
	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
					Слайды
				</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={onUndo}
						disabled={historyIndex <= 0}
						title="Отменить (Ctrl+Z)"
					>
						<ArrowUturnLeftIcon width={14} height={14} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						onClick={onRedo}
						disabled={historyIndex >= historyLength - 1}
						title="Повторить (Ctrl+Y)"
					>
						<ArrowUturnRightIcon width={14} height={14} />
					</Button>
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={onAddSlide}
					>
						<PlusIcon width={16} height={16} className="mr-1" />
						Добавить
					</Button>
				</div>
			</div>

			<div className="mb-4">
				<div className="relative">
					<MagnifyingGlassIcon
						className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
						width={16}
						height={16}
					/>
					<Input
						value={slideSearchQuery}
						onChange={(e) => onSlideSearchQueryChange(e.target.value)}
						placeholder="Поиск слайдов..."
						className="pl-9 text-sm"
					/>
				</div>
			</div>

			<ul
				className="space-y-2 max-h-96 overflow-y-auto list-none p-0 m-0"
				aria-label="Список слайдов"
				onDrop={onDrop}
				onDragOver={(e) => e.preventDefault()}
			>
				{slides
					.filter((slide) => {
						if (!slideSearchQuery) return true;
						const query = slideSearchQuery.toLowerCase();
						return (
							slide.title?.toLowerCase().includes(query) ||
							slide.content?.toLowerCase().includes(query)
						);
					})
					.map((slide) => {
						const actualIndex = slides.findIndex((s) => s.id === slide.id);
						const isDragging = draggedSlideIndex === actualIndex;
						return (
							<li
								key={slide.id}
								draggable
								onDragStart={() => onDragStart(actualIndex)}
								onDragOver={(e) => onDragOver(e, actualIndex)}
								onDragEnd={onDragEnd}
								className={`group relative cursor-move ${isDragging ? 'opacity-50' : ''}`}
							>
								<button
									type="button"
									onClick={() => onSelectSlide(actualIndex)}
									className={`w-full p-3 rounded-xl text-left transition-[color,background-color,border-color] duration-200 motion-reduce:transition-none flex items-start gap-3 ${
										actualIndex === selectedSlideIndex
											? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700'
											: 'bg-neutral-50 dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-100 dark:hover:bg-slate-800'
									}`}
								>
									<div className="shrink-0 mt-0.5 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
										<Bars2Icon
											width={16}
											height={16}
											className="text-neutral-400 dark:text-slate-500"
										/>
									</div>

									<PresentationEditSlideListThumbnail
										slide={slide}
										actualIndex={actualIndex}
									/>

									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
											<span>Слайд {actualIndex + 1}</span>
											{slide.layout && (
												<span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-300">
													{slide.layout === 'full-image'
														? 'Изобр'
														: slide.layout === 'title-image-content'
															? 'Т+И+Т'
															: slide.layout === 'image-content'
																? 'И+Т'
																: 'Т+Т'}
												</span>
											)}
										</div>
										<div className="text-xs text-neutral-500 dark:text-slate-400 mt-1 truncate">
											{slide.title || 'Без названия'}
										</div>
										{(() => {
											const stats = getSlideStats(slide);
											return stats.words > 0 || stats.chars > 0 ? (
												<div className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
													{stats.words} слов • {stats.chars} симв.
												</div>
											) : null;
										})()}
									</div>
								</button>
							</li>
						);
					})}
			</ul>

			{slideSearchQuery && (
				<div className="mt-4 pt-4 border-t border-neutral-200 dark:border-slate-700">
					<button
						type="button"
						onClick={() => onSlideSearchQueryChange('')}
						className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
					>
						Очистить поиск
					</button>
				</div>
			)}
		</div>
	);
}
