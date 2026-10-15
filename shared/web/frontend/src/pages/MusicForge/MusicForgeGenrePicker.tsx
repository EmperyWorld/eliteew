/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Genre quick-pick chips for MusicForge create form (maps to style_hint).
 *
 * Related:
 * - musicForgeGenrePresets.ts, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import { DesktopAppSectionLabel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { MUSIC_FORGE_GENRE_QUICK_PRESETS } from './musicForgeGenrePresets';

export type MusicForgeGenrePickerProps = {
	styleHint: string;
	onStyleHintChange: (value: string) => void;
	disabled?: boolean;
};

export function MusicForgeGenrePicker({
	styleHint,
	onStyleHintChange,
	disabled = false,
}: MusicForgeGenrePickerProps) {
	const { t } = useTranslation('desktopUi');
	const selected = styleHint.trim().toLowerCase();

	return (
		<div>
			<DesktopAppSectionLabel>
				{t('musicForge.form.genreLabel')}
			</DesktopAppSectionLabel>
			<p className="mb-2 text-xs leading-relaxed text-(--desktop-text-dim)">
				{t('musicForge.form.genreHint')}
			</p>
			<div
				className="flex flex-wrap gap-2"
				role="listbox"
				aria-label={t('musicForge.form.genreLabel')}
			>
				{MUSIC_FORGE_GENRE_QUICK_PRESETS.map((preset) => {
					const isSelected = selected === preset.style;
					return (
						<button
							key={preset.style}
							type="button"
							disabled={disabled}
							role="option"
							aria-selected={isSelected}
							className={cn(
								'rounded-full border px-3 py-1.5 text-xs font-medium transition',
								isSelected
									? 'border-fuchsia-300/60 bg-fuchsia-500/25 text-fuchsia-50 shadow-sm shadow-fuchsia-950/30'
									: 'border-white/15 bg-black/20 text-(--desktop-text-secondary) hover:border-white/30 hover:bg-white/5'
							)}
							onClick={() => onStyleHintChange(isSelected ? '' : preset.style)}
						>
							{t(preset.labelKey)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
