/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Unified Content picker body: search, type filter, selectable list, and persistent selection actions.
 *
 * Invariants:
 * - Row previews use `ContentThumbnail` (Bearer), not `thumbnail_url` on `<img>`.
 * - Confirm actions stay reachable when long picker lists scroll.
 *
 * Related:
 * - UnifiedContentPickerModal.tsx; ContentThumbnail.tsx.
 */
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	ContentType,
	type ContentType as ContentTypeT,
	formatFileSize,
} from '@/types/fileExchange';
import { cn } from '@/utils/cn';
import { trapFocus } from '@/utils/accessibility';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { unifiedContentDisplayLabel } from '../utils/contentDisplayLabel';
import { ContentThumbnail } from '../components/ContentThumbnail/ContentThumbnail';
import {
	PICKER_CONTENT_TYPE_BADGE_STYLES,
	PickerContentTypeIcon,
	pickerContentTypeLabel,
} from './pickerContentTypeUtils';
import type { PickerItem } from './useUnifiedContentPickerController';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ClipboardDocumentCheckIcon,
	ExclamationCircleIcon,
	MagnifyingGlassIcon,
	Square2StackIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type UnifiedContentPickerPanelProps = Readonly<{
	panelRef?: React.RefObject<HTMLDivElement | null>;
	compact?: boolean;
	embedded?: boolean;
	/** Скрыть блок с h2 «Выбор файлов» (для внешней шапки, напр. FileLibraryPanel) */
	hideTopHeader?: boolean;
	filteredItems: readonly PickerItem[];
	isLoading: boolean;
	isFetching?: boolean;
	isError: boolean;
	errorMessage?: string;
	onRetry: () => void;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	searchPending: boolean;
	showTypeFilter: boolean;
	filterType: ContentTypeT | 'all';
	onFilterTypeChange: (value: ContentTypeT | 'all') => void;
	availableTypes: readonly ContentTypeT[];
	multiSelect: boolean;
	maxFiles: number;
	selectedIds: readonly string[];
	onToggleId: (id: string) => void;
	onSelectAllVisible: () => void;
	onDeselectAll: () => void;
	onConfirm: () => void;
	onCancel: () => void;
	showFooter?: boolean;
	/** Иначе i18n `unifiedContentPicker.cancel` */
	cancelLabel?: string;
	/** Иначе i18n `unifiedContentPicker.confirm` + счётчик */
	confirmLabel?: React.ReactNode;
}>;

export function UnifiedContentPickerPanel({
	panelRef: panelRefProp,
	compact = false,
	embedded = false,
	hideTopHeader = false,
	filteredItems,
	isLoading,
	isFetching = false,
	isError,
	errorMessage,
	onRetry,
	searchQuery,
	onSearchChange,
	searchPending,
	showTypeFilter,
	filterType,
	onFilterTypeChange,
	availableTypes,
	multiSelect,
	maxFiles,
	selectedIds,
	onToggleId,
	onSelectAllVisible,
	onDeselectAll,
	onConfirm,
	onCancel,
	showFooter = true,
	cancelLabel,
	confirmLabel,
}: UnifiedContentPickerPanelProps): React.ReactElement {
	const { t } = useTranslation('unifiedContentPicker');
	const cancelText = cancelLabel ?? t('cancel');
	const confirmNode = confirmLabel ?? (
		<>
			<ClipboardDocumentCheckIcon className="h-4 w-4" aria-hidden />
			{t('confirm', { count: selectedIds.length })}
		</>
	);
	const innerRef = useRef<HTMLDivElement>(null);
	const panelRef = panelRefProp ?? innerRef;
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const el = panelRef.current;
		if (!el) {
			return;
		}
		return trapFocus(el);
	}, [panelRef]);

	useEffect(() => {
		const tmr = setTimeout(() => searchInputRef.current?.focus(), 80);
		return () => clearTimeout(tmr);
	}, []);

	const shellPad = compact ? 'p-2' : 'p-4';
	const shellSpace = compact ? 'space-y-2' : 'space-y-3';
	const searchInputPad = compact ? 'py-2 pl-9 pr-3' : 'py-3 pl-10 pr-20';
	const searchIconPos = compact ? 'left-2.5 h-4 w-4' : 'left-3 h-5 w-5';
	const listPad = compact ? 'p-2' : 'p-4';
	const footerPad = compact ? 'px-3 py-2' : 'p-4';

	const handleToggle = (id: string) => {
		onToggleId(id);
	};

	const handleKeyRow = (e: React.KeyboardEvent, id: string): void => {
		switch (e.key) {
			case 'Enter':
			case ' ':
				e.preventDefault();
				handleToggle(id);
				break;
			case 'Escape':
				e.preventDefault();
				onCancel();
				break;
			default:
				break;
		}
	};

	return (
		<div
			ref={panelRef}
			className={cn(
				'flex h-full min-h-0 flex-col overflow-hidden',
				embedded && hideTopHeader
					? 'bg-transparent'
					: 'bg-(--desktop-surface-app)'
			)}
		>
			{!embedded && !hideTopHeader ? (
				<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<h2 className="text-2xl font-bold text-(--desktop-text-primary)">
								{t('title')}
							</h2>
							<p className="mt-1 text-sm text-(--desktop-text-muted) antialiased">
								{t('subtitle')}
							</p>
						</div>
						<DesktopAppButton
							type="button"
							onClick={onCancel}
							variant="ghost"
							size="icon"
							aria-label={cancelText}
						>
							<XMarkIcon className="h-6 w-6 text-(--desktop-text-muted)" />
						</DesktopAppButton>
					</div>
				</div>
			) : null}

			<div
				className={cn(
					'shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
					shellSpace,
					shellPad
				)}
			>
				<div className="group relative">
					<MagnifyingGlassIcon
						className={cn(
							'absolute top-1/2 -translate-y-1/2 text-purple-400 transition-colors group-focus-within:text-pink-400',
							searchIconPos
						)}
						aria-hidden
					/>
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={t('searchPlaceholder')}
						aria-label={t('searchPlaceholder')}
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.searchField,
							'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
							'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)',
							'w-full border-purple-500/20 focus:border-purple-500/50',
							compact
								? 'text-sm focus:ring-2 focus:ring-purple-500/20'
								: 'focus:ring-4 focus:ring-purple-500/20',
							searchInputPad
						)}
					/>
					{searchPending ? (
						<div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs text-purple-400">
							<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
							<span>{t('searchPending')}</span>
						</div>
					) : null}
				</div>

				{showTypeFilter ? (
					<div
						className={cn(
							'flex flex-wrap items-center gap-2',
							compact && 'text-sm'
						)}
					>
						<DesktopAppSectionLabel
							className={compact ? 'text-[10px]' : undefined}
						>
							{t('typeContent')}
						</DesktopAppSectionLabel>
						<DesktopNativeSelect
							value={filterType}
							onChange={(e) =>
								onFilterTypeChange(e.target.value as ContentTypeT | 'all')
							}
							aria-label={t('typeContent')}
							className={cn(
								compact ? 'max-w-44 min-h-8 text-xs' : 'max-w-56 text-sm'
							)}
						>
							<option
								value="all"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('allTypes')}
							</option>
							{availableTypes.map((type) => (
								<option
									key={type}
									value={type}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{pickerContentTypeLabel(type)}
								</option>
							))}
						</DesktopNativeSelect>

						{multiSelect ? (
							<>
								<DesktopAppButton
									type="button"
									onClick={onSelectAllVisible}
									variant="accent"
									size="sm"
								>
									{t('selectAll')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									onClick={onDeselectAll}
									variant="neutral"
									size="sm"
								>
									{t('deselectAll')}
								</DesktopAppButton>
							</>
						) : null}

						<DesktopAppStatusBadge className="ml-auto border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)">
							{t('selectedCounter', {
								count: selectedIds.length,
								max: maxFiles,
							})}
						</DesktopAppStatusBadge>
					</div>
				) : null}

				{showFooter && selectedIds.length > 0 ? (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-3 py-2 shadow-(--desktop-shadow-soft)">
						<div className="min-w-0">
							<p className="text-xs font-medium text-(--desktop-text-primary)">
								{t('selectedCounter', {
									count: selectedIds.length,
									max: maxFiles,
								})}
							</p>
							<p className="text-[11px] text-(--desktop-text-dim)">
								{t('filesFound', { count: filteredItems.length })}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<DesktopAppButton
								type="button"
								onClick={onDeselectAll}
								variant="neutral"
								size="sm"
							>
								{t('deselectAll')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								className="gap-2"
								onClick={onConfirm}
							>
								{confirmNode}
							</DesktopAppButton>
						</div>
					</div>
				) : null}
			</div>

			<section
				className={cn('min-h-0 flex-1 overflow-y-auto', listPad)}
				aria-label={t('title')}
				aria-live="polite"
			>
				{isLoading || isFetching ? (
					<div className="space-y-2" role="status">
						{[1, 2, 3, 4, 5].map((i) => (
							<DesktopAppPanel
								key={i}
								className="flex animate-pulse items-center gap-3 p-3"
							>
								<div className="h-10 w-10 shrink-0 rounded-sm bg-(--desktop-surface-soft)" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-3/4 rounded-sm bg-(--desktop-surface-soft)" />
									<div className="h-3 w-1/2 rounded-sm bg-(--desktop-surface-soft)" />
								</div>
							</DesktopAppPanel>
						))}
						<p className="sr-only">{t('loading')}</p>
					</div>
				) : isError ? (
					<div className="flex justify-center py-12">
						<DesktopAppPanel className="max-w-md">
							<DesktopAppEmptyState
								icon={
									<ExclamationCircleIcon className="h-8 w-8 text-red-300" />
								}
								title={t('errorTitle')}
								description={errorMessage ?? ''}
							>
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={onRetry}
								>
									{t('retry')}
								</DesktopAppButton>
							</DesktopAppEmptyState>
						</DesktopAppPanel>
					</div>
				) : filteredItems.length === 0 ? (
					<DesktopAppPanel className="border-dashed bg-transparent">
						<DesktopAppEmptyState
							icon={
								searchQuery || filterType !== 'all' ? (
									<MagnifyingGlassIcon className="h-8 w-8 text-purple-400" />
								) : (
									<ArrowUpTrayIcon className="h-8 w-8 text-purple-400" />
								)
							}
							title={
								searchQuery || filterType !== 'all'
									? t('emptyFiltered')
									: t('emptyLibrary')
							}
							description=""
						>
							{searchQuery || filterType !== 'all' ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => {
										onSearchChange('');
										onFilterTypeChange('all');
									}}
								>
									{t('resetFilters')}
								</DesktopAppButton>
							) : null}
						</DesktopAppEmptyState>
					</DesktopAppPanel>
				) : (
					<div className="space-y-2">
						{filteredItems.map((file) => {
							const isSelected = selectedIds.includes(file.id);
							const ct = file._pickerContentType;
							const badgeClassName =
								PICKER_CONTENT_TYPE_BADGE_STYLES[ct] ??
								PICKER_CONTENT_TYPE_BADGE_STYLES[ContentType.OTHER];
							const rowClassName = cn(
								'flex cursor-pointer items-center rounded-lg border transition-[border-color,background-color] duration-200 motion-reduce:transition-none focus:outline-hidden focus:ring-2 focus:ring-purple-400/50',
								compact ? 'gap-2 p-2' : 'gap-3 p-3',
								isSelected
									? 'border-purple-400/50 bg-linear-to-r from-purple-500/20 to-pink-500/20 ring-2 ring-purple-400/30'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft)'
							);
							const label = unifiedContentDisplayLabel(file);
							const rowLabel = `${label}, ${formatFileSize(file.file_size ?? 0)}, ${ct}`;
							const rowInner = (
								<>
									{multiSelect ? (
										isSelected ? (
											<ClipboardDocumentCheckIcon className="h-5 w-5 shrink-0 text-purple-400" />
										) : (
											<Square2StackIcon className="h-5 w-5 shrink-0 text-(--desktop-text-dim)" />
										)
									) : null}
									<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm">
										{ct === ContentType.AUDIO ? (
											<div className="flex h-full w-full items-center justify-center bg-(--desktop-surface-soft)">
												<PickerContentTypeIcon contentType={ct} />
											</div>
										) : (
											<ContentThumbnail contentId={file.id} alt="" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{label}
										</p>
										<div className="mt-1 flex items-center gap-2">
											<span className={DESKTOP_TYPOGRAPHY.meta}>
												{formatFileSize(file.file_size ?? 0)}
											</span>
											<span className="text-xs text-(--desktop-text-secondary)/80">
												•
											</span>
											<DesktopAppStatusBadge className={badgeClassName}>
												{pickerContentTypeLabel(ct)}
											</DesktopAppStatusBadge>
										</div>
									</div>
								</>
							);

							return (
								// biome-ignore lint/a11y/useSemanticElements: full-row selectable tile
								<div
									key={file.id}
									role="checkbox"
									aria-checked={isSelected}
									aria-label={rowLabel}
									tabIndex={0}
									onKeyDown={(e) => handleKeyRow(e, file.id)}
									className={rowClassName}
									onClick={() => onToggleId(file.id)}
								>
									{rowInner}
								</div>
							);
						})}
					</div>
				)}
				<div role="status" aria-live="polite" className="sr-only">
					{t('selectedCounter', { count: selectedIds.length, max: maxFiles })}
				</div>
			</section>

			{showFooter ? (
				<div
					className={cn(
						'sticky bottom-0 z-20 flex shrink-0 items-center justify-between border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/95 shadow-[0_-12px_30px_rgba(0,0,0,0.16)] backdrop-blur-md',
						footerPad
					)}
				>
					<div>
						<p
							className={cn(
								'text-(--desktop-text-secondary) antialiased',
								compact ? 'text-xs' : 'text-sm'
							)}
						>
							{t('filesFound', { count: filteredItems.length })}
						</p>
						{selectedIds.length > 0 ? (
							<p className="mt-1 text-xs text-purple-400">
								{t('selectedCounter', {
									count: selectedIds.length,
									max: maxFiles,
								})}
							</p>
						) : null}
					</div>
					<div className="flex shrink-0 gap-3">
						<DesktopAppButton
							type="button"
							onClick={onCancel}
							variant="neutral"
						>
							{cancelText}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							disabled={selectedIds.length === 0}
							variant="accent"
							className={cn(
								'gap-2',
								compact ? 'px-4 py-2 text-sm' : 'px-6 py-3'
							)}
							onClick={onConfirm}
						>
							{confirmNode}
						</DesktopAppButton>
					</div>
				</div>
			) : null}
		</div>
	);
}
