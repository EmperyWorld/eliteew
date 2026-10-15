/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-completion encouragement strip in the create column while result stays visible.
 *
 * Related:
 * - MusicForgeCreatePanel.tsx, MusicForgeApp.tsx
 */

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export type MusicForgeCompletedHintProps = {
	onStartNewSong: () => void;
};

export function MusicForgeCompletedHint({
	onStartNewSong,
}: MusicForgeCompletedHintProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div
			className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3"
			role="status"
			data-testid="music-forge-completed-hint"
		>
			<div className="flex items-start gap-3">
				<div className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-300/30 bg-black/20 text-emerald-100">
					<CheckCircleIcon className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-white">
						{t('musicForge.completedHint.title')}
					</p>
					<p className="mt-1 text-sm leading-relaxed text-(--desktop-text-secondary)">
						{t('musicForge.completedHint.subtitle')}
					</p>
					<DesktopAppButton
						type="button"
						variant="ghost"
						className="mt-3"
						onClick={onStartNewSong}
					>
						{t('musicForge.actions.newSong')}
					</DesktopAppButton>
				</div>
			</div>
		</div>
	);
}
