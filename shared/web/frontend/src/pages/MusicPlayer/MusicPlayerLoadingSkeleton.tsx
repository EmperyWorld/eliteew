/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the Music Player catalog loading skeleton for list and grid layouts.
 *
 * Invariants:
 * - Skeleton geometry follows the active density and view mode.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerPageConstants.ts
 */

import { cn } from '@/lib/utils';
import {
	MUSIC_GRID_SKELETON_KEYS,
	MUSIC_ROW_SKELETON_KEYS,
	type TrackListDensity,
	type TrackListViewMode,
} from './musicPlayerPageConstants';

export interface MusicPlayerLoadingSkeletonProps {
	viewMode: TrackListViewMode;
	density: TrackListDensity;
}

export function MusicPlayerLoadingSkeleton({
	viewMode,
	density,
}: MusicPlayerLoadingSkeletonProps) {
	if (viewMode === 'grid') {
		return (
			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{MUSIC_GRID_SKELETON_KEYS.map((skeletonKey) => (
					<div
						key={skeletonKey}
						className="animate-pulse overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
					>
						<div className="aspect-square bg-(--desktop-surface-panel)" />
						<div className="space-y-2 p-2.5">
							<div className="h-3 w-3/4 rounded bg-(--desktop-surface-panel)" />
							<div className="h-2.5 w-1/2 rounded bg-(--desktop-surface-panel)" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{MUSIC_ROW_SKELETON_KEYS.map((skeletonKey) => (
				<div
					key={skeletonKey}
					className={cn(
						'animate-pulse rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
						density === 'dense' ? 'p-2' : 'p-2.5'
					)}
				>
					<div className="flex items-center gap-3">
						<div className="h-4 w-5 rounded bg-(--desktop-surface-panel)" />
						<div
							className={cn(
								'shrink-0 rounded-(--desktop-radius) bg-(--desktop-surface-panel)',
								density === 'dense' ? 'h-9 w-9' : 'h-10 w-10'
							)}
						/>
						<div className="min-w-0 flex-1 space-y-2">
							<div className="h-3 w-2/3 rounded bg-(--desktop-surface-panel)" />
							<div className="h-2.5 w-1/3 rounded bg-(--desktop-surface-panel)" />
						</div>
						<div className="h-3 w-12 rounded bg-(--desktop-surface-panel)" />
					</div>
				</div>
			))}
		</div>
	);
}
