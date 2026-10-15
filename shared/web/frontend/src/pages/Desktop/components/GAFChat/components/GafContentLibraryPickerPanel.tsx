/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Body UI for GAF Chat attachment picker from internal Content Manager library:
 * search, type chips, sort, grid/list, keyboard navigation, side preview, and persistent actions.
 *
 * Invariants:
 * - Single-file selection only; confirm requires exactly one selected row.
 * - The attach action stays visible when long lists scroll.
 * - Row thumbnails use Bearer `ContentThumbnail`, not raw `thumbnail_url` on `<img>`.
 *
 * Related:
 * - GafContentLibraryPicker.tsx; useUnifiedContentPickerController.ts
 * - GafContentLibraryPreview.tsx; GafContentLibraryPickerRow.tsx; GafContentLibraryPickerActionBar.tsx
 */
import type { Content } from '@/components/UnifiedContent/types';
import { stripPickerItemMeta } from '@/components/UnifiedContent/picker/stripPickerItemMeta';
import type { PickerItem } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import { useUnifiedContentPickerController } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ContentType,
	type ContentType as ContentTypeT,
} from '@/types/fileExchange';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ExclamationCircleIcon,
	MagnifyingGlassIcon,
	Squares2X2Icon,
	ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import {
	type KeyboardEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { GafContentLibraryPickerActionBar } from './GafContentLibraryPickerActionBar';
import { GafContentLibraryPickerRow } from './GafContentLibraryPickerRow';
import { GafContentLibraryPreview } from './GafContentLibraryPreview';
import {
	type GafLibrarySortKey,
	sortGafLibraryPickerItems,
} from './gafContentLibraryPickerSort';

const BASE_LIST_PARAMS = {
	limit: 200,
	offset: 0,
	sort_field: 'date' as const,
	sort_order: 'desc' as const,
};

export type GafContentLibraryPickerPanelProps = Readonly<{
	enabled: boolean;
	onCancel: () => void;
	onPick: (file: Content) => void;
}>;

type ViewMode = 'grid' | 'list';

export function GafContentLibraryPickerPanel({
	enabled,
	onCancel,
	onPick,
}: GafContentLibraryPickerPanelProps): ReactElement {
	const { t } = useTranslation('gafChat');
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [sortKey, setSortKey] = useState<GafLibrarySortKey>('newest');
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const ctrl = useUnifiedContentPickerController({
		enabled,
		baseListParams: BASE_LIST_PARAMS,
		multiSelect: false,
		maxFiles: 1,
	});

	const sortedItems = useMemo(
		() => sortGafLibraryPickerItems(ctrl.filteredItems, sortKey),
		[ctrl.filteredItems, sortKey]
	);

	const selectedId = ctrl.selectedIds[0] ?? null;
	const selectedItem = useMemo(
		() => sortedItems.find((i) => i.id === selectedId) ?? null,
		[sortedItems, selectedId]
	);

	const typeChipLabel = useCallback(
		(type: ContentTypeT | 'all') => {
			switch (type) {
				case 'all':
					return t('libraryPickerTypeAll');
				case ContentType.DOCUMENT:
					return t('libraryPickerTypeDocument');
				case ContentType.IMAGE:
					return t('libraryPickerTypeImage');
				case ContentType.VIDEO:
					return t('libraryPickerTypeVideo');
				case ContentType.AUDIO:
					return t('libraryPickerTypeAudio');
				default:
					return t('libraryPickerTypeOther');
			}
		},
		[t]
	);

	const attachSelected = useCallback(() => {
		const raw = ctrl.selectedItems[0];
		if (!raw) return;
		onPick(stripPickerItemMeta([raw])[0]);
		ctrl.clearSelection();
	}, [ctrl, onPick]);

	const handleRowActivate = useCallback(
		(id: string) => {
			ctrl.toggleId(id);
		},
		[ctrl]
	);

	const handleRowDoubleActivate = useCallback(
		(item: PickerItem) => {
			onPick(stripPickerItemMeta([item])[0]);
			ctrl.clearSelection();
		},
		[ctrl, onPick]
	);

	useEffect(() => {
		if (!enabled) return;
		const tmr = setTimeout(() => searchInputRef.current?.focus(), 80);
		return () => clearTimeout(tmr);
	}, [enabled]);

	const setSelectedIds = ctrl.setSelectedIds;
	useEffect(() => {
		if (!enabled || sortedItems.length === 0) return;
		if (selectedId && sortedItems.some((i) => i.id === selectedId)) return;
		setSelectedIds([sortedItems[0].id]);
	}, [enabled, sortedItems, selectedId, setSelectedIds]);

	const handleListKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (sortedItems.length === 0) return;
			const idx = selectedId
				? sortedItems.findIndex((i) => i.id === selectedId)
				: -1;
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				const next = sortedItems[Math.min(idx + 1, sortedItems.length - 1)];
				if (next) ctrl.setSelectedIds([next.id]);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const next = sortedItems[Math.max(idx - 1, 0)];
				if (next) ctrl.setSelectedIds([next.id]);
				return;
			}
			if (e.key === 'Enter' && selectedId) {
				e.preventDefault();
				attachSelected();
			}
		},
		[sortedItems, selectedId, ctrl, attachSelected]
	);

	const isBusy =
		ctrl.query.isPending ||
		(ctrl.query.isFetching && !ctrl.query.data?.items?.length);

	const typeChips: readonly (ContentTypeT | 'all')[] = useMemo(() => {
		const types = ctrl.availableTypes.length
			? ctrl.availableTypes
			: ([
					ContentType.IMAGE,
					ContentType.DOCUMENT,
					ContentType.VIDEO,
					ContentType.AUDIO,
					ContentType.OTHER,
				] as const);
		return ['all', ...types];
	}, [ctrl.availableTypes]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 space-y-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<div className="group relative min-w-48 flex-1">
						<MagnifyingGlassIcon
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim) group-focus-within:text-(--desktop-text-secondary)"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<input
							ref={searchInputRef}
							type="search"
							value={ctrl.searchQuery}
							onChange={(e) => ctrl.setSearchQuery(e.target.value)}
							placeholder={t('libraryPickerSearchPlaceholder')}
							aria-label={t('libraryPickerSearchPlaceholder')}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.searchField,
								'py-2.5 pl-9 pr-10',
								DESKTOP_TYPOGRAPHY.body
							)}
						/>
						{ctrl.searchPending ? (
							<ArrowPathIcon
								className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-(--desktop-text-dim)"
								aria-hidden
							/>
						) : null}
					</div>
					<fieldset
						className="flex shrink-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-0.5"
						aria-label={t('libraryPickerViewGrid')}
					>
						<DesktopChromeTooltip
							content={t('libraryPickerViewGridAria')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={viewMode === 'grid' ? 'accent' : 'ghost'}
								className="px-2"
								aria-label={t('libraryPickerViewGridAria')}
								aria-pressed={viewMode === 'grid'}
								onClick={() => setViewMode('grid')}
							>
								<Squares2X2Icon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('libraryPickerViewListAria')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={viewMode === 'list' ? 'accent' : 'ghost'}
								className="px-2"
								aria-label={t('libraryPickerViewListAria')}
								aria-pressed={viewMode === 'list'}
								onClick={() => setViewMode('list')}
							>
								<ViewColumnsIcon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</fieldset>
					<label
						htmlFor="gaf-library-picker-sort"
						className="flex shrink-0 items-center gap-1.5"
					>
						<span className="sr-only">{t('libraryPickerSortLabel')}</span>
						<DesktopNativeSelect
							id="gaf-library-picker-sort"
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value as GafLibrarySortKey)}
							aria-label={t('libraryPickerSortLabel')}
							className={cn('min-h-9 max-w-44', DESKTOP_TYPOGRAPHY.meta)}
						>
							<option
								value="newest"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('libraryPickerSortNewest')}
							</option>
							<option
								value="oldest"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('libraryPickerSortOldest')}
							</option>
							<option
								value="name_asc"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('libraryPickerSortNameAsc')}
							</option>
							<option
								value="name_desc"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('libraryPickerSortNameDesc')}
							</option>
							<option
								value="size_desc"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('libraryPickerSortSizeDesc')}
							</option>
						</DesktopNativeSelect>
					</label>
				</div>
				<div
					className="flex flex-wrap gap-1.5"
					role="toolbar"
					aria-label={t('libraryPickerTypeAll')}
				>
					{typeChips.map((type) => {
						const active = ctrl.filterType === type;
						const chipLabel = typeChipLabel(type);
						return (
							<DesktopChromeTooltip
								key={type}
								content={chipLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									size="sm"
									variant={active ? 'accent' : 'neutral'}
									className={cn('rounded-full px-3', DESKTOP_TYPOGRAPHY.meta)}
									aria-pressed={active}
									onClick={() => ctrl.setFilterType(type)}
								>
									{chipLabel}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						);
					})}
				</div>
			</div>

			<GafContentLibraryPickerActionBar
				placement="top"
				filesCount={sortedItems.length}
				selectedItem={selectedItem}
				onCancel={onCancel}
				onConfirm={attachSelected}
				confirmDisabled={!selectedItem}
			/>

			<div className="flex min-h-0 flex-1 flex-col md:flex-row">
				<div
					ref={listRef}
					className="min-h-[min(42vh,320px)] min-w-0 flex-1 overflow-y-auto p-3 md:min-h-0"
					role="listbox"
					aria-label={t('libraryPickerTitle')}
					tabIndex={0}
					onKeyDown={handleListKeyDown}
				>
					{isBusy ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<DesktopAppPanel
									key={i}
									className="aspect-4/3 animate-pulse bg-(--desktop-surface-soft)"
								/>
							))}
							<p className="sr-only">{t('libraryPickerLoading')}</p>
						</div>
					) : ctrl.query.isError ? (
						<DesktopAppEmptyState
							icon={
								<ExclamationCircleIcon
									className="h-8 w-8 text-red-300"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							title={t('libraryPickerLoadError')}
							description={
								ctrl.query.error instanceof Error
									? ctrl.query.error.message
									: ''
							}
						>
							<DesktopChromeTooltip
								content={t('libraryPickerRetry')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={() => void ctrl.query.refetch()}
								>
									{t('libraryPickerRetry')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</DesktopAppEmptyState>
					) : sortedItems.length === 0 ? (
						<DesktopAppEmptyState
							icon={
								<MagnifyingGlassIcon
									className="h-8 w-8 text-(--desktop-text-dim)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							title={
								ctrl.searchQuery.trim() || ctrl.filterType !== 'all'
									? t('libraryPickerEmptySearch')
									: t('libraryPickerEmptyLibrary')
							}
							description=""
						>
							{ctrl.searchQuery.trim() || ctrl.filterType !== 'all' ? (
								<DesktopChromeTooltip
									content={t('libraryPickerResetFilters')}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										variant="neutral"
										onClick={() => {
											ctrl.setSearchQuery('');
											ctrl.setFilterType('all');
										}}
									>
										{t('libraryPickerResetFilters')}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							) : null}
						</DesktopAppEmptyState>
					) : viewMode === 'grid' ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
							{sortedItems.map((file) => (
								<GafContentLibraryPickerRow
									key={file.id}
									file={file}
									variant="grid"
									selectedId={selectedId}
									typeChipLabel={typeChipLabel}
									onActivate={handleRowActivate}
									onDoubleActivate={handleRowDoubleActivate}
								/>
							))}
						</div>
					) : (
						<div className="space-y-1.5">
							{sortedItems.map((file) => (
								<GafContentLibraryPickerRow
									key={file.id}
									file={file}
									variant="list"
									selectedId={selectedId}
									typeChipLabel={typeChipLabel}
									onActivate={handleRowActivate}
									onDoubleActivate={handleRowDoubleActivate}
								/>
							))}
						</div>
					)}
				</div>
				<aside className="w-full shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-3 md:hidden">
					<GafContentLibraryPreview item={selectedItem} />
				</aside>
				<aside className="hidden w-full shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-4 md:flex md:w-80 md:border-l md:border-t-0 lg:w-96">
					<GafContentLibraryPreview item={selectedItem} />
				</aside>
			</div>

			<GafContentLibraryPickerActionBar
				placement="bottom"
				filesCount={sortedItems.length}
				selectedItem={selectedItem}
				onCancel={onCancel}
				onConfirm={attachSelected}
				confirmDisabled={!selectedItem}
			/>
		</div>
	);
}
