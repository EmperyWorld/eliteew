/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Icon-only vertical toolbar for collapsed Content Manager left rail.
 *
 * Related:
 * - ContentManagerHeaderActions.tsx · DesktopExplorerCollapsibleRail.tsx
 */

import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CubeIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopExplorerRailIconButton } from '@/pages/Desktop/components/desktopExplorerRailUi';

export type ContentManagerRailCollapsedToolbarProps = {
	fetchContent: () => void | Promise<void>;
	loading: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	uploading: boolean;
	onDownloadOwnedArchive: () => void;
	downloadingOwnedArchive: boolean;
	statsLoading: boolean;
	ownedFilesCount: number;
	showAdvancedSearch: boolean;
	onToggleAdvancedSearch: () => void;
	onExpandRail?: () => void;
};

export function ContentManagerRailCollapsedToolbar({
	fetchContent,
	loading,
	fileInputRef,
	uploading,
	onDownloadOwnedArchive,
	downloadingOwnedArchive,
	statsLoading,
	ownedFilesCount,
	showAdvancedSearch,
	onToggleAdvancedSearch,
	onExpandRail,
}: ContentManagerRailCollapsedToolbarProps): React.JSX.Element {
	const { t } = useTranslation('contentManager');

	return (
		<>
			<DesktopExplorerRailIconButton
				title={t('files.toolbar.refresh')}
				ariaLabel={t('files.toolbar.refresh')}
				disabled={loading}
				onClick={() => void fetchContent()}
			>
				<ArrowPathIcon
					className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
					aria-hidden
				/>
			</DesktopExplorerRailIconButton>
			<DesktopExplorerRailIconButton
				title={t('files.toolbar.upload')}
				ariaLabel={t('files.toolbar.uploadAria')}
				disabled={uploading}
				accent
				onClick={() => fileInputRef.current?.click()}
			>
				{uploading ? (
					<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
				) : (
					<ArrowUpTrayIcon className="h-4 w-4" aria-hidden />
				)}
			</DesktopExplorerRailIconButton>
			<DesktopExplorerRailIconButton
				title={t('files.toolbar.downloadOwnedArchiveAria')}
				ariaLabel={t('files.toolbar.downloadOwnedArchiveAria')}
				disabled={
					downloadingOwnedArchive || statsLoading || ownedFilesCount === 0
				}
				onClick={onDownloadOwnedArchive}
			>
				{downloadingOwnedArchive ? (
					<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
				) : (
					<CubeIcon className="h-4 w-4" aria-hidden />
				)}
			</DesktopExplorerRailIconButton>
			<DesktopExplorerRailIconButton
				title={t('advancedSearch.toggle')}
				ariaLabel={t('advancedSearch.toggle')}
				active={showAdvancedSearch}
				onClick={() => {
					onExpandRail?.();
					onToggleAdvancedSearch();
				}}
			>
				<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
			</DesktopExplorerRailIconButton>
		</>
	);
}
