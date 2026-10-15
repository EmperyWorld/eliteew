/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Paginated footer for catalog/explorer file lists (hidden in all_files browse mode).
 *
 * Invariants:
 * - Page bounds clamp to [1, totalPages].
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `useContentList.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import type { FilesBrowseMode } from '../contentManagerTypes';
import { FILES_PAGE_SIZE } from '../hooks/useContentList';

export type ContentManagerFilesPaginationProps = {
	loading: boolean;
	totalItems: number;
	currentPage: number;
	filesBrowseMode: FilesBrowseMode;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
};

export function ContentManagerFilesPagination({
	loading,
	totalItems,
	currentPage,
	filesBrowseMode,
	setCurrentPage,
}: ContentManagerFilesPaginationProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');

	if (loading || totalItems <= 0 || filesBrowseMode === 'all_files') {
		return null;
	}

	const totalPages = Math.max(1, Math.ceil(totalItems / FILES_PAGE_SIZE));
	const from = (currentPage - 1) * FILES_PAGE_SIZE + 1;
	const to = Math.min(currentPage * FILES_PAGE_SIZE, totalItems);

	return (
		<div className="mt-4 flex items-center justify-between gap-4 border-t border-(--desktop-border-subtle) px-2 py-4 text-sm text-(--desktop-text-muted) antialiased">
			<span className="tabular-nums">
				{t('files.pagination.range', {
					from,
					to,
					total: totalItems,
				})}
			</span>
			<div className="flex items-center gap-3">
				<span className="tabular-nums text-(--desktop-text-dim)">
					{t('files.pagination.pageOf', {
						page: currentPage,
						totalPages,
					})}
				</span>
				<DesktopAppButton
					type="button"
					onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
					disabled={currentPage <= 1}
					variant="neutral"
					size="icon"
					className="h-10 w-10 text-(--desktop-text-secondary)"
					aria-label={t('files.pagination.prev')}
				>
					<ChevronLeftIcon className="w-4 h-4" />
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
					disabled={currentPage >= totalPages}
					variant="neutral"
					size="icon"
					className="h-10 w-10 text-(--desktop-text-secondary)"
					aria-label={t('files.pagination.next')}
				>
					<ChevronRightIcon className="w-4 h-4" />
				</DesktopAppButton>
			</div>
		</div>
	);
}
