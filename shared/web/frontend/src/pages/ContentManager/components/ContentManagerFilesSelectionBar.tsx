/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk selection bar with download/copy/move/assign/delete actions above files grid.
 *
 * Invariants:
 * - Bulk actions disabled when selection is empty or batch job is in flight.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `contentManagerBulkEligibility.ts`
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	CubeIcon,
	DocumentDuplicateIcon,
	FolderIcon,
	LinkIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../Desktop/components/DesktopAppChrome';
import type { BulkEligibilityPartition } from '../utils/contentManagerBulkEligibility';
import type { ContentManagerSelectionCopy } from '../utils/contentManagerListUx';

export type ContentManagerFilesSelectionBarProps = {
	selectMode: boolean;
	loading: boolean;
	filteredItems: ContentItem[];
	selectedIds: ReadonlySet<string>;
	selectionCopy: ContentManagerSelectionCopy;
	bulkEligibility: BulkEligibilityPartition;
	selectAll: () => void;
	batchDownload: () => void | Promise<void>;
	batchDownloadLoading: boolean;
	batchCopy: () => void | Promise<void>;
	batchCopyLoading: boolean;
	batchMove?: () => void;
	batchDelete: () => void | Promise<void>;
	filterCompanyId: string | null;
	filterProjectId: string | null;
	setAssignCompanyId: React.Dispatch<React.SetStateAction<string>>;
	setAssignProjectId: React.Dispatch<React.SetStateAction<string>>;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	setAssignTenancyOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function ContentManagerFilesSelectionBar({
	selectMode,
	loading,
	filteredItems,
	selectedIds,
	selectionCopy,
	bulkEligibility,
	selectAll,
	batchDownload,
	batchDownloadLoading,
	batchCopy,
	batchCopyLoading,
	batchMove,
	batchDelete,
	filterCompanyId,
	filterProjectId,
	setAssignCompanyId,
	setAssignProjectId,
	refreshProjects,
	setAssignTenancyOpen,
}: ContentManagerFilesSelectionBarProps): React.ReactElement {
	const { t } = useTranslation('contentManager');

	return (
		<AnimatePresence>
			{selectMode ? (
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					className="flex shrink-0 flex-col gap-3 rounded-2xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) px-4 py-3 shadow-(--desktop-shadow-soft) sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-x-4">
						<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
							<DesktopAppButton
								type="button"
								onClick={selectAll}
								variant="accent"
								size="sm"
								className="gap-1.5 px-3"
								disabled={loading || filteredItems.length === 0}
							>
								{filteredItems.length > 0 &&
								selectedIds.size === filteredItems.length
									? t('files.selection.deselectAll')
									: t(selectionCopy.selectAllKey)}
							</DesktopAppButton>
							<span className="text-(--desktop-text-muted)">
								<Trans
									ns="contentManager"
									i18nKey="files.selection.count"
									values={{ count: selectedIds.size }}
									components={{
										bold: (
											<strong className="text-(--desktop-text-primary) tabular-nums" />
										),
									}}
								/>
							</span>
						</div>
						<p className="text-[11px] leading-snug text-(--desktop-text-dim) sm:max-w-88">
							{t(selectionCopy.bulkHintKey)}
						</p>
						{bulkEligibility.ineligible.length > 0 ? (
							<p className="text-[11px] leading-snug text-amber-200/90 sm:max-w-88">
								{t('files.selection.ineligibleHint', {
									count: bulkEligibility.ineligible.length,
								})}
							</p>
						) : null}
					</div>
					<div
						className={cn(
							'flex flex-wrap items-center gap-2',
							DESKTOP_APP_STYLE_CONTRACT.softCard,
							'p-1'
						)}
					>
						<DesktopAppButton
							onClick={batchDownload}
							variant="neutral"
							size="sm"
							className="gap-1.5 text-xs"
							disabled={selectedIds.size === 0 || batchDownloadLoading}
						>
							{batchDownloadLoading ? (
								<ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
							) : (
								<CubeIcon className="w-3.5 h-3.5" />
							)}
							{batchDownloadLoading
								? t('files.selection.zipPreparing')
								: t('files.selection.zip')}
						</DesktopAppButton>
						<DesktopAppButton
							onClick={batchCopy}
							variant="neutral"
							size="sm"
							className="gap-1.5 text-xs"
							disabled={selectedIds.size === 0 || batchCopyLoading}
						>
							{batchCopyLoading ? (
								<ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
							) : (
								<DocumentDuplicateIcon className="w-3.5 h-3.5" />
							)}
							{batchCopyLoading
								? t('files.selection.copyPreparing')
								: t('files.selection.copy')}
						</DesktopAppButton>
						{batchMove ? (
							<DesktopAppButton
								type="button"
								onClick={batchMove}
								variant="neutral"
								size="sm"
								className="gap-1.5 text-xs"
								disabled={selectedIds.size === 0}
							>
								<FolderIcon className="w-3.5 h-3.5" />
								{t('pro.bulkMove.open')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="button"
							onClick={() => {
								setAssignCompanyId(filterCompanyId ?? '');
								setAssignProjectId(filterProjectId ?? '');
								if (filterCompanyId) void refreshProjects(filterCompanyId);
								setAssignTenancyOpen(true);
							}}
							variant="neutral"
							size="sm"
							className="gap-1.5 text-xs"
							disabled={selectedIds.size === 0}
						>
							<LinkIcon className="w-3.5 h-3.5" />
							{t('pro.batchAssign.open')}
						</DesktopAppButton>
						<DesktopAppButton
							onClick={batchDelete}
							variant="ghost"
							size="sm"
							className="gap-1.5 border border-red-400/20 text-xs text-red-200/80 hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-50"
							disabled={selectedIds.size === 0}
						>
							<TrashIcon className="w-3.5 h-3.5" />
							{t('files.selection.delete')}
						</DesktopAppButton>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
