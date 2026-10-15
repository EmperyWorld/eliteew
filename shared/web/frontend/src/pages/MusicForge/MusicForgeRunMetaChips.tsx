/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only recap chips for an active or completed MusicForge run (genre, vocal, language, duration).
 *
 * Related:
 * - musicForgeUiHelpers.ts, MusicForgeResultCard.tsx, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { MUSIC_FORGE_GENRE_QUICK_PRESETS } from './musicForgeGenrePresets';
import type { MusicForgeVocal } from './musicForgeUiHelpers';

export type MusicForgeRunMetaChipsProps = {
	vocal?: MusicForgeVocal | null;
	styleHint?: string | null;
	language?: string | null;
	durationSeconds?: number | null;
	resolveLanguageLabel?: (language: string) => string;
	className?: string;
};

function resolveGenreLabel(
	styleHint: string,
	t: (key: string) => string
): string {
	const normalized = styleHint.trim().toLowerCase();
	const preset = MUSIC_FORGE_GENRE_QUICK_PRESETS.find(
		(item) => item.style === normalized
	);
	if (preset) return t(preset.labelKey);
	return styleHint.trim();
}

export function MusicForgeRunMetaChips({
	vocal,
	styleHint,
	language,
	durationSeconds,
	resolveLanguageLabel,
	className,
}: MusicForgeRunMetaChipsProps) {
	const { t } = useTranslation('desktopUi');
	const chips: string[] = [];

	if (vocal) {
		chips.push(t(`musicForge.vocals.${vocal}`));
	}
	const genre = stringField(styleHint);
	if (genre) {
		chips.push(resolveGenreLabel(genre, t));
	}
	const lang = stringField(language);
	if (lang && lang !== 'auto') {
		const key = `musicForge.languages.${lang}`;
		const translated = t(key);
		chips.push(
			resolveLanguageLabel
				? resolveLanguageLabel(lang)
				: translated === key
					? lang
					: translated
		);
	}
	if (
		typeof durationSeconds === 'number' &&
		Number.isFinite(durationSeconds) &&
		durationSeconds > 0
	) {
		chips.push(t('musicForge.meta.durationChip', { seconds: durationSeconds }));
	}

	if (chips.length === 0) return null;

	return (
		<ul
			className={cn('flex flex-wrap gap-2', className)}
			aria-label={t('musicForge.meta.groupLabel')}
		>
			{chips.map((label) => (
				<li
					key={label}
					className="rounded-full border border-white/15 bg-black/25 px-2.5 py-0.5 text-xs font-medium text-(--desktop-text-secondary)"
				>
					{label}
				</li>
			))}
		</ul>
	);
}

function stringField(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}
