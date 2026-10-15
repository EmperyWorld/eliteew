/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual playback hero for completed MusicForge result (desktop player handoff).
 *
 * Related:
 * - MusicForgeResultCard.tsx
 */

import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export type MusicForgeResultPlaybackHeroProps = {
	trackName: string;
	loading?: boolean;
};

export function MusicForgeResultPlaybackHero({
	trackName,
	loading = false,
}: MusicForgeResultPlaybackHeroProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div
			className="mb-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-linear-to-r from-fuchsia-500/15 via-black/25 to-amber-500/10 px-4 py-3"
			data-testid="music-forge-result-playback-hero"
		>
			<div
				className="grid size-14 shrink-0 place-items-center rounded-2xl border border-fuchsia-300/25 bg-linear-to-br from-fuchsia-500/25 to-amber-400/15 text-fuchsia-100 shadow-lg shadow-fuchsia-950/20"
				aria-hidden
			>
				<MusicalNoteIcon className="size-7" />
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-semibold text-white">{trackName}</p>
				<p className="mt-0.5 text-xs leading-relaxed text-(--desktop-text-secondary)">
					{loading
						? t('musicForge.result.audioLoading')
						: t('musicForge.result.playsInDesktopPlayer')}
				</p>
			</div>
		</div>
	);
}
