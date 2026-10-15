/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Markdown export builders and download helper for Desktop AI Chat transcripts.
 *
 * Invariants:
 * - Only user/assistant roles are exported; assistant hero labels come from metadata.
 *
 * Related:
 * - DesktopAiChatApp.tsx
 * ---
 */
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { TFunction } from 'i18next';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import { getDesktopAiHero } from '../desktopAiHeroes';
import {
	appendDesktopAiEvidenceAppendix,
	resolveDesktopAiMessageEvidenceSources,
} from '../desktopAiEvidence';

export function assistantContributorHeroIds(
	message: DesktopAiMessage
): string[] {
	if (message.role !== 'assistant') {
		return [];
	}
	const seen = new Set<string>();
	const out: string[] = [];
	const push = (value: unknown) => {
		if (typeof value !== 'string') {
			return;
		}
		const trimmed = value.trim();
		if (!trimmed || seen.has(trimmed)) {
			return;
		}
		seen.add(trimmed);
		out.push(trimmed);
	};
	if (Array.isArray(message.metadata?.desktop_ensemble_contributors)) {
		for (const id of message.metadata.desktop_ensemble_contributors) {
			push(id);
		}
	}
	push(message.metadata?.desktop_hero_id);
	return out;
}

export function assistantSpeakerLabel(
	message: DesktopAiMessage
): string | null {
	const ids = assistantContributorHeroIds(message);
	if (ids.length === 0) {
		return null;
	}
	return ids
		.map((id) => getDesktopAiHero(id)?.shortLabel ?? id)
		.filter(Boolean)
		.join(' · ');
}

/** Max hero chips shown in bubble attribution before "+N". */
export const ASSISTANT_SPEAKER_CHIPS_MAX = 3;

export function assistantSpeakerChips(message: DesktopAiMessage): {
	visible: Array<{ id: string; label: string }>;
	overflow: number;
	fullLabel: string | null;
} {
	const ids = assistantContributorHeroIds(message);
	const parts = ids.map((id) => ({
		id,
		label: getDesktopAiHero(id)?.shortLabel ?? id,
	}));
	const fullLabel =
		parts.length === 0 ? null : parts.map((p) => p.label).join(' · ');
	return {
		visible: parts.slice(0, ASSISTANT_SPEAKER_CHIPS_MAX),
		overflow: Math.max(0, parts.length - ASSISTANT_SPEAKER_CHIPS_MAX),
		fullLabel,
	};
}

export function buildChatMarkdownExport(
	title: string,
	messages: DesktopAiMessage[],
	translate: TFunction<'desktopAiChat'>,
	lang: string
): string {
	const locale = lang.startsWith('ru') ? ru : enUS;
	const head = [
		`# ${title}`,
		'',
		`_${translate('exportFooter', {
			datetime: format(new Date(), 'yyyy-MM-dd HH:mm', { locale }),
		})}_`,
		'',
	];
	const body: string[] = [];
	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') {
			continue;
		}
		const assistantLabel = assistantSpeakerLabel(m);
		const role =
			m.role === 'user'
				? translate('exportRoleUser')
				: assistantLabel
					? translate('exportRoleAssistantWithHero', {
							label: assistantLabel,
						})
					: translate('exportRoleAssistant');
		const ts = m.created_at
			? format(new Date(m.created_at), 'yyyy-MM-dd HH:mm', { locale })
			: '';
		const evidenceSources =
			m.role === 'assistant'
				? resolveDesktopAiMessageEvidenceSources(m.metadata)
				: [];
		const includeEmptyEvidence =
			m.role === 'assistant' &&
			(m.metadata?.desktop_ensemble_blueprint === true ||
				m.metadata?.desktop_expert_reply_contract === 'expert-document-v1');
		const content =
			m.role === 'assistant'
				? appendDesktopAiEvidenceAppendix(
						m.content || '',
						evidenceSources,
						translate,
						{ includeEmpty: includeEmptyEvidence }
					)
				: (m.content || '').trim();
		body.push(`## ${role}${ts ? ` — ${ts}` : ''}`, '', content, '', '---', '');
	}
	return [...head, ...body].join('\n');
}

export function downloadMarkdownFile(filename: string, text: string): void {
	const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
