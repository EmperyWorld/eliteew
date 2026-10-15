/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-submit recap of chosen song settings before create CTA.
 *
 * Related:
 * - MusicForgeRunMetaChips.tsx, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import type { MusicForgeLanguage } from '@/services/musicForge/musicForgeApi';
import { MusicForgeRunMetaChips } from './MusicForgeRunMetaChips';
import type { MusicForgeVocal } from './musicForgeUiHelpers';

export type MusicForgeSubmitRecapProps = {
	vocal: MusicForgeVocal;
	styleHint: string;
	language: MusicForgeLanguage;
	durationSeconds: number;
	resolveLanguageLabel: (value: MusicForgeLanguage, fallback: string) => string;
};

export function MusicForgeSubmitRecap({
	vocal,
	styleHint,
	language,
	durationSeconds,
	resolveLanguageLabel,
}: MusicForgeSubmitRecapProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div
			className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3"
			data-testid="music-forge-submit-recap"
		>
			<p className="mb-2 text-xs font-medium text-(--desktop-text-secondary)">
				{t('musicForge.submitRecap.label')}
			</p>
			<MusicForgeRunMetaChips
				vocal={vocal}
				styleHint={styleHint}
				language={language}
				durationSeconds={durationSeconds}
				resolveLanguageLabel={(value) =>
					resolveLanguageLabel(value as MusicForgeLanguage, value)
				}
			/>
		</div>
	);
}
