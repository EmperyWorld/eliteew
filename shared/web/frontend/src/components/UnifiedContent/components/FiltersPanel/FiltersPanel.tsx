/**
 * FiltersPanel - Боковая панель фильтров
 *
 * Выдвигающаяся панель с расширенными фильтрами:
 * - По типу контента
 * - По видимости
 * - По тегам
 * - По дате
 * - По размеру
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useId, useMemo, useState } from 'react';
import {
	ArrowUturnLeftIcon,
	CalendarIcon,
	ChevronDownIcon,
	FunnelIcon,
	ServerIcon,
	TagIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '../../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { useTranslation } from 'react-i18next';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { InputV2 } from '../../../ui/InputV2';
import { SelectV2, type SelectOption } from '../../../ui/SelectV2';
import { visibilityLabels } from '../../utils/contentUtils';

interface FiltersPanelProps {
	isOpen: boolean;
	onClose: () => void;
	filterType: string;
	filterVisibility: string;
	availableContentTypes: Array<{ value: string; label: string; count: number }>;
	onFilterChange: (type: string, visibility: string) => void;
	onReset: () => void;
}

type DateRangeKey = 'all' | 'today' | 'week' | 'month';
type SizeRangeKey = 'all' | 'small' | 'medium' | 'large';

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
	isOpen,
	onClose,
	filterType,
	filterVisibility,
	availableContentTypes,
	onFilterChange,
	onReset,
}) => {
	const { t } = useTranslation('contentManager');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [tagsRaw, setTagsRaw] = useState('');
	const [dateRange, setDateRange] = useState<DateRangeKey>('all');
	const [sizeRange, setSizeRange] = useState<SizeRangeKey>('all');
	const [sectionMainOpen, setSectionMainOpen] = useState(true);
	const [sectionWhenOpen, setSectionWhenOpen] = useState(true);
	const [sectionTagsOpen, setSectionTagsOpen] = useState(true);
	const activeFiltersRegionId = useId();

	const contentTypeOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: t('filtersPanel.allTypes') },
			...availableContentTypes.map((type) => ({
				value: type.value,
				label: `${type.label} (${type.count})`,
			})),
		],
		[availableContentTypes, t]
	);

	const visibilityOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: t('filtersPanel.allVisibility') },
			...Object.entries(visibilityLabels).map(([value, label]) => ({
				value,
				label,
			})),
		],
		[t]
	);

	const dateOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: t('filtersPanel.dateAll') },
			{ value: 'today', label: t('filtersPanel.dateToday') },
			{ value: 'week', label: t('filtersPanel.dateWeek') },
			{ value: 'month', label: t('filtersPanel.dateMonth') },
		],
		[t]
	);

	const sizeOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: t('filtersPanel.sizeAll') },
			{ value: 'small', label: t('filtersPanel.sizeSmall') },
			{ value: 'medium', label: t('filtersPanel.sizeMedium') },
			{ value: 'large', label: t('filtersPanel.sizeLarge') },
		],
		[t]
	);

	const typeLabel =
		contentTypeOptions.find((o) => o.value === filterType)?.label ?? filterType;
	const visibilityLabel =
		visibilityOptions.find((o) => o.value === filterVisibility)?.label ??
		filterVisibility;
	const dateLabel =
		dateOptions.find((o) => o.value === dateRange)?.label ?? dateRange;
	const sizeLabel =
		sizeOptions.find((o) => o.value === sizeRange)?.label ?? sizeRange;

	const hasActiveFilters =
		filterType !== 'all' ||
		filterVisibility !== 'all' ||
		dateRange !== 'all' ||
		sizeRange !== 'all' ||
		selectedTags.length > 0;

	const handleReset = (): void => {
		setSelectedTags([]);
		setTagsRaw('');
		setDateRange('all');
		setSizeRange('all');
		onReset();
	};

	const removeTag = (tag: string): void => {
		setSelectedTags((prev) => {
			const next = prev.filter((t) => t !== tag);
			setTagsRaw(next.join(', '));
			return next;
		});
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/50 backdrop-blur-sm"
						style={{ zIndex: embeddedModalZ.backdrop }}
					/>

					{/* Panel: full width on narrow viewports, fixed width on sm+ */}
					<motion.div
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className="fixed right-0 top-0 bottom-0 flex w-full min-w-0 max-w-full flex-col border-l border-white/10 bg-black/95 backdrop-blur-xl sm:w-80 sm:max-w-none overflow-y-auto overscroll-contain"
						style={{ zIndex: embeddedModalZ.content }}
					>
						<div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6">
							<div className="min-w-0 space-y-4 sm:space-y-6">
								{/* Header — stack on narrow screens */}
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex min-w-0 items-center gap-2">
										<FunnelIcon
											className="h-5 w-5 shrink-0 text-purple-400"
											aria-hidden
										/>
										<h2 className="truncate text-lg font-semibold text-white">
											{t('filtersPanel.title')}
										</h2>
									</div>
									<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
										<button
											type="button"
											onClick={handleReset}
											disabled={!hasActiveFilters}
											title={
												hasActiveFilters
													? t('filtersPanel.resetTitle')
													: t('filtersPanel.resetDisabled')
											}
											className="order-2 inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-center text-sm font-medium transition-colors sm:order-1 sm:py-1 disabled:cursor-not-allowed disabled:opacity-40 text-purple-200 hover:border-white/10 hover:bg-white/10 disabled:hover:border-transparent disabled:hover:bg-transparent"
										>
											<ArrowUturnLeftIcon
												className="h-3.5 w-3.5 shrink-0 opacity-90"
												aria-hidden
											/>
											{t('filtersPanel.resetAll')}
										</button>
										<button
											type="button"
											onClick={onClose}
											className="order-1 self-end rounded-lg p-1 transition-colors hover:bg-white/10 sm:order-2 sm:self-auto"
											aria-label={t('filtersPanel.close')}
										>
											<XMarkIcon className="h-5 w-5 text-gray-400" />
										</button>
									</div>
								</div>

								{/* Active filters as chips */}
								{hasActiveFilters && (
									<section
										className="rounded-xl border border-white/10 bg-white/5 p-3"
										aria-labelledby={activeFiltersRegionId}
									>
										<h3
											id={activeFiltersRegionId}
											className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400"
										>
											{t('filtersPanel.activeHeading')}
										</h3>
										<div className="flex flex-wrap gap-2">
											{filterType !== 'all' && (
												<span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-purple-400/35 bg-purple-500/25 px-2.5 py-1 text-xs font-semibold text-purple-100 shadow-sm shadow-purple-950/40">
													<span className="min-w-0 truncate" title={typeLabel}>
														{t('filtersPanel.chipType')} {typeLabel}
													</span>
													<button
														type="button"
														onClick={() =>
															onFilterChange('all', filterVisibility)
														}
														className="shrink-0 rounded p-0.5 hover:bg-white/10 hover:text-red-300"
														aria-label={t('filtersPanel.clearType')}
													>
														<XMarkIcon className="h-3.5 w-3.5" />
													</button>
												</span>
											)}
											{filterVisibility !== 'all' && (
												<span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-purple-400/35 bg-purple-500/25 px-2.5 py-1 text-xs font-semibold text-purple-100 shadow-sm shadow-purple-950/40">
													<span
														className="min-w-0 truncate"
														title={visibilityLabel}
													>
														{t('filtersPanel.chipVisibility')} {visibilityLabel}
													</span>
													<button
														type="button"
														onClick={() => onFilterChange(filterType, 'all')}
														className="shrink-0 rounded p-0.5 hover:bg-white/10 hover:text-red-300"
														aria-label={t('filtersPanel.clearVisibility')}
													>
														<XMarkIcon className="h-3.5 w-3.5" />
													</button>
												</span>
											)}
											{dateRange !== 'all' && (
												<span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/25 px-2.5 py-1 text-xs font-semibold text-sky-100 shadow-sm shadow-sky-950/30">
													<CalendarIcon
														className="h-3.5 w-3.5 shrink-0 opacity-80"
														aria-hidden
													/>
													<span className="min-w-0 truncate" title={dateLabel}>
														{dateLabel}
													</span>
													<button
														type="button"
														onClick={() => setDateRange('all')}
														className="shrink-0 rounded p-0.5 hover:bg-white/10 hover:text-red-300"
														aria-label={t('filtersPanel.clearDate')}
													>
														<XMarkIcon className="h-3.5 w-3.5" />
													</button>
												</span>
											)}
											{sizeRange !== 'all' && (
												<span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-500/25 px-2.5 py-1 text-xs font-semibold text-emerald-100 shadow-sm shadow-emerald-950/30">
													<ServerIcon
														className="h-3.5 w-3.5 shrink-0 opacity-80"
														aria-hidden
													/>
													<span className="min-w-0 truncate" title={sizeLabel}>
														{sizeLabel}
													</span>
													<button
														type="button"
														onClick={() => setSizeRange('all')}
														className="shrink-0 rounded p-0.5 hover:bg-white/10 hover:text-red-300"
														aria-label={t('filtersPanel.clearSize')}
													>
														<XMarkIcon className="h-3.5 w-3.5" />
													</button>
												</span>
											)}
											{selectedTags.map((tag) => (
												<span
													key={tag}
													className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/20 px-2.5 py-1 text-xs font-semibold text-fuchsia-100 shadow-sm shadow-fuchsia-950/30"
												>
													<TagIcon
														className="h-3.5 w-3.5 shrink-0 opacity-80"
														aria-hidden
													/>
													<span className="min-w-0 truncate" title={tag}>
														{tag}
													</span>
													<button
														type="button"
														onClick={() => removeTag(tag)}
														className="shrink-0 rounded p-0.5 hover:bg-white/10 hover:text-red-300"
														aria-label={t('filtersPanel.clearTag', { tag })}
													>
														<XMarkIcon className="h-3.5 w-3.5" />
													</button>
												</span>
											))}
										</div>
									</section>
								)}

								<div className="min-w-0 space-y-3">
									{/* Collapsible: основные фильтры */}
									<div className="rounded-xl border border-white/10 bg-white/4">
										<button
											type="button"
											onClick={() => setSectionMainOpen((o) => !o)}
											className="flex w-full items-center justify-between gap-2 rounded-t-xl px-3 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/5"
											aria-expanded={sectionMainOpen}
										>
											<span>{t('filtersPanel.sectionMain')}</span>
											<ChevronDownIcon
												className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${sectionMainOpen ? 'rotate-180' : ''}`}
												aria-hidden
											/>
										</button>
										{sectionMainOpen ? (
											<div className="space-y-4 border-t border-white/10 px-3 pb-4 pt-4">
												<div className="min-w-0 space-y-2">
													<SelectV2
														label={t('filtersPanel.contentType')}
														options={contentTypeOptions}
														value={filterType}
														onChange={(value) =>
															onFilterChange(value as string, filterVisibility)
														}
														placeholder={t(
															'filtersPanel.contentTypePlaceholder'
														)}
														className="min-w-0"
													/>
												</div>
												<div className="min-w-0 space-y-2">
													<SelectV2
														label={t('filtersPanel.visibilityLabel')}
														options={visibilityOptions}
														value={filterVisibility}
														onChange={(value) =>
															onFilterChange(filterType, value as string)
														}
														placeholder={t(
															'filtersPanel.visibilityPlaceholder'
														)}
														className="min-w-0"
													/>
												</div>
											</div>
										) : null}
									</div>

									{/* Collapsible: период и размер */}
									<div className="rounded-xl border border-white/10 bg-white/4">
										<button
											type="button"
											onClick={() => setSectionWhenOpen((o) => !o)}
											className="flex w-full items-center justify-between gap-2 rounded-t-xl px-3 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/5"
											aria-expanded={sectionWhenOpen}
										>
											<span>{t('filtersPanel.sectionWhen')}</span>
											<ChevronDownIcon
												className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${sectionWhenOpen ? 'rotate-180' : ''}`}
												aria-hidden
											/>
										</button>
										{sectionWhenOpen ? (
											<div className="space-y-4 border-t border-white/10 px-3 pb-4 pt-4">
												<div className="min-w-0 space-y-2">
													<SelectV2
														label={t('filtersPanel.dateLabel')}
														options={dateOptions}
														value={dateRange}
														onChange={(value) => {
															if (
																value === 'all' ||
																value === 'today' ||
																value === 'week' ||
																value === 'month'
															) {
																setDateRange(value);
															}
														}}
														placeholder={t('filtersPanel.datePlaceholder')}
														className="min-w-0"
													/>
												</div>
												<div className="min-w-0 space-y-2">
													<SelectV2
														label={t('filtersPanel.sizeLabel')}
														options={sizeOptions}
														value={sizeRange}
														onChange={(value) => {
															if (
																value === 'all' ||
																value === 'small' ||
																value === 'medium' ||
																value === 'large'
															) {
																setSizeRange(value);
															}
														}}
														placeholder={t('filtersPanel.sizePlaceholder')}
														className="min-w-0"
													/>
												</div>
											</div>
										) : null}
									</div>

									{/* Collapsible: теги */}
									<div className="rounded-xl border border-white/10 bg-white/4">
										<button
											type="button"
											onClick={() => setSectionTagsOpen((o) => !o)}
											className="flex w-full items-center justify-between gap-2 rounded-t-xl px-3 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-white/5"
											aria-expanded={sectionTagsOpen}
										>
											<span>{t('filtersPanel.sectionTags')}</span>
											<ChevronDownIcon
												className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${sectionTagsOpen ? 'rotate-180' : ''}`}
												aria-hidden
											/>
										</button>
										{sectionTagsOpen ? (
											<div className="border-t border-white/10 px-3 pb-4 pt-4">
												<InputV2
													label={t('filtersPanel.tagsLabel')}
													iconLeft={<TagIcon className="h-4 w-4" aria-hidden />}
													placeholder={t('filtersPanel.tagsPlaceholder')}
													helperText={t('filtersPanel.tagsHelper')}
													value={tagsRaw}
													onChange={(e) => {
														const raw = e.target.value;
														setTagsRaw(raw);
														const tags = raw
															.split(',')
															.map((t) => t.trim())
															.filter(Boolean);
														setSelectedTags(tags);
													}}
													className="min-w-0"
												/>
											</div>
										) : null}
									</div>
								</div>
							</div>

							{/* Actions — full-width stack at bottom */}
							<div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 pt-4">
								<ButtonV2
									variant="gradient"
									size="md"
									onClick={onClose}
									className="w-full min-w-0"
								>
									{t('filtersPanel.apply')}
								</ButtonV2>
								<ButtonV2
									variant="ghost"
									size="md"
									onClick={handleReset}
									disabled={!hasActiveFilters}
									iconLeft={
										<ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
									}
									className="w-full min-w-0 disabled:opacity-40"
									title={
										hasActiveFilters
											? t('filtersPanel.resetTitle')
											: t('filtersPanel.resetDisabled')
									}
								>
									{t('filtersPanel.resetAll')}
								</ButtonV2>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};
