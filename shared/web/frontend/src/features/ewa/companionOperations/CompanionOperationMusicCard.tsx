/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Polished music result card for companion operation runs (U4 music card) — cover, title, play actions.
 *
 * Invariants:
 * - Playback dispatches existing `music_play_track` actions only; no new HTTP endpoints.
 * - Thumbnail load failures degrade to a neutral note icon without breaking play.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md §U4
 */

import { MusicalNoteIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OperationReadyTrack } from '@/features/ewa/companionOperations/companionOperationsUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionOperationMusicCardProps = {
	track: OperationReadyTrack;
	variant?: 'compact' | 'full';
	onPlayTrack: (action: CompanionChatAction) => void;
	playPrompt?: string | null;
	onDraftPlayPrompt?: (text: string) => void;
};

export function buildMusicPlayTrackAction(
	track: OperationReadyTrack
): CompanionChatAction {
	return {
		type: 'music_play_track',
		unified_content_id: track.unifiedContentId,
		track_name: track.trackName,
		...(track.thumbnailUrl ? { thumbnail_url: track.thumbnailUrl } : {}),
	};
}

function MusicCoverArt({
	track,
	compact,
}: {
	track: OperationReadyTrack;
	compact: boolean;
}) {
	const { t } = useTranslation('marketing');
	const [thumbFailed, setThumbFailed] = useState(false);
	const displayName =
		track.trackName.trim() || t('ewaCompanion.operationTrackUntitled');
	const sizeClass = compact ? 'size-10' : 'size-14';

	if (track.thumbnailUrl && !thumbFailed) {
		return (
			<img
				src={track.thumbnailUrl}
				alt={t('ewaCompanion.operationsMusicCoverAlt', { name: displayName })}
				className={cn(
					sizeClass,
					'shrink-0 rounded-md border border-emerald-500/30 object-cover'
				)}
				loading="lazy"
				decoding="async"
				onError={() => setThumbFailed(true)}
			/>
		);
	}

	return (
		<div
			className={cn(
				sizeClass,
				'flex shrink-0 items-center justify-center rounded-md border border-emerald-500/30',
				'bg-emerald-500/10 text-emerald-200'
			)}
			aria-hidden
		>
			<MusicalNoteIcon className={compact ? 'size-4' : 'size-5'} />
		</div>
	);
}

export function CompanionOperationMusicCard({
	track,
	variant = 'full',
	onPlayTrack,
	playPrompt,
	onDraftPlayPrompt,
}: CompanionOperationMusicCardProps) {
	const { t } = useTranslation('marketing');
	const compact = variant === 'compact';
	const displayName =
		track.trackName.trim() || t('ewaCompanion.operationTrackUntitled');

	const handlePlayNow = () => {
		onPlayTrack(buildMusicPlayTrackAction(track));
	};

	return (
		<section
			className={cn(
				'flex min-w-0 items-start gap-2 rounded-md border border-emerald-500/35',
				'bg-emerald-500/8',
				compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
			)}
			aria-label={t('ewaCompanion.operationsMusicCardAria', {
				name: displayName,
			})}
			data-testid="ewa-companion-operation-music-card"
		>
			<MusicCoverArt track={track} compact={compact} />
			<div className="min-w-0 flex-1 space-y-1">
				<p
					className={cn(
						'font-medium text-emerald-100',
						compact ? 'truncate text-[11px]' : 'text-[12px] leading-snug'
					)}
				>
					{displayName}
				</p>
				{compact ? (
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-emerald-500/50 px-2 py-0.5',
							'bg-emerald-500/10 text-[10px] text-emerald-100 hover:bg-emerald-500/20',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={handlePlayNow}
						aria-label={t('ewaCompanion.operationsPlayReadyTrackNow')}
					>
						<PlayIcon className="size-3" aria-hidden />
						<span>{t('ewaCompanion.operationsPlayReadyTrackNow')}</span>
					</button>
				) : (
					<div className="flex flex-wrap items-center gap-1">
						<button
							type="button"
							className={cn(
								'inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/50 px-2 py-1',
								'bg-emerald-500/10 text-[11px] text-emerald-100 hover:bg-emerald-500/20',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={handlePlayNow}
							aria-label={t('ewaCompanion.operationsPlayReadyTrackNow')}
						>
							<PlayIcon className="size-3" aria-hidden />
							<span className="truncate">
								{t('ewaCompanion.operationsPlayReadyTrackNow')}
							</span>
						</button>
						{playPrompt && onDraftPlayPrompt ? (
							<button
								type="button"
								className={cn(
									'inline-flex max-w-full items-center rounded-md border border-(--companion-divider) px-2 py-1',
									'text-[11px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() => onDraftPlayPrompt(playPrompt)}
								aria-label={t('ewaCompanion.operationsPlayReadyTrack')}
							>
								<span className="truncate">
									{t('ewaCompanion.operationsPlayReadyTrack')}
								</span>
							</button>
						) : null}
					</div>
				)}
			</div>
		</section>
	);
}
