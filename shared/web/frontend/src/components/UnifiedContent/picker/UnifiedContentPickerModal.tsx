/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Centered modal shell for selecting files from Unified Content across product flows.
 *
 * Invariants:
 * - The picker body owns list scrolling so footer actions remain visible.
 * - Portal z-index may be overridden by embedding apps such as GAF Chat.
 * - Body mount via ShellPortalMount only (no createPortal(document.body)).
 *
 * Related:
 * - `UnifiedContentPickerPanel.tsx`
 * - `FileGrabber.tsx`
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (U3.1-B)
 */
import type { Content } from '@/components/UnifiedContent/types';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_OVERLAY,
	DESKTOP_PORTAL_STACK_BUMP,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import type { ContentListQuery } from '@/services/contentApi';
import { cn } from '@/utils/cn';
import type { ContentType as ContentTypeT } from '@/types/fileExchange';
import * as React from 'react';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { stripPickerItemMeta } from './stripPickerItemMeta';
import { UnifiedContentPickerPanel } from './UnifiedContentPickerPanel';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { useUnifiedContentPickerController } from './useUnifiedContentPickerController';

export type UnifiedContentPickerModalProps = Readonly<{
	open: boolean;
	onClose: () => void;
	onConfirm: (items: Content[]) => void;
	/** Заголовок модалки; по умолчанию — из i18n unifiedContentPicker.title */
	title?: React.ReactNode;
	baseListParams?: ContentListQuery;
	mode?: 'single' | 'multi';
	maxFiles?: number;
	allowedContentTypes?: readonly ContentTypeT[];
	frameClassName?: string;
	/** По умолчанию затемнение как у модалок рабочего стола ({@link DESKTOP_OVERLAY.backdrop}). */
	backdropClassName?: string;
	/**
	 * Явный z-index корня портала: GAF (`DESKTOP_Z_INDEX.GAF_*`), админка (`MODAL`),
	 * модули Studio (`STUDIO_MODULE_PORTAL`). Иначе — `portalStackBase + UNIFIED_CONTENT_PICKER_PORTAL`.
	 */
	portalZIndex?: number;
	hideTypeFilter?: boolean;
	compact?: boolean;
	layout?: 'stack' | 'split';
	renderSidePreview?: (item: Content | null) => React.ReactNode;
	/** Когда достигнут maxFiles в мультивыборе */
	onMaxSelection?: () => void;
	/** Иначе i18n `unifiedContentPicker.cancel` */
	cancelLabel?: string;
	/** Иначе i18n `unifiedContentPicker.confirm` */
	confirmLabel?: React.ReactNode;
}>;

const defaultBaseParams: ContentListQuery = {
	limit: 150,
	offset: 0,
	sort_field: 'date',
	sort_order: 'desc',
};

export function UnifiedContentPickerModal({
	open,
	onClose,
	onConfirm,
	title,
	baseListParams,
	mode = 'multi',
	maxFiles = 10,
	allowedContentTypes,
	frameClassName,
	backdropClassName,
	portalZIndex,
	hideTypeFilter = false,
	compact = false,
	layout = 'stack',
	renderSidePreview,
	onMaxSelection,
	cancelLabel: cancelLabelProp,
	confirmLabel,
}: UnifiedContentPickerModalProps): React.ReactElement | null {
	const portalSurfaceRef = React.useRef<HTMLDivElement>(null);
	const portalStackBase = useDesktopWindowPortalStackBase();
	const { t } = useTranslation('unifiedContentPicker');
	const mergedBase = { ...defaultBaseParams, ...baseListParams };
	const multiSelect = mode === 'multi';
	const useSplit = layout === 'split' && Boolean(renderSidePreview);
	const resolvedCancel = cancelLabelProp ?? t('cancel');

	useSyncDesktopThemeFromMain(open, portalSurfaceRef);

	const resolvedBackdrop = backdropClassName ?? DESKTOP_OVERLAY.backdrop;

	const ctrl = useUnifiedContentPickerController({
		enabled: open,
		baseListParams: mergedBase,
		allowedContentTypes,
		multiSelect,
		maxFiles,
	});

	const confirmNode = confirmLabel ?? (
		<>
			<ClipboardDocumentCheckIcon className="h-4 w-4" aria-hidden />
			{t('confirm', { count: ctrl.selectedIds.length })}
		</>
	);

	const handleToggle = (id: string) => {
		ctrl.toggleId(id, onMaxSelection);
	};

	const handleConfirm = () => {
		const raw = ctrl.selectedItems;
		if (raw.length === 0) {
			return;
		}
		onConfirm(stripPickerItemMeta(raw));
		ctrl.clearSelection();
		onClose();
	};

	const handleCancel = () => {
		ctrl.clearSelection();
		onClose();
	};

	const isBusy =
		ctrl.query.isPending ||
		(ctrl.query.isFetching && !ctrl.query.data?.items?.length);

	const strippedSelection = stripPickerItemMeta(ctrl.selectedItems);
	const primary = strippedSelection[0] ?? null;

	const panel = (
		<UnifiedContentPickerPanel
			compact={compact}
			embedded
			hideTopHeader
			filteredItems={ctrl.filteredItems}
			isLoading={isBusy}
			isFetching={ctrl.query.isFetching}
			isError={ctrl.query.isError}
			errorMessage={
				ctrl.query.error instanceof Error
					? ctrl.query.error.message
					: String(ctrl.query.error ?? '')
			}
			onRetry={() => void ctrl.query.refetch()}
			searchQuery={ctrl.searchQuery}
			onSearchChange={ctrl.setSearchQuery}
			searchPending={ctrl.searchPending}
			showTypeFilter={!hideTypeFilter}
			filterType={ctrl.filterType}
			onFilterTypeChange={ctrl.setFilterType}
			availableTypes={ctrl.availableTypes}
			multiSelect={multiSelect}
			maxFiles={maxFiles}
			selectedIds={ctrl.selectedIds}
			onToggleId={handleToggle}
			onSelectAllVisible={ctrl.selectAllVisible}
			onDeselectAll={ctrl.deselectAll}
			onConfirm={handleConfirm}
			onCancel={handleCancel}
			showFooter={!useSplit}
			cancelLabel={resolvedCancel}
			confirmLabel={confirmLabel}
		/>
	);

	const splitBody = useSplit ? (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 md:flex-row">
			<div className="min-h-[min(40vh,280px)] min-w-0 flex-1 md:min-h-0">
				{panel}
			</div>
			<div className="flex w-full shrink-0 flex-col border-t border-(--desktop-border-subtle) md:w-72 md:border-l md:border-t-0">
				<div className="min-h-[200px] flex-1 overflow-auto p-3">
					{renderSidePreview?.(primary) ?? null}
				</div>
			</div>
		</div>
	) : null;

	if (!open || typeof document === 'undefined') {
		return null;
	}

	const computedPickerPortalZ =
		portalStackBase + DESKTOP_PORTAL_STACK_BUMP.UNIFIED_CONTENT_PICKER_PORTAL;
	const portalRootZ =
		portalZIndex != null ? portalZIndex : computedPickerPortalZ;

	return (
		<ShellPortalMount layer="embedded_modal_backdrop">
			<div
				ref={portalSurfaceRef}
				className={cn(
					'fixed inset-0 flex items-center justify-center p-4',
					'text-(--desktop-text-primary)',
					resolvedBackdrop
				)}
				style={{ zIndex: portalRootZ }}
				role="presentation"
			>
				<button
					type="button"
					className="absolute inset-0 cursor-default border-0 bg-transparent"
					aria-label={resolvedCancel}
					onClick={handleCancel}
				/>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: modal content stops backdrop close */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only stopPropagation; focus stays inside frame */}
				<div
					className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-4xl min-h-0 flex-col"
					onClick={(e) => e.stopPropagation()}
				>
					<DesktopAppModalFrame
						title={title ?? t('title')}
						onClose={handleCancel}
						closeLabel={resolvedCancel}
						className={cn(
							'flex max-h-[min(92vh,880px)] min-h-[min(70vh,620px)] max-w-4xl flex-col shadow-(--desktop-shadow-panel)',
							frameClassName
						)}
					>
						<div className="flex min-h-0 flex-1 flex-col">
							{layout === 'split' && renderSidePreview ? (
								<>
									{splitBody}
									<div className="flex shrink-0 items-center justify-end gap-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
										<DesktopAppButton
											type="button"
											variant="neutral"
											onClick={handleCancel}
										>
											{resolvedCancel}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant="accent"
											disabled={ctrl.selectedIds.length === 0}
											className="gap-2"
											onClick={handleConfirm}
										>
											{confirmNode}
										</DesktopAppButton>
									</div>
								</>
							) : (
								panel
							)}
						</div>
					</DesktopAppModalFrame>
				</div>
			</div>
		</ShellPortalMount>
	);
}
