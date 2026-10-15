/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persona picker and starter snippets for the EWA desktop window — consumer-facing copy only in caller (`marketing` i18n).
 *
 * Invariants:
 * - Selection calls `onPersonaIdChange` only; orchestration hints stay in `EwaDesktopApp`.
 * - Symbol chips mirror `EWA_PERSONA_CATALOG` (`ewaPersonaCatalog.ts`).
 *
 * Related:
 * - src/features/ewa/EwaDesktopView.tsx
 * - src/features/ewa/ewaPersonaCatalog.ts
 */
import {
	EWA_PERSONA_CATALOG,
	getEwaPersonaById,
	type EwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { TFunction, i18n } from 'i18next';

const PERSONA_ACCENT_BTN: Record<string, { idle: string; active: string }> = {
	violet: {
		idle: 'border border-transparent bg-[rgb(var(--desktop-accent-rgb)/0.1)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.15)]',
		active:
			'border border-[rgb(var(--desktop-accent-rgb)/0.65)] bg-[rgb(var(--desktop-accent-rgb)/0.2)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
	},
	rose: {
		idle: 'border border-transparent bg-rose-500/10 hover:bg-rose-500/15',
		active: 'border border-rose-400/65 bg-rose-500/20 ring-2 ring-rose-400/35',
	},
	sky: {
		idle: 'border border-transparent bg-sky-500/10 hover:bg-sky-500/15',
		active: 'border border-sky-400/65 bg-sky-500/20 ring-2 ring-sky-400/35',
	},
	emerald: {
		idle: 'border border-transparent bg-emerald-500/10 hover:bg-emerald-500/15',
		active:
			'border border-emerald-400/65 bg-emerald-500/20 ring-2 ring-emerald-400/35',
	},
	amber: {
		idle: 'border border-transparent bg-amber-500/10 hover:bg-amber-500/15',
		active:
			'border border-amber-400/65 bg-amber-500/20 ring-2 ring-amber-400/35',
	},
	slate: {
		idle: 'border border-transparent bg-[rgb(var(--desktop-fg-primary-rgb)/0.08)] hover:bg-[rgb(var(--desktop-fg-primary-rgb)/0.12)]',
		active:
			'border border-(--desktop-border-subtle) bg-[rgb(var(--desktop-fg-primary-rgb)/0.14)] ring-2 ring-[rgb(var(--desktop-fg-primary-rgb)/0.25)]',
	},
};

function starterPromptRowKey(personaKey: string, prompt: string): string {
	let h = 2166136261;
	for (let i = 0; i < prompt.length; i++) {
		h ^= prompt.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return `${personaKey}-${(h >>> 0).toString(16)}`;
}

export function EwaDesktopPersonaSection({
	personaId,
	onPersonaIdChange,
	onStarterSnippetActivate,
	i18n,
	t,
}: {
	personaId: EwaPersonaId;
	onPersonaIdChange: (next: EwaPersonaId) => void;
	onStarterSnippetActivate: (prompt: string) => void;
	i18n: i18n;
	t: TFunction<'marketing', undefined>;
}) {
	const personaLangRu = i18n.language.startsWith('ru');
	const persona = getEwaPersonaById(personaId);
	const personaDisplayName = personaLangRu
		? persona.displayNameRu
		: persona.displayNameEn;
	const personaRoleLine = personaLangRu ? persona.roleRu : persona.roleEn;
	const personaToneLine = personaLangRu ? persona.toneRu : persona.toneEn;
	const starterPrompts = personaLangRu
		? persona.starterPromptsRu
		: persona.starterPromptsEn;

	return (
		<div
			className={cn(DESKTOP_APP_STYLE_CONTRACT.panel, 'shrink-0 space-y-2 p-3')}
		>
			<DesktopAppSectionLabel>
				{t('ewaDesktop.personaFaceSection')}
			</DesktopAppSectionLabel>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-secondary)'
				)}
			>
				{t('ewaDesktop.personaFaceHint')}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{EWA_PERSONA_CATALOG.map((p) => {
					const chipAccent =
						PERSONA_ACCENT_BTN[p.accent] ?? PERSONA_ACCENT_BTN.slate;
					const palette =
						p.id === personaId ? chipAccent.active : chipAccent.idle;
					return (
						<DesktopAppButton
							key={p.id}
							type="button"
							variant="ghost"
							size="sm"
							className={cn('gap-1 text-xs rounded-md px-2 py-1', palette)}
							onClick={() => {
								onPersonaIdChange(p.id);
							}}
							title={
								i18n.language.startsWith('ru')
									? `${p.roleRu} · ${p.toneRu}`
									: `${p.roleEn} · ${p.toneEn}`
							}
						>
							<span aria-hidden>{p.symbol}</span>
							<span className="font-medium">
								{i18n.language.startsWith('ru')
									? p.displayNameRu
									: p.displayNameEn}
							</span>
						</DesktopAppButton>
					);
				})}
			</div>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-primary)'
				)}
			>
				<span className="font-medium">{personaDisplayName}</span>
				<span className="text-(--desktop-text-secondary)"> — </span>
				{personaRoleLine}
			</p>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-secondary)'
				)}
			>
				{t('ewaDesktop.personaToneLabel')}: {personaToneLine}
			</p>
			<div className="space-y-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('ewaDesktop.personaStartersSection')}
				</span>
				<div className="flex flex-col gap-1">
					{starterPrompts.map((line) => (
						<DesktopAppButton
							key={starterPromptRowKey(persona.id, line)}
							type="button"
							variant="neutral"
							size="sm"
							className={cn(
								'h-auto min-h-0 justify-start whitespace-normal px-2 py-1.5 text-left text-[11px] leading-snug'
							)}
							onClick={() => onStarterSnippetActivate(line)}
							title={t('ewaDesktop.personaStarterButtonTitle')}
						>
							{line}
						</DesktopAppButton>
					))}
				</div>
			</div>
		</div>
	);
}
