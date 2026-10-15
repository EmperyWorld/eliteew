/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive companion XL Base song launch wizard for theme/style/vocal/language selection.
 *
 * Invariants:
 * - Final generation is not executed in the browser; the component sends a structured prompt back to companion chat.
 * - Generated prompt must include #ewa_xl_base_interactive_start so backend parses selected slots deterministically.
 * - Choice groups expose visible headings as accessible group labels.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionOutputSurface.tsx
 * - api/ewa_platform/companion/orchestration/companion_music_xl_base.py
 */

import {
	MusicalNoteIcon,
	PaperAirplaneIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import {
	CompanionHeroCard,
	CompanionIconTile,
	CompanionPillBadge,
	CompanionPillButton,
} from '@/features/ewa/companionPremiumPrimitives';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Option = {
	id: string;
	label_ru?: string;
	label_en?: string;
};

type Props = {
	payload?: Record<string, unknown>;
	onBackToChat: () => void;
	onDraftPrompt: (text: string) => void;
	onSubmitPrompt: (text: string) => void | Promise<void>;
	submitting?: boolean;
};

const FALLBACK_STYLES: Option[] = [
	{ id: 'pop', label_ru: 'Поп', label_en: 'Pop' },
	{ id: 'rock', label_ru: 'Рок', label_en: 'Rock' },
	{ id: 'hip-hop', label_ru: 'Хип-хоп', label_en: 'Hip-hop' },
	{ id: 'electronic', label_ru: 'Электроника', label_en: 'Electronic' },
	{ id: 'dance', label_ru: 'Танцевальная', label_en: 'Dance' },
	{ id: 'ballad', label_ru: 'Баллада', label_en: 'Ballad' },
	{ id: 'luna', label_ru: 'Luna', label_en: 'Luna' },
];

const FALLBACK_VOCALS: Option[] = [
	{ id: 'female', label_ru: 'Женский вокал', label_en: 'Female vocal' },
	{ id: 'male', label_ru: 'Мужской вокал', label_en: 'Male vocal' },
	{ id: 'duet', label_ru: 'Дуэт', label_en: 'Duet' },
];

const FALLBACK_LANGUAGES: Option[] = [
	{ id: 'ru', label_ru: 'Русский', label_en: 'Russian' },
	{ id: 'en', label_ru: 'Английский', label_en: 'English' },
	{ id: 'es', label_ru: 'Испанский', label_en: 'Spanish' },
	{ id: 'de', label_ru: 'Немецкий', label_en: 'German' },
	{ id: 'fr', label_ru: 'Французский', label_en: 'French' },
];

function readString(payload: Record<string, unknown> | undefined, key: string) {
	const value = payload?.[key];
	return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readOptions(
	payload: Record<string, unknown> | undefined,
	key: string,
	fallback: Option[]
): Option[] {
	const value = payload?.[key];
	if (!Array.isArray(value)) return fallback;
	const options = value.flatMap((item): Option[] => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
		const rec = item as Record<string, unknown>;
		const id = typeof rec.id === 'string' ? rec.id.trim() : '';
		if (!id) return [];
		return [
			{
				id,
				label_ru:
					typeof rec.label_ru === 'string' && rec.label_ru.trim()
						? rec.label_ru.trim()
						: undefined,
				label_en:
					typeof rec.label_en === 'string' && rec.label_en.trim()
						? rec.label_en.trim()
						: undefined,
			},
		];
	});
	return options.length > 0 ? options : fallback;
}

function optionLabel(option: Option, ru: boolean): string {
	return (
		(ru ? option.label_ru : option.label_en) ||
		option.label_en ||
		option.label_ru ||
		option.id
	);
}

function ChoiceGroup({
	title,
	options,
	value,
	onChange,
	ru,
}: {
	title: string;
	options: Option[];
	value: string;
	onChange: (next: string) => void;
	ru: boolean;
}) {
	return (
		<fieldset className="space-y-1.5">
			<legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--companion-aura)">
				{title}
			</legend>
			<div className="flex flex-wrap gap-1">
				{options.map((option) => {
					const active = value === option.id;
					return (
						<CompanionPillButton
							key={option.id}
							className={cn(
								'px-2.5 py-1 text-[11px]',
								active
									? 'border-(--companion-aura) bg-(--companion-bg) text-white shadow-[0_0_18px_var(--companion-glow)]'
									: 'bg-white/5 hover:bg-white/10 hover:text-(--desktop-text-primary)'
							)}
							onClick={() => onChange(option.id)}
							aria-pressed={active}
						>
							{optionLabel(option, ru)}
						</CompanionPillButton>
					);
				})}
			</div>
		</fieldset>
	);
}

export function CompanionMusicXlBaseWizardMode({
	payload,
	onBackToChat,
	onDraftPrompt,
	onSubmitPrompt,
	submitting = false,
}: Props) {
	const { t, i18n } = useTranslation('marketing');
	const ru = (i18n.language || '').toLowerCase().startsWith('ru');
	const styles = useMemo(
		() => readOptions(payload, 'style_options', FALLBACK_STYLES),
		[payload]
	);
	const vocals = useMemo(
		() => readOptions(payload, 'vocal_options', FALLBACK_VOCALS),
		[payload]
	);
	const languages = useMemo(
		() => readOptions(payload, 'language_options', FALLBACK_LANGUAGES),
		[payload]
	);
	const [theme, setTheme] = useState(readString(payload, 'initial_theme'));
	const [style, setStyle] = useState(
		readString(payload, 'default_style') || styles[0]?.id || 'pop'
	);
	const [vocal, setVocal] = useState(
		readString(payload, 'default_vocal') || vocals[0]?.id || 'female'
	);
	const [language, setLanguage] = useState(
		readString(payload, 'default_language') || languages[0]?.id || 'ru'
	);
	const trimmedTheme = theme.trim();
	const prompt = [
		t('ewaCompanion.musicXlBaseWizardLaunchPromptHeader'),
		'#ewa_xl_base_interactive_start',
		`Тема: ${trimmedTheme}`,
		`Стиль: ${style}`,
		`Вокал: ${vocal}`,
		`Язык: ${language}`,
	].join('\n');
	const canSubmit = trimmedTheme.length >= 4 && !submitting;
	const wizardStep =
		trimmedTheme.length >= 4 ? (language ? 4 : vocal ? 3 : style ? 2 : 1) : 1;

	return (
		<CompanionSurfacePanel
			title=""
			onBack={onBackToChat}
			backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
			testId="ewa-companion-music-xl-base-wizard"
			footer={
				<div className="sticky bottom-0 z-10 border-t border-(--companion-divider)/50 bg-(--companion-bg)/95 pt-2 backdrop-blur-sm">
					<p className="mb-2 text-[10px] text-(--companion-text-soft)">
						{t('ewaCompanion.musicXlBaseWizardStepOf', {
							current: wizardStep,
							total: 4,
						})}
					</p>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-[11px] text-(--companion-text-soft)">
							{t('ewaCompanion.musicXlBaseWizardFooterHint')}
						</p>
						<div className="flex flex-wrap items-center gap-1.5">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								disabled={!trimmedTheme}
								onClick={() => onDraftPrompt(prompt)}
							>
								{t('ewaCompanion.musicXlBaseWizardDraft')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								disabled={!canSubmit}
								onClick={() => void onSubmitPrompt(prompt)}
								className="gap-1.5"
								aria-busy={submitting}
							>
								<PaperAirplaneIcon className="size-4" aria-hidden />
								{t('ewaCompanion.musicXlBaseWizardGenerate')}
							</DesktopAppButton>
						</div>
					</div>
				</div>
			}
		>
			<div className="space-y-3">
				<CompanionHeroCard>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<CompanionPillBadge
								tone="aura"
								className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em]"
							>
								<SparklesIcon className="size-3" aria-hidden />
								{t('ewaCompanion.musicXlBaseWizardBadge')}
							</CompanionPillBadge>
							<p className="mt-2 text-[15px] font-semibold leading-tight text-white">
								{t('ewaCompanion.musicXlBaseWizardHeroTitle')}
							</p>
							<p className="mt-1 text-[12px] leading-relaxed text-(--companion-text-soft)">
								{t('ewaCompanion.musicXlBaseWizardHeroBody')}
							</p>
						</div>
						<CompanionIconTile>
							<MusicalNoteIcon className="size-8" aria-hidden />
						</CompanionIconTile>
					</div>
				</CompanionHeroCard>

				<label className="block space-y-1.5">
					<span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--companion-aura)">
						{t('ewaCompanion.musicXlBaseWizardThemeLabel')}
					</span>
					<textarea
						value={theme}
						onChange={(event) => setTheme(event.target.value)}
						maxLength={500}
						rows={4}
						className={cn(
							'w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2',
							'text-[13px] text-(--desktop-text-primary) placeholder:text-(--companion-text-soft)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						placeholder={t('ewaCompanion.musicXlBaseWizardThemePlaceholder')}
					/>
				</label>

				<ChoiceGroup
					title={t('ewaCompanion.musicXlBaseWizardStyleLabel')}
					options={styles}
					value={style}
					onChange={setStyle}
					ru={ru}
				/>
				<ChoiceGroup
					title={t('ewaCompanion.musicXlBaseWizardVocalLabel')}
					options={vocals}
					value={vocal}
					onChange={setVocal}
					ru={ru}
				/>
				<ChoiceGroup
					title={t('ewaCompanion.musicXlBaseWizardLanguageLabel')}
					options={languages}
					value={language}
					onChange={setLanguage}
					ru={ru}
				/>
			</div>
		</CompanionSurfacePanel>
	);
}
