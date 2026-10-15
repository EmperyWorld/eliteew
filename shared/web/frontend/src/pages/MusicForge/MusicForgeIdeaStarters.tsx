/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick idea starter chips when the create form idea field is empty.
 *
 * Related:
 * - musicForgeIdeaPresets.ts, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import { DesktopAppSectionLabel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { MUSIC_FORGE_IDEA_STARTER_PRESETS } from './musicForgeIdeaPresets';

export type MusicForgeIdeaStartersProps = {
	onPickIdea: (idea: string) => void;
	disabled?: boolean;
};

export function MusicForgeIdeaStarters({
	onPickIdea,
	disabled = false,
}: MusicForgeIdeaStartersProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div data-testid="music-forge-idea-starters">
			<DesktopAppSectionLabel>
				{t('musicForge.ideaStarters.label')}
			</DesktopAppSectionLabel>
			<p className="mb-2 text-xs leading-relaxed text-(--desktop-text-dim)">
				{t('musicForge.ideaStarters.hint')}
			</p>
			<div className="flex flex-wrap gap-2">
				{MUSIC_FORGE_IDEA_STARTER_PRESETS.map((preset) => (
					<button
						key={preset.id}
						type="button"
						disabled={disabled}
						className={cn(
							'rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-left text-xs font-medium text-(--desktop-text-secondary) transition',
							'hover:border-fuchsia-300/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-50'
						)}
						onClick={() => onPickIdea(t(preset.ideaKey))}
					>
						{t(preset.labelKey)}
					</button>
				))}
			</div>
		</div>
	);
}
