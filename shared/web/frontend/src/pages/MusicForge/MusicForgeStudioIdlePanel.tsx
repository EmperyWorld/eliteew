/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Idle-state journey panel for Song Studio before the first run starts.
 *
 * Related:
 * - MusicForgeApp.tsx, MusicForgeWorkflow.tsx
 */

import {
	MusicalNoteIcon,
	SparklesIcon,
	SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';

const JOURNEY_STEP_KEYS = [
	'musicForge.studioIdle.steps.idea',
	'musicForge.studioIdle.steps.craft',
	'musicForge.studioIdle.steps.listen',
] as const;

const JOURNEY_ICONS = [SparklesIcon, MusicalNoteIcon, SpeakerWaveIcon] as const;

export function MusicForgeStudioIdlePanel() {
	const { t } = useTranslation('desktopUi');

	return (
		<DesktopAppPanel
			className="space-y-5 p-5"
			data-testid="music-forge-studio-idle"
		>
			<div className="rounded-2xl border border-white/10 bg-linear-to-br from-fuchsia-500/10 via-black/10 to-amber-500/10 px-4 py-4">
				<p className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/75">
					{t('musicForge.studioIdle.eyebrow')}
				</p>
				<h2 className="mt-2 text-xl font-semibold text-white">
					{t('musicForge.studioIdle.title')}
				</h2>
				<p className="mt-2 max-w-xl text-sm leading-relaxed text-(--desktop-text-secondary)">
					{t('musicForge.studioIdle.subtitle')}
				</p>
			</div>

			<ol className="grid gap-3 sm:grid-cols-3">
				{JOURNEY_STEP_KEYS.map((key, index) => {
					const Icon = JOURNEY_ICONS[index];
					return (
						<li
							key={key}
							className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
						>
							<div className="mb-2 grid size-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-amber-100">
								<Icon className="size-5" />
							</div>
							<p className="text-sm font-semibold text-white">
								{t(`${key}.title`)}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-secondary)">
								{t(`${key}.body`)}
							</p>
						</li>
					);
				})}
			</ol>
		</DesktopAppPanel>
	);
}
