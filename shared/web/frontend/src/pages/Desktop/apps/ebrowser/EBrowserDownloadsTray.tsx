/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact EBrowser downloads tray + open account Downloads CTA.
 */

import { cn } from '@/utils/cn';
import type { ReactElement } from 'react';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ebrowserDownloadStatusCopy,
	type EBrowserDownloadItem,
} from '@/features/ebrowser/ebrowserNative';
import { requestOpenEBrowserDownloadsLibrary } from '@/features/ebrowser/ebrowserOpenDownloads';
import { ebrowserDownloadsOpenTarget } from '@/features/ebrowser/ebrowserEmpiieros';

export function EBrowserDownloadsTray(props: {
	downloads: EBrowserDownloadItem[];
	label: string;
	openLabel: string;
	/** EmpiierOS: notice only. Tauri keeps the Content Manager library. */
	host?: 'tauri' | 'empiieros';
	onSeatLocal?: () => void;
}): ReactElement | null {
	if (props.downloads.length === 0) return null;
	const downloadsHost = props.host ?? 'tauri';
	const showOpen = props.downloads.some(
		(d) =>
			d.phase === 'library' || d.phase === 'ingesting' || d.phase === 'progress'
	);
	return (
		<div className="flex shrink-0 flex-col gap-1 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-3 py-2">
			<ul
				className="flex flex-col gap-1"
				aria-live="polite"
				aria-label={props.label}
			>
				{props.downloads.map((d) => (
					<li
						key={d.id}
						className={cn(
							'truncate text-(--desktop-text-secondary)',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
						title={ebrowserDownloadStatusCopy(d)}
					>
						{ebrowserDownloadStatusCopy(d)}
						{d.phase === 'progress' || d.phase === 'ingesting'
							? ` · ${Math.round(d.progress * 100)}%`
							: ''}
					</li>
				))}
			</ul>
			{showOpen ? (
				<div>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							if (
								ebrowserDownloadsOpenTarget(downloadsHost) ===
								'seat_local_notice'
							) {
								props.onSeatLocal?.();
								return;
							}
							requestOpenEBrowserDownloadsLibrary();
						}}
					>
						{props.openLabel}
					</DesktopAppButton>
				</div>
			) : null}
		</div>
	);
}
