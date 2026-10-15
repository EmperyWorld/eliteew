/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Leading icons + query highlight for Quick Search launcher rows (P23 extract).
 *
 * Invariants:
 * - App rows use DesktopAppBadge; folder/file fall back to Heroicons.
 *
 * Related:
 * - QuickSearchResultsBody.tsx
 * - utils/desktopVisualSystem.ts
 */

import type * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { DesktopIconStyle } from '@/types/profile';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import type { DesktopItem, RecentFile } from '../../types/desktop.types';
import { DocumentTextIcon, FolderIcon } from '@heroicons/react/24/outline';

export function getQuickSearchItemIcon(item: DesktopItem): React.ReactNode {
	if (item.icon) return item.icon;
	if (item.type === 'folder') return <FolderIcon className="w-full h-full" />;
	if (item.type === 'file')
		return <DocumentTextIcon className="w-full h-full" />;
	return null;
}

export function renderQuickSearchLauncherLeadingIcon(
	item: DesktopItem,
	iconStyle: DesktopIconStyle
): React.ReactNode {
	if (item.type === 'app') {
		return (
			<DesktopAppBadge
				appComponent={item.appComponent}
				icon={item.icon ?? undefined}
				variant="list"
				iconStyle={iconStyle}
				className="h-10 w-10 shrink-0"
			/>
		);
	}
	return (
		<div
			className={`w-10 h-10 rounded-lg shrink-0 bg-linear-to-br ${item.gradient || 'from-[rgb(var(--desktop-bg-secondary-rgb))] to-[rgb(var(--desktop-border-rgb))]'} p-2 flex items-center justify-center`}
		>
			{getQuickSearchItemIcon(item)}
		</div>
	);
}

export function renderQuickSearchRecentFileLeadingIcon(
	file: RecentFile
): React.ReactNode {
	return (
		<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--desktop-surface-soft) p-2">
			{file.type === 'project' ? (
				<FolderIcon className="h-full w-full text-(--desktop-text-muted)" />
			) : (
				<DocumentTextIcon className="h-full w-full text-(--desktop-text-muted)" />
			)}
		</div>
	);
}

export function highlightQuickSearchMatch(
	text: string,
	searchQuery: string
): React.ReactNode {
	if (!searchQuery) return text;

	const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
	let sliceStart = 0;
	return (
		<>
			{parts.map((part) => {
				const key = `h-${sliceStart}`;
				sliceStart += part.length;
				return part.toLowerCase() === searchQuery.toLowerCase() ? (
					<span key={key} className={DESKTOP_TYPOGRAPHY.matchHighlight}>
						{part}
					</span>
				) : (
					<span key={key}>{part}</span>
				);
			})}
		</>
	);
}
