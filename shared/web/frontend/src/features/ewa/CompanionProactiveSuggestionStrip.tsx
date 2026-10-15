/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deterministic proactive suggestion card (structured question + quick replies).
 *
 * Invariants:
 * - Question form only — no past-tense completion claims in UI copy from server templates.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { useTranslation } from 'react-i18next';

import type { CompanionProactiveSuggestion } from '@/services/ewa/ewaCompanionChatApi';

type Props = {
	suggestion: CompanionProactiveSuggestion;
	onQuickReply: (text: string) => void;
	onDismiss: () => void;
	onSnoozeToday?: () => void;
};

export function CompanionProactiveSuggestionStrip({
	suggestion,
	onQuickReply,
	onDismiss,
	onSnoozeToday,
}: Props) {
	const { i18n, t } = useTranslation();
	const ru = i18n.language.startsWith('ru');
	const question = ru
		? suggestion.question_ru || suggestion.question_en
		: suggestion.question_en || suggestion.question_ru;
	if (!question?.trim()) {
		return null;
	}
	return (
		<div
			className="mb-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-3 py-2 text-sm"
			data-testid="ewa-companion-proactive-suggestion-strip"
		>
			<p className="text-[rgb(var(--desktop-accent-rgb)/0.95)]">{question}</p>
			<div className="mt-2 flex flex-wrap gap-2">
				{(suggestion.quick_replies ?? []).slice(0, 4).map((chip) => (
					<button
						key={chip}
						type="button"
						className="rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.4)] px-2 py-0.5 text-xs hover:bg-[rgb(var(--desktop-accent-rgb)/0.2)]"
						onClick={() => onQuickReply(chip)}
					>
						{chip}
					</button>
				))}
				<button
					type="button"
					className="rounded-full px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
					onClick={onDismiss}
				>
					{t('ewaCompanion.proactiveDismiss', 'Скрыть')}
				</button>
				{onSnoozeToday ? (
					<button
						type="button"
						className="rounded-full px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
						onClick={onSnoozeToday}
					>
						{t('ewaCompanion.proactiveSnoozeToday')}
					</button>
				) : null}
			</div>
		</div>
	);
}
