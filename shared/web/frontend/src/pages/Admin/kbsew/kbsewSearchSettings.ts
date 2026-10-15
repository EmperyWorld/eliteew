/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers for desktop_ai_chat_config.defaults.kbsew_search_settings in KBSEW admin.
 *
 * Invariants:
 * - `retrieval_mode` is optional in stored JSON; default dense until hybrid lands.
 * - Do not drop unknown sibling keys when merging known fields into defaults.
 *
 * Related:
 * - api/services/desktop_chat/kbsew_search_settings.py
 */

import type { KbsewRetrievalMode } from '../kbsewAdminApi';

export const KBSEW_AGENT_SURFACES = [
	'desktop',
	'ewa',
	'marketing',
	'imperorg',
	'ugs',
] as const;

export type KbsewAgentSurfaceKey = (typeof KBSEW_AGENT_SURFACES)[number];

/** Surfaces with live KBSEW integration in stack0 today. */
export const KBSEW_AGENT_WIRED: Record<KbsewAgentSurfaceKey, boolean> = {
	desktop: true,
	ewa: true,
	marketing: true,
	imperorg: true,
	ugs: true,
};

export type KbsewSearchSettingsForm = {
	agents: Record<KbsewAgentSurfaceKey, boolean>;
	allowedBarrelIds: string[];
	chunksPerBarrel: number;
	rerankEnabled: boolean;
	retrievalMode: KbsewRetrievalMode;
};

export const KBSEW_CHUNKS_PER_BARREL_MIN = 1;
export const KBSEW_CHUNKS_PER_BARREL_MAX = 20;
export const KBSEW_CHUNKS_PER_BARREL_DEFAULT = 5;
export const KBSEW_RETRIEVAL_MODE_DEFAULT: KbsewRetrievalMode = 'dense';

type KbsewSearchSettingsBlock = {
	enabled?: boolean;
	allowed_barrels?: string[];
	agents?: Partial<Record<KbsewAgentSurfaceKey, boolean>>;
	chunks_per_barrel?: number;
	rerank_enabled?: boolean;
	retrieval_mode?: string;
};

function emptyAgents(): Record<KbsewAgentSurfaceKey, boolean> {
	return {
		desktop: false,
		ewa: false,
		marketing: false,
		imperorg: false,
		ugs: false,
	};
}

/** Clamp agent/Test Search chunk limit to 1–20; invalid → canon default 5. */
export function clampChunksPerBarrel(raw: unknown): number {
	if (typeof raw !== 'number' || Number.isNaN(raw)) {
		const parsed = Number.parseInt(String(raw ?? ''), 10);
		if (Number.isNaN(parsed)) return KBSEW_CHUNKS_PER_BARREL_DEFAULT;
		raw = parsed;
	}
	return Math.max(
		KBSEW_CHUNKS_PER_BARREL_MIN,
		Math.min(KBSEW_CHUNKS_PER_BARREL_MAX, Math.trunc(raw as number))
	);
}

export function normalizeKbsewRetrievalMode(raw: unknown): KbsewRetrievalMode {
	if (typeof raw !== 'string') return KBSEW_RETRIEVAL_MODE_DEFAULT;
	const mode = raw.trim().toLowerCase();
	if (mode === 'hybrid') return 'hybrid';
	if (mode === 'dense') return 'dense';
	return KBSEW_RETRIEVAL_MODE_DEFAULT;
}

export function readKbsewSettingsFromDefaults(
	defaults: Record<string, unknown>
): KbsewSearchSettingsForm {
	const block = defaults.kbsew_search_settings as
		| KbsewSearchSettingsBlock
		| undefined;
	const barrels = Array.isArray(block?.allowed_barrels)
		? block.allowed_barrels.filter((id) => typeof id === 'string' && id.trim())
		: [];
	const agents = emptyAgents();
	if (block?.agents && typeof block.agents === 'object') {
		for (const key of KBSEW_AGENT_SURFACES) {
			if (typeof block.agents[key] === 'boolean') {
				agents[key] = block.agents[key] as boolean;
			}
		}
	}
	// Legacy enabled=true → desktop when agents block absent/false.
	if (block?.enabled === true && !Object.values(agents).some(Boolean)) {
		agents.desktop = true;
	}
	return {
		agents,
		allowedBarrelIds: barrels,
		chunksPerBarrel: clampChunksPerBarrel(block?.chunks_per_barrel),
		rerankEnabled: block?.rerank_enabled === true,
		retrievalMode: normalizeKbsewRetrievalMode(block?.retrieval_mode),
	};
}

export function mergeKbsewSettingsIntoDefaults(
	defaults: Record<string, unknown>,
	form: KbsewSearchSettingsForm
): Record<string, unknown> {
	const allowed = form.allowedBarrelIds.map((id) => id.trim()).filter(Boolean);
	const anyAgent = Object.values(form.agents).some(Boolean);
	const prev =
		defaults.kbsew_search_settings &&
		typeof defaults.kbsew_search_settings === 'object'
			? (defaults.kbsew_search_settings as Record<string, unknown>)
			: {};
	return {
		...defaults,
		kbsew_search_settings: {
			...prev,
			enabled: form.agents.desktop || anyAgent,
			agents: { ...form.agents },
			allowed_barrels: allowed,
			chunks_per_barrel: clampChunksPerBarrel(form.chunksPerBarrel),
			rerank_enabled: form.rerankEnabled,
			retrieval_mode: normalizeKbsewRetrievalMode(form.retrievalMode),
		},
	};
}

export function kbsewAgentToolVisible(
	form: KbsewSearchSettingsForm,
	agent: KbsewAgentSurfaceKey = 'desktop'
): boolean {
	return form.agents[agent] && form.allowedBarrelIds.length > 0;
}

export function countKbsewEnabledAgents(form: KbsewSearchSettingsForm): number {
	return KBSEW_AGENT_SURFACES.filter((surface) =>
		kbsewAgentToolVisible(form, surface)
	).length;
}
