/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Footer for «Все файлы» cursor paging: loaded count vs library total and explicit load-more.
 *
 * Invariants:
 * - Hidden while initial load is in progress or library is empty.
 *
 * Related:
 * - `useContentManagerAllFilesQuery.ts`
 * - `ContentManagerFilesTab.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';

export type ContentManagerAllFilesLoadMoreProps = {
	loading: boolean;
	loadingMore: boolean;
	loadedCount: number;
	totalItems: number;
	hasMore: boolean;
	onLoadMore: () => void | Promise<void>;
};

export function ContentManagerAllFilesLoadMore({
	loading,
	loadingMore,
	loadedCount,
	totalItems,
	hasMore,
	onLoadMore,
}: ContentManagerAllFilesLoadMoreProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');

	if (loading || totalItems <= 0) {
		return null;
	}

	return (
		<div className="mt-4 flex flex-col items-center gap-3 border-t border-(--desktop-border-subtle) px-2 py-4 text-sm text-(--desktop-text-muted) antialiased sm:flex-row sm:justify-between">
			<span className="tabular-nums text-center sm:text-left">
				{t('files.allFiles.loadedOfTotal', {
					loaded: loadedCount,
					total: totalItems,
				})}
			</span>
			{hasMore ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className="min-w-40"
					disabled={loadingMore}
					onClick={() => void onLoadMore()}
				>
					{loadingMore
						? t('files.allFiles.loadingMore')
						: t('files.allFiles.loadMore')}
				</DesktopAppButton>
			) : loadedCount < totalItems ? (
				<span className="text-(--desktop-text-dim)">
					{t('files.allFiles.narrowHint')}
				</span>
			) : null}
		</div>
	);
}
