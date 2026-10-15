/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Breadcrumb-style path for the Content Manager Files tab across catalog, explorer, and all-files scopes.
 *
 * Invariants:
 * - Explorer scope is the only mode that appends the current desktop folder context.
 * - Compact rail mode must stay usable inside embedded split layout.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `contentManagerFilesChromeTokens.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import type { FilesBrowseMode } from '../contentManagerTypes';
import { CONTENT_MANAGER_FILES_CHROME } from '../contentManagerFilesChromeTokens';

export type ContentManagerFilesWayfindingProps = {
	filesBrowseMode: FilesBrowseMode;
	explorerContextPlaceLabel: string;
	/** Узкая левая колонка: без нижнего отступа, чуть плотнее. */
	railMode?: boolean;
};

export function ContentManagerFilesWayfinding({
	filesBrowseMode,
	explorerContextPlaceLabel,
	railMode = false,
}: ContentManagerFilesWayfindingProps): React.ReactElement {
	const { t } = useTranslation('contentManager');

	const scopeLabel =
		filesBrowseMode === 'explorer'
			? t('files.browseMode.explorer')
			: filesBrowseMode === 'all_files'
				? t('files.browseMode.allFiles')
				: t('files.browseMode.catalog');

	return (
		<nav
			className={cn(
				CONTENT_MANAGER_FILES_CHROME.wayfindingStrip,
				railMode && 'mb-0 py-0.5 text-[10px]'
			)}
			aria-label={t('files.wayfinding.navLabel')}
		>
			<span className={CONTENT_MANAGER_FILES_CHROME.wayfindingCurrent}>
				{t('tabs.files')}
			</span>
			<span
				aria-hidden
				className={CONTENT_MANAGER_FILES_CHROME.wayfindingSeparator}
			>
				/
			</span>
			<span className={CONTENT_MANAGER_FILES_CHROME.wayfindingCrumb}>
				{scopeLabel}
			</span>
			{filesBrowseMode === 'explorer' ? (
				<>
					<span
						aria-hidden
						className={CONTENT_MANAGER_FILES_CHROME.wayfindingSeparator}
					>
						/
					</span>
					<span
						className={cn(
							CONTENT_MANAGER_FILES_CHROME.wayfindingCrumb,
							'max-w-[min(100%,14rem)] font-medium'
						)}
					>
						{explorerContextPlaceLabel}
					</span>
				</>
			) : null}
		</nav>
	);
}
