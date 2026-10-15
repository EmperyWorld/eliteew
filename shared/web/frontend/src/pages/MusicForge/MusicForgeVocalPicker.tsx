/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lead vocal quick-pick for MusicForge create form.
 *
 * Related:
 * - musicForgeUiHelpers.ts, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import { DesktopAppSectionLabel } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	MUSIC_FORGE_VOCAL_OPTIONS,
	type MusicForgeVocal,
} from './musicForgeUiHelpers';

export type MusicForgeVocalPickerProps = {
	vocal: MusicForgeVocal;
	onVocalChange: (value: MusicForgeVocal) => void;
	disabled?: boolean;
};

export function MusicForgeVocalPicker({
	vocal,
	onVocalChange,
	disabled = false,
}: MusicForgeVocalPickerProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div>
			<DesktopAppSectionLabel>
				{t('musicForge.form.vocalLabel')}
			</DesktopAppSectionLabel>
			<div
				className="flex flex-wrap gap-2"
				role="listbox"
				aria-label={t('musicForge.form.vocalLabel')}
			>
				{MUSIC_FORGE_VOCAL_OPTIONS.map((option) => {
					const selected = vocal === option;
					return (
						<button
							key={option}
							type="button"
							disabled={disabled}
							role="option"
							aria-selected={selected}
							className={cn(
								'rounded-full border px-3 py-1.5 text-xs font-medium transition',
								selected
									? 'border-amber-300/60 bg-amber-500/20 text-amber-50'
									: 'border-white/15 bg-black/20 text-(--desktop-text-secondary) hover:border-white/30 hover:bg-white/5'
							)}
							onClick={() => onVocalChange(option)}
						>
							{t(`musicForge.vocals.${option}`)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
