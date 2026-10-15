/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Language quick-pick chips for MusicForge create form (mobile parity).
 *
 * Related:
 * - MusicForgeCreatePanel.tsx, musicForgeApi capabilities.languages
 */

import { useTranslation } from 'react-i18next';
import { DesktopAppSectionLabel } from '@/pages/Desktop/components/DesktopAppChrome';
import type { MusicForgeLanguage } from '@/services/musicForge/musicForgeApi';
import { cn } from '@/utils/cn';

export type MusicForgeLanguagePickerProps = {
	language: MusicForgeLanguage;
	onLanguageChange: (value: MusicForgeLanguage) => void;
	languages: Array<{ value: MusicForgeLanguage; label_ru: string }>;
	resolveLanguageLabel: (value: MusicForgeLanguage, fallback: string) => string;
	disabled?: boolean;
};

export function MusicForgeLanguagePicker({
	language,
	onLanguageChange,
	languages,
	resolveLanguageLabel,
	disabled = false,
}: MusicForgeLanguagePickerProps) {
	const { t } = useTranslation('desktopUi');

	if (languages.length === 0) return null;

	return (
		<div>
			<DesktopAppSectionLabel>
				{t('musicForge.form.languageLabel')}
			</DesktopAppSectionLabel>
			<div
				className="flex flex-wrap gap-2"
				role="listbox"
				aria-label={t('musicForge.form.languageLabel')}
			>
				{languages.map((item) => {
					const selected = language === item.value;
					return (
						<button
							key={item.value}
							type="button"
							disabled={disabled}
							role="option"
							aria-selected={selected}
							className={cn(
								'rounded-full border px-3 py-1.5 text-xs font-medium transition',
								selected
									? 'border-sky-300/60 bg-sky-500/20 text-sky-50'
									: 'border-white/15 bg-black/20 text-(--desktop-text-secondary) hover:border-white/30 hover:bg-white/5'
							)}
							onClick={() => onLanguageChange(item.value)}
						>
							{resolveLanguageLabel(item.value, item.label_ru)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
