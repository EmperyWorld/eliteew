/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Content manager browser tab: list/grid, filters, pagination, batch actions.
 *
 * Invariants:
 * - List thumbnails in table mode use authenticated `ContentThumbnail` (not bare `thumbnail_url`).
 *
 * Related:
 * - FileCard.tsx; VirtualizedGrid.tsx.
 */
import { motion } from 'framer-motion';
import * as React from 'react';
import { useMemo } from 'react';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { InputV2 } from '../../../ui/InputV2';
import { SelectV2, type SelectOption } from '../../../ui/SelectV2';
import { WidgetLoadingSkeleton } from '../../../ui/WidgetStates';
import { ContentType } from '@/types/fileExchange';
import type { Content, SortField, SortOrder, ViewMode } from '../../types';
import { ContentThumbnail } from '../ContentThumbnail/ContentThumbnail';
import {
	contentTypeLabels,
	formatBytes,
	formatDate,
	getFileIcon,
	getVisibilityColor,
	visibilityLabels,
} from '../../utils/contentUtils';
import { FileCard } from '../FileCard';
import { VirtualizedGrid } from '../VirtualizedGrid';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	BarsArrowDownIcon,
	BarsArrowUpIcon,
	CheckCircleIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleStackIcon,
	ClockIcon,
	EyeIcon,
	FunnelIcon,
	InformationCircleIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PencilSquareIcon,
	Squares2X2Icon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

interface BrowserTabProps {
	contents: Content[];
	filteredContents: Content[];
	loading: boolean;
	viewMode: ViewMode;
	sortField: SortField;
	sortOrder: SortOrder;
	searchQuery: string;
	filterType: string;
	filterVisibility: string;
	isSelectMode: boolean;
	selectedIds: Set<string>;
	currentPage: number;
	itemsPerPage: number;
	availableContentTypes: Array<{ value: string; label: string; count: number }>;
	favorites?: Set<string>;
	onViewModeChange: (mode: ViewMode) => void;
	onSortChange: (field: SortField, order: SortOrder) => void;
	onSearchChange: (query: string) => void;
	onFilterChange: (type: string, visibility: string) => void;
	onSelectModeToggle: () => void;
	onSelectAll: () => void;
	onToggleSelection: (id: string) => void;
	onBatchDelete: () => void;
	onRefresh: () => void;
	onContentView: (content: Content) => void;
	onContentDownload: (id: string, name: string) => void;
	onContentEdit: (content: Content) => void;
	onContentVersions: (id: string) => void;
	onContentDelete: (id: string, name: string) => void;
	onPageChange: (page: number) => void;
	onNavigateToUpload: () => void;
	onToggleFavorite?: (id: string) => void;
	onQuickAction?: (
		id: string,
		action: 'view' | 'download' | 'edit' | 'delete' | 'share' | 'copy-link'
	) => void;
}

export const BrowserTab: React.FC<BrowserTabProps> = ({
	contents: _contents, // eslint-disable-line @typescript-eslint/no-unused-vars
	filteredContents,
	loading,
	viewMode,
	sortField,
	sortOrder,
	searchQuery,
	filterType,
	filterVisibility,
	isSelectMode,
	selectedIds,
	currentPage,
	itemsPerPage,
	availableContentTypes,
	favorites = new Set(),
	onViewModeChange,
	onSortChange,
	onSearchChange,
	onFilterChange,
	onSelectModeToggle,
	onSelectAll,
	onToggleSelection,
	onBatchDelete,
	onRefresh,
	onContentView,
	onContentDownload,
	onContentEdit,
	onContentVersions,
	onContentDelete,
	onPageChange,
	onNavigateToUpload,
	onToggleFavorite,
	onQuickAction,
}) => {
	// Content type options
	const contentTypeOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: 'Все типы' },
			...availableContentTypes.map((type) => ({
				value: type.value,
				label: `${type.label} (${type.count})`,
			})),
		],
		[availableContentTypes]
	);

	// Visibility options
	const visibilityOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'all', label: 'Все' },
			...Object.entries(visibilityLabels).map(([value, label]) => ({
				value,
				label,
			})),
		],
		[]
	);

	// Sort options
	const sortOptions: SelectOption[] = useMemo(
		() => [
			{ value: 'name', label: 'По имени' },
			{ value: 'date', label: 'По дате' },
			{ value: 'size', label: 'По размеру' },
			{ value: 'type', label: 'По типу' },
		],
		[]
	);

	// Pagination
	const totalPages = Math.ceil(filteredContents.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentContents = filteredContents.slice(startIndex, endIndex);

	return (
		<div className="space-y-6">
			{/* Enhanced Toolbar */}
			<div className="flex flex-col gap-4">
				{/* MagnifyingGlassIcon and Filters Row */}
				<div className="grid grid-cols-1 md:grid-cols-12 gap-4">
					<div className="md:col-span-5">
						<InputV2
							label="Поиск"
							placeholder="Поиск по имени, описанию, тегам..."
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							iconLeft={<MagnifyingGlassIcon className="w-4 h-4" />}
							helperText={
								filteredContents.length > 0
									? `Найдено: ${filteredContents.length} файлов`
									: undefined
							}
						/>
					</div>

					<div className="md:col-span-3">
						<SelectV2
							label="Тип контента"
							options={contentTypeOptions}
							value={filterType}
							onChange={(value) =>
								onFilterChange(value as string, filterVisibility)
							}
							placeholder="Выберите тип"
						/>
					</div>

					<div className="md:col-span-2">
						<SelectV2
							label="Видимость"
							options={visibilityOptions}
							value={filterVisibility}
							onChange={(value) => onFilterChange(filterType, value as string)}
							placeholder="Выберите видимость"
						/>
					</div>

					<div className="md:col-span-2 flex items-end gap-2">
						<ButtonV2
							variant="ghost"
							size="md"
							iconLeft={<FunnelIcon className="w-4 h-4" />}
							onClick={() => {
								onSearchChange('');
								onFilterChange('all', 'all');
							}}
							title="Сбросить фильтры"
						>
							Сброс
						</ButtonV2>
					</div>
				</div>

				{/* Actions Row */}
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div className="flex items-center gap-3">
						{/* View Mode Toggle */}
						<div className="flex gap-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-1">
							<ButtonV2
								variant={viewMode === 'list' ? 'secondary' : 'ghost'}
								size="icon"
								onClick={() => onViewModeChange('list')}
								iconLeft={<ListBulletIcon className="w-4 h-4" />}
								aria-label="Список"
							/>
							<ButtonV2
								variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
								size="icon"
								onClick={() => onViewModeChange('grid')}
								iconLeft={<Squares2X2Icon className="w-4 h-4" />}
								aria-label="Сетка"
							/>
						</div>

						{/* Sort Controls */}
						<div className="flex items-center gap-2">
							<SelectV2
								options={sortOptions}
								value={sortField}
								onChange={(value) =>
									onSortChange(value as SortField, sortOrder)
								}
								placeholder="Сортировать"
								className="min-w-[140px]"
							/>
							<ButtonV2
								variant="ghost"
								size="icon"
								onClick={() =>
									onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc')
								}
								iconLeft={
									sortOrder === 'asc' ? (
										<BarsArrowUpIcon className="w-4 h-4" />
									) : (
										<BarsArrowDownIcon className="w-4 h-4" />
									)
								}
								aria-label={
									sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'
								}
								title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
							/>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Select Mode Toggle */}
						<ButtonV2
							variant={isSelectMode ? 'secondary' : 'ghost'}
							size="md"
							onClick={onSelectModeToggle}
							iconLeft={<CheckIcon className="w-4 h-4" />}
						>
							{isSelectMode ? 'Отменить выбор' : 'Выбрать'}
						</ButtonV2>

						{isSelectMode && (
							<>
								<ButtonV2
									variant="ghost"
									size="md"
									onClick={onSelectAll}
									iconLeft={<CheckCircleIcon className="w-4 h-4" />}
								>
									{selectedIds.size === currentContents.length
										? 'Снять все'
										: 'Выбрать все'}
								</ButtonV2>

								{selectedIds.size > 0 && (
									<ButtonV2
										variant="danger"
										size="md"
										onClick={onBatchDelete}
										iconLeft={<TrashIcon className="w-4 h-4" />}
									>
										Удалить ({selectedIds.size})
									</ButtonV2>
								)}
							</>
						)}

						<ButtonV2
							variant="gradient"
							size="md"
							onClick={onRefresh}
							iconLeft={<ArrowPathIcon className="w-4 h-4" />}
							loading={loading}
							aria-label="Обновить"
						>
							Обновить
						</ButtonV2>
					</div>
				</div>

				{/* Selection InformationCircleIcon Banner */}
				{selectedIds.size > 0 && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-linear-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 backdrop-blur-xl"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-purple-500/30 rounded-lg">
									<CheckCircleIcon className="w-5 h-5 text-purple-300" />
								</div>
								<div>
									<div className="text-white font-semibold">
										Выбрано файлов: {selectedIds.size}
									</div>
									<div className="text-purple-300/80 text-sm">
										Можно выполнить массовые операции
									</div>
								</div>
							</div>
							<ButtonV2
								variant="ghost"
								size="sm"
								onClick={() => {
									onSelectModeToggle();
								}}
								iconLeft={<XMarkIcon className="w-4 h-4" />}
							>
								Очистить
							</ButtonV2>
						</div>
					</motion.div>
				)}
			</div>

			{/* Content Display */}
			{loading ? (
				<WidgetLoadingSkeleton type="list" />
			) : filteredContents.length === 0 ? (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="bg-white/5 backdrop-blur-xl rounded-xl p-12 border border-white/10"
				>
					<div className="text-center max-w-md mx-auto">
						<motion.div
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ delay: 0.1, type: 'spring' }}
							className="inline-flex p-4 bg-linear-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4 border border-purple-500/30"
						>
							{searchQuery ||
							filterType !== 'all' ||
							filterVisibility !== 'all' ? (
								<MagnifyingGlassIcon className="w-12 h-12 text-purple-400" />
							) : (
								<CircleStackIcon className="w-12 h-12 text-purple-400" />
							)}
						</motion.div>

						<h3 className="text-2xl font-bold text-white mb-2">
							{searchQuery || filterType !== 'all' || filterVisibility !== 'all'
								? 'Ничего не найдено'
								: 'Контент не найден'}
						</h3>

						<p className="text-gray-400 mb-6">
							{searchQuery
								? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить поисковый запрос.`
								: filterType !== 'all' || filterVisibility !== 'all'
									? 'Нет контента, соответствующего выбранным фильтрам. Попробуйте изменить фильтры.'
									: 'Загрузите свой первый файл, чтобы начать работу с менеджером контента.'}
						</p>

						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							{searchQuery ||
							filterType !== 'all' ||
							filterVisibility !== 'all' ? (
								<>
									<ButtonV2
										variant="secondary"
										size="md"
										onClick={() => {
											onSearchChange('');
											onFilterChange('all', 'all');
										}}
										iconLeft={<XMarkIcon className="w-4 h-4" />}
									>
										Сбросить фильтры
									</ButtonV2>
									<ButtonV2
										variant="ghost"
										size="md"
										onClick={onNavigateToUpload}
										iconLeft={<ArrowUpTrayIcon className="w-4 h-4" />}
									>
										Загрузить файл
									</ButtonV2>
								</>
							) : (
								<>
									<ButtonV2
										variant="gradient"
										size="md"
										onClick={onNavigateToUpload}
										iconLeft={<ArrowUpTrayIcon className="w-4 h-4" />}
									>
										Загрузить первый файл
									</ButtonV2>
									<ButtonV2
										variant="ghost"
										size="md"
										onClick={onRefresh}
										iconLeft={<ArrowPathIcon className="w-4 h-4" />}
									>
										Обновить
									</ButtonV2>
								</>
							)}
						</div>

						{/* Helpful Tips */}
						{!searchQuery &&
							filterType === 'all' &&
							filterVisibility === 'all' && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.3 }}
									className="mt-8 pt-6 border-t border-white/10"
								>
									<p className="text-sm text-gray-500 mb-3 font-medium">
										Советы:
									</p>
									<ul className="text-left text-sm text-gray-400 space-y-2 max-w-sm mx-auto">
										<li className="flex items-start gap-2">
											<InformationCircleIcon className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
											<span>
												Поддерживаются все типы файлов: документы, изображения,
												видео, аудио
											</span>
										</li>
										<li className="flex items-start gap-2">
											<InformationCircleIcon className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
											<span>
												Можно перетаскивать файлы прямо в окно браузера
											</span>
										</li>
										<li className="flex items-start gap-2">
											<InformationCircleIcon className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
											<span>Используйте теги для быстрого поиска контента</span>
										</li>
									</ul>
								</motion.div>
							)}
					</div>
				</motion.div>
			) : viewMode === 'list' ? (
				<>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="backdrop-blur-xs">
								<tr className="border-b border-white/10">
									{isSelectMode && (
										<th className="w-10 py-3 px-4">
											<input
												type="checkbox"
												checked={
													selectedIds.size === currentContents.length &&
													currentContents.length > 0
												}
												onChange={onSelectAll}
												className="w-4 h-4"
											/>
										</th>
									)}
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Превью
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Название
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Тип
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Размер
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Дата
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Видимость
									</th>
									<th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
										Теги
									</th>
									<th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
										Действия
									</th>
								</tr>
							</thead>
							<tbody>
								{currentContents.map((content) => (
									<motion.tr
										key={content.id}
										className="border-b border-white/5 hover:bg-linear-to-r hover:from-purple-500/5 hover:to-pink-500/5 transition-colors"
										transition={{ duration: 0.2 }}
									>
										{isSelectMode && (
											<td className="py-3 px-4">
												<input
													type="checkbox"
													checked={selectedIds.has(content.id)}
													onChange={() => onToggleSelection(content.id)}
													className="w-4 h-4"
												/>
											</td>
										)}
										<td className="py-3 px-4">
											<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-white/20 bg-white/10 backdrop-blur-xl">
												{content.content_type === ContentType.AUDIO ? (
													<span className="flex h-full w-full items-center justify-center">
														{getFileIcon(content.content_type)}
													</span>
												) : (
													<ContentThumbnail contentId={content.id} alt="" />
												)}
											</div>
										</td>
										<td className="py-3 px-4">
											<div>
												<div className="text-white font-medium">
													{content.name}
												</div>
												{content.description && (
													<div className="text-xs text-gray-400 truncate max-w-xs">
														{content.description}
													</div>
												)}
											</div>
										</td>
										<td className="py-3 px-4">
											<span className="px-2 py-1 bg-linear-to-r from-purple-500/20 to-pink-500/20 text-purple-400 rounded-sm text-xs border border-purple-500/30">
												{contentTypeLabels[content.content_type] ||
													content.content_type}
											</span>
										</td>
										<td className="py-3 px-4 text-gray-400">
											{formatBytes(content.file_size)}
										</td>
										<td className="py-3 px-4 text-gray-400 text-sm">
											{formatDate(content.created_at)}
										</td>
										<td className="py-3 px-4">
											<span
												className={`px-2 py-1 rounded-sm text-xs text-${getVisibilityColor(content.visibility)}-400 bg-${getVisibilityColor(content.visibility)}-500/20 border border-${getVisibilityColor(content.visibility)}-500/30`}
											>
												{visibilityLabels[content.visibility] ||
													content.visibility}
											</span>
										</td>
										<td className="py-3 px-4">
											<div className="flex gap-1 flex-wrap">
												{content.tags?.slice(0, 2).map((tag) => (
													<span
														key={tag}
														className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-sm text-xs border border-blue-500/30"
													>
														{tag}
													</span>
												))}
												{content.tags?.length > 2 && (
													<span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-sm text-xs">
														+{content.tags.length - 2}
													</span>
												)}
											</div>
										</td>
										<td className="py-3 px-4">
											<div className="flex justify-end gap-2">
												<motion.button
													type="button"
													onClick={() => onContentView(content)}
													className="rounded-sm p-2 text-green-400 transition-colors hover:bg-green-500/20 hover:text-green-300"
													whileTap={{ scale: 0.9 }}
													title="Просмотр"
												>
													<EyeIcon className="w-4 h-4" />
												</motion.button>
												<motion.button
													type="button"
													onClick={() =>
														onContentDownload(content.id, content.name)
													}
													className="rounded-sm p-2 text-purple-400 transition-colors hover:bg-purple-500/20 hover:text-purple-300"
													whileTap={{ scale: 0.9 }}
													title="Скачать"
												>
													<ArrowDownTrayIcon className="w-4 h-4" />
												</motion.button>
												<motion.button
													type="button"
													onClick={() => onContentEdit(content)}
													className="rounded-sm p-2 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
													whileTap={{ scale: 0.9 }}
													title="Редактировать"
												>
													<PencilSquareIcon className="w-4 h-4" />
												</motion.button>
												<motion.button
													type="button"
													onClick={() => onContentVersions(content.id)}
													className="rounded-sm p-2 text-pink-400 transition-colors hover:bg-pink-500/20 hover:text-pink-300"
													whileTap={{ scale: 0.9 }}
													title="Версии"
												>
													<ClockIcon className="w-4 h-4" />
												</motion.button>
												<motion.button
													type="button"
													onClick={() =>
														onContentDelete(content.id, content.name)
													}
													className="rounded-sm p-2 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
													whileTap={{ scale: 0.9 }}
													title="Удалить"
												>
													<TrashIcon className="w-4 h-4" />
												</motion.button>
											</div>
										</td>
									</motion.tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between mt-4">
							<div className="text-sm text-gray-400">
								Показано {startIndex + 1}-
								{Math.min(endIndex, filteredContents.length)} из{' '}
								{filteredContents.length}
							</div>
							<div className="flex gap-2">
								<motion.button
									type="button"
									onClick={() => onPageChange(Math.max(1, currentPage - 1))}
									disabled={currentPage === 1}
									className="p-2 bg-white/10 backdrop-blur-xl hover:bg-white/15 border border-white/20 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									whileTap={{ scale: 0.95 }}
									aria-label="Предыдущая страница"
								>
									<ChevronLeftIcon className="w-4 h-4" />
								</motion.button>
								<div className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-sm text-white">
									{currentPage} / {totalPages}
								</div>
								<motion.button
									type="button"
									onClick={() =>
										onPageChange(Math.min(totalPages, currentPage + 1))
									}
									disabled={currentPage === totalPages}
									className="p-2 bg-white/10 backdrop-blur-xl hover:bg-white/15 border border-white/20 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									whileTap={{ scale: 0.95 }}
									aria-label="Следующая страница"
								>
									<ChevronRightIcon className="w-4 h-4" />
								</motion.button>
							</div>
						</div>
					)}
				</>
			) : (
				<>
					{/* Grid View with VirtualizedGrid for performance */}
					{viewMode === 'grid' && currentContents.length > 30 ? (
						<VirtualizedGrid
							contents={currentContents}
							selectedIds={selectedIds}
							favorites={favorites}
							isSelectMode={isSelectMode}
							onSelect={(id) => {
								// Simple toggle for now - range selection can be added later
								onToggleSelection(id);
							}}
							onClick={onContentView}
							onQuickAction={(id, action) => {
								if (onQuickAction) {
									onQuickAction(id, action);
								} else {
									// Fallback to individual handlers
									const content = currentContents.find((c) => c.id === id);
									if (!content) {
										return;
									}

									switch (action) {
										case 'view':
											onContentView(content);
											break;
										case 'download':
											onContentDownload(id, content.name);
											break;
										case 'edit':
											onContentEdit(content);
											break;
										case 'delete':
											onContentDelete(id, content.name);
											break;
									}
								}
							}}
							onToggleFavorite={onToggleFavorite}
							columns={4}
							itemHeight={280}
						/>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{currentContents.map((content) => (
								<FileCard
									key={content.id}
									content={content}
									selected={selectedIds.has(content.id)}
									isFavorite={favorites.has(content.id)}
									onSelect={(id) => {
										// Simple toggle for now - range selection can be added later
										onToggleSelection(id);
									}}
									onClick={onContentView}
									onQuickAction={(id, action) => {
										if (onQuickAction) {
											onQuickAction(id, action);
										} else {
											// Fallback to individual handlers
											switch (action) {
												case 'view':
													onContentView(content);
													break;
												case 'download':
													onContentDownload(id, content.name);
													break;
												case 'edit':
													onContentEdit(content);
													break;
												case 'delete':
													onContentDelete(id, content.name);
													break;
											}
										}
									}}
									onToggleFavorite={onToggleFavorite}
									showContextMenu={true}
								/>
							))}
						</div>
					)}

					{/* Pagination for Grid */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between mt-4">
							<div className="text-sm text-gray-400">
								Показано {startIndex + 1}-
								{Math.min(endIndex, filteredContents.length)} из{' '}
								{filteredContents.length}
							</div>
							<div className="flex gap-2">
								<motion.button
									type="button"
									onClick={() => onPageChange(Math.max(1, currentPage - 1))}
									disabled={currentPage === 1}
									className="p-2 bg-white/10 backdrop-blur-xl hover:bg-white/15 border border-white/20 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									whileTap={{ scale: 0.95 }}
								>
									<ChevronLeftIcon className="w-4 h-4" />
								</motion.button>
								<div className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-sm text-white">
									{currentPage} / {totalPages}
								</div>
								<motion.button
									type="button"
									onClick={() =>
										onPageChange(Math.min(totalPages, currentPage + 1))
									}
									disabled={currentPage === totalPages}
									className="p-2 bg-white/10 backdrop-blur-xl hover:bg-white/15 border border-white/20 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									whileTap={{ scale: 0.95 }}
								>
									<ChevronRightIcon className="w-4 h-4" />
								</motion.button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
};
