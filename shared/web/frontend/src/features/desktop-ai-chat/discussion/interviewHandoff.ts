/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Extract Discussion interview room topic/goal/panel from a Team blueprint artifact.
 *
 * Invariants:
 * - Prefers metadata.interview_handoff; falls back to markdown headings / bold labels.
 * - Roster comes from the prep card panel (or metadata), not the SPA picker default.
 * - Discussion never auto-starts; the human clicks «Пройти интервью».
 *
 * Related:
 * - api/services/desktop_chat_ensemble/discussion/interview_handoff.py
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 * - ../utils/desktopAiChatMessageIds.ts
 */
import { isPersistedDesktopAiMessageId } from '../utils/desktopAiChatMessageIds';

export const INTERVIEW_HANDOFF_PRESET_ID = 'interview';

export type InterviewHandoff = {
	topic: string;
	goal: string;
	preset_id: typeof INTERVIEW_HANDOFF_PRESET_ID;
	roster: string[];
	panel_guide: string;
	panel_roles: Record<string, string>;
};

const TOPIC_MAX = 4000;
const GOAL_MAX = 4000;
const GUIDE_MAX = 8000;
const ROLE_MAX = 240;
const ROSTER_MAX = 4;

const HEADING_ALIASES: Record<
	string,
	'topic' | 'goal' | 'panel_guide' | 'panel'
> = {
	'тема интервью': 'topic',
	'цель интервью': 'goal',
	'interview topic': 'topic',
	'interview goal': 'goal',
	'гайд для панели': 'panel_guide',
	'panel guide': 'panel_guide',
	'гайд интервью': 'panel_guide',
	'панель интервью': 'panel',
	'состав панели': 'panel',
	'interview panel': 'panel',
};

const SECTION_RE =
	/^#{2,3}\s*(тема интервью|цель интервью|interview topic|interview goal|гайд для панели|panel guide|гайд интервью|панель интервью|состав панели|interview panel)\s*\n+([\s\S]*?)(?=^#{2,3}\s|(?![\s\S]))/gim;

const BOLD_LABEL_RE =
	/^\*\*(Тема|Цель|Interview topic|Interview goal):\*\*\s*([\s\S]*?)(?=^\*\*(?:Тема|Цель|Interview topic|Interview goal):\*\*|^#{2,3}\s|(?![\s\S]))/gim;

const BOLD_KEY: Record<string, 'topic' | 'goal'> = {
	тема: 'topic',
	цель: 'goal',
	'interview topic': 'topic',
	'interview goal': 'goal',
};

const HERO_TICK_RE = /`([a-z][a-z0-9_]{2,40})`/g;

function clip(text: string, limit: number): string {
	const cleaned = text.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= limit) return cleaned;
	return cleaned.slice(0, limit).trimEnd();
}

function normalizeRoster(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const hero = String(item ?? '').trim();
		if (!hero || seen.has(hero)) continue;
		seen.add(hero);
		out.push(hero);
		if (out.length >= ROSTER_MAX) break;
	}
	return out;
}

function normalizeRoles(raw: unknown): Record<string, string> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const hero = key.trim();
		const role = clip(String(value ?? ''), ROLE_MAX);
		if (!hero || !role) continue;
		out[hero] = role;
	}
	return out;
}

function parsePanelBlock(body: string): {
	roster: string[];
	panel_roles: Record<string, string>;
} {
	const roster: string[] = [];
	const panel_roles: Record<string, string> = {};
	const seen = new Set<string>();
	for (const line of body.split('\n')) {
		const raw = line
			.trim()
			.replace(/^[-*•]\s*/, '')
			.trim();
		if (!raw) continue;
		HERO_TICK_RE.lastIndex = 0;
		const tick = HERO_TICK_RE.exec(raw);
		const hero = tick?.[1]?.trim() ?? '';
		if (!hero || seen.has(hero)) continue;
		seen.add(hero);
		roster.push(hero);
		let rolePart = tick ? raw.slice(tick.index + tick[0].length) : raw;
		rolePart = rolePart.replace(/^[ \u2014\u2013\-:|]+/, '').trim();
		if (rolePart.includes('—')) {
			rolePart = rolePart.split('—').slice(1).join('—').trim();
		} else if (rolePart.includes('–')) {
			rolePart = rolePart.split('–').slice(1).join('–').trim();
		}
		const role = clip(rolePart, ROLE_MAX);
		if (role) panel_roles[hero] = role;
		if (roster.length >= ROSTER_MAX) break;
	}
	return { roster, panel_roles };
}

function fromMetadata(metadata: unknown): InterviewHandoff | null {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return null;
	}
	const raw = (metadata as { interview_handoff?: unknown }).interview_handoff;
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const topic = clip(
		String((raw as { topic?: unknown }).topic ?? ''),
		TOPIC_MAX
	);
	const goal = clip(String((raw as { goal?: unknown }).goal ?? ''), GOAL_MAX);
	if (!topic) return null;
	return {
		topic,
		goal,
		preset_id: INTERVIEW_HANDOFF_PRESET_ID,
		roster: normalizeRoster((raw as { roster?: unknown }).roster),
		panel_guide: clip(
			String((raw as { panel_guide?: unknown }).panel_guide ?? ''),
			GUIDE_MAX
		),
		panel_roles: normalizeRoles((raw as { panel_roles?: unknown }).panel_roles),
	};
}

function contributorsFromMetadata(metadata: unknown): string[] {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return [];
	}
	return normalizeRoster(
		(metadata as { desktop_ensemble_contributors?: unknown })
			.desktop_ensemble_contributors
	);
}

function extractFromMarkdown(body: string): InterviewHandoff | null {
	const found: Partial<Record<'topic' | 'goal' | 'panel_guide', string>> = {};
	let panelBody = '';
	let hadTopicHeading = false;
	for (const match of body.matchAll(SECTION_RE)) {
		const alias = HEADING_ALIASES[match[1]?.trim().toLowerCase() ?? ''];
		if (!alias) continue;
		if (alias === 'panel') {
			if (!panelBody) panelBody = match[2] ?? '';
			continue;
		}
		if (alias === 'topic') hadTopicHeading = true;
		if (found[alias]) continue;
		const clipped = clip(
			match[2] ?? '',
			alias === 'panel_guide'
				? GUIDE_MAX
				: alias === 'topic'
					? TOPIC_MAX
					: GOAL_MAX
		);
		if (clipped) found[alias] = clipped;
	}
	if (!found.topic) {
		for (const match of body.matchAll(BOLD_LABEL_RE)) {
			const alias = BOLD_KEY[match[1]?.trim().toLowerCase() ?? ''];
			if (!alias || found[alias]) continue;
			const clipped = clip(
				match[2] ?? '',
				alias === 'topic' ? TOPIC_MAX : GOAL_MAX
			);
			if (clipped) found[alias] = clipped;
		}
		// Bold path requires both labels so random «**Тема:**» docs do not open Discussion.
		if (!found.topic || !found.goal) return null;
	} else if (!hadTopicHeading && !found.goal) {
		return null;
	}
	if (!found.topic) return null;
	const panel = panelBody
		? parsePanelBlock(panelBody)
		: { roster: [] as string[], panel_roles: {} as Record<string, string> };
	return {
		topic: found.topic,
		goal: found.goal ?? '',
		preset_id: INTERVIEW_HANDOFF_PRESET_ID,
		roster: panel.roster,
		panel_guide: found.panel_guide ?? '',
		panel_roles: panel.panel_roles,
	};
}

export type InterviewDiscussionStartInput = {
	preset_id: typeof INTERVIEW_HANDOFF_PRESET_ID;
	topic: string;
	goal: string;
	roster: string[];
	intensity: 'calm';
	source_message_id: string;
};

/** CTA visibility: persisted message + extractable topic/goal + start handler present. */
export function canShowInterviewHandoffCta(
	message: { id: string; content?: string | null; metadata?: unknown },
	opts: { hasStartHandler: boolean; markdown?: string | null }
): boolean {
	if (!opts.hasStartHandler) return false;
	if (!isPersistedDesktopAiMessageId(message.id)) return false;
	const body = opts.markdown ?? message.content;
	return Boolean(extractInterviewHandoff(body, message.metadata));
}

export function buildInterviewDiscussionStartInput(
	message: { id: string; content?: string | null; metadata?: unknown },
	chatEnsembleIds: readonly string[] = []
): InterviewDiscussionStartInput | null {
	const handoff = extractInterviewHandoff(message.content, message.metadata);
	if (!handoff) return null;
	let roster = [...handoff.roster];
	if (roster.length === 0) {
		roster = contributorsFromMetadata(message.metadata);
	}
	if (roster.length === 0) {
		roster = normalizeRoster([...chatEnsembleIds]);
	}
	return {
		preset_id: INTERVIEW_HANDOFF_PRESET_ID,
		topic: handoff.topic,
		goal: handoff.goal,
		roster,
		intensity: 'calm',
		source_message_id: message.id,
	};
}

export function extractInterviewHandoff(
	markdown: string | null | undefined,
	metadata?: unknown
): InterviewHandoff | null {
	const metaHit = fromMetadata(metadata);
	const mdHit = extractFromMarkdown(markdown ?? '');
	if (metaHit) {
		return {
			...metaHit,
			roster:
				metaHit.roster.length > 0 ? metaHit.roster : (mdHit?.roster ?? []),
			panel_guide: metaHit.panel_guide || mdHit?.panel_guide || '',
			panel_roles:
				Object.keys(metaHit.panel_roles).length > 0
					? metaHit.panel_roles
					: (mdHit?.panel_roles ?? {}),
		};
	}
	return mdHit;
}
