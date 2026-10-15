/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composed Files-tab chrome: search strip (stack + split rail) and re-exports for panel toolbar / wayfinding.
 *
 * Invariants:
 * - Search controls only; upload/ACL behavior stays in header actions and parent tab.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `contentManagerFilesChromeTokens.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchWithAutocomplete } from '@/components/UnifiedContent/components/SearchWithAutocomplete';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { CONTENT_MANAGER_FILES_CHROME } from '../contentManagerFilesChromeTokens';
import { ContentManagerFilesLeftRailSection } from './ContentManagerFilesLeftRailSection';

export type ContentManagerFilesSearchMode = 'keyword' | 'hybrid';

export type ContentManagerFilesSearchChromeProps = {
	searchQuery: string;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	searchMode: ContentManagerFilesSearchMode;
	setSearchMode: React.Dispatch<
		React.SetStateAction<ContentManagerFilesSearchMode>
	>;
	showAdvancedSearch: boolean;
	setShowAdvancedSearch: React.Dispatch<React.SetStateAction<boolean>>;
	/** Advanced search panel slot from parent (`ContentManagerPro`). */
	advancedSearchSlot?: React.ReactNode;
};

function ContentManagerFilesSearchModeToggle({
	searchMode,
	setSearchMode,
	compact = false,
}: Pick<
	ContentManagerFilesSearchChromeProps,
	'searchMode' | 'setSearchMode'
> & { compact?: boolean }): React.ReactElement {
	const { t } = useTranslation('contentManager');

	return (
		<fieldset
			className={cn(
				CONTENT_MANAGER_FILES_CHROME.segmentCluster,
				compact ? 'w-full' : 'shrink-0',
				'm-0 min-w-0'
			)}
			aria-label={t('files.searchMode.label')}
		>
			<DesktopAppButton
				type="button"
				size="sm"
				variant={searchMode === 'keyword' ? 'accent' : 'ghost'}
				className={cn('h-8 px-3 text-xs', compact && 'min-w-0 flex-1')}
				onClick={() => setSearchMode('keyword')}
				aria-pressed={searchMode === 'keyword'}
			>
				{t('files.searchMode.keyword')}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				size="sm"
				variant={searchMode === 'hybrid' ? 'accent' : 'ghost'}
				className={cn('h-8 px-3 text-xs', compact && 'min-w-0 flex-1')}
				onClick={() => setSearchMode('hybrid')}
				aria-pressed={searchMode === 'hybrid'}
			>
				{t('files.searchMode.hybrid')}
			</DesktopAppButton>
		</fieldset>
	);
}

/** Horizontal search strip for classic (non-split) Files layout. */
export function ContentManagerFilesStackSearchChrome({
	searchQuery,
	setSearchQuery,
	searchInputRef,
	searchMode,
	setSearchMode,
	advancedSearchSlot,
}: ContentManagerFilesSearchChromeProps): React.ReactElement {
	const { t } = useTranslation('contentManager');

	return (
		<>
			<div
				data-cm-guide="files-search-toolbar"
				className={CONTENT_MANAGER_FILES_CHROME.searchStrip}
			>
				<div className="relative min-w-0 w-full max-w-md flex-1 basis-full sm:basis-auto">
					<SearchWithAutocomplete
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder={t('files.searchPlaceholder')}
						inputRef={searchInputRef}
					/>
				</div>
				<ContentManagerFilesSearchModeToggle
					searchMode={searchMode}
					setSearchMode={setSearchMode}
				/>
			</div>
			{advancedSearchSlot}
		</>
	);
}

/** Search block inside split-layout left rail. */
export function ContentManagerFilesSplitSearchChrome({
	searchQuery,
	setSearchQuery,
	searchInputRef,
	searchMode,
	setSearchMode,
	advancedSearchSlot,
}: ContentManagerFilesSearchChromeProps): React.ReactElement {
	const { t } = useTranslation('contentManager');

	return (
		<div
			data-cm-guide="files-search-toolbar"
			className="min-w-0 shrink-0 divide-y divide-(--desktop-border-subtle)/60"
		>
			<ContentManagerFilesLeftRailSection>
				<fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0 m-0">
					<SearchWithAutocomplete
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder={t('files.searchPlaceholder')}
						inputRef={searchInputRef}
					/>
					<ContentManagerFilesSearchModeToggle
						searchMode={searchMode}
						setSearchMode={setSearchMode}
						compact
					/>
					{advancedSearchSlot}
				</fieldset>
			</ContentManagerFilesLeftRailSection>
		</div>
	);
}
