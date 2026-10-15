/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FE-only hierarchical subgroups for Admin Settings (266+ keys) under existing categories.
 *
 * Invariants:
 * - Does not change API category values; only presentation grouping.
 * - Unknown keys fall into subgroup ``other``.
 *
 * Related:
 * - EwaCompanionSettingsTab.tsx
 * - documentation/product/ewa/EWA-UNIFIED-WORKSPACE-JOURNEY-2026-07-09.md
 */

export type EwaSettingsSubgroupId =
	| 'core'
	| 'memory'
	| 'llm'
	| 'think'
	| 'condense'
	| 'capacity'
	| 'reapers'
	| 'timeouts'
	| 'gates'
	| 'other';

export type EwaSettingsSubgroupDef = {
	id: EwaSettingsSubgroupId;
	/** Match if setting_key contains any of these (case-insensitive). */
	keyIncludes: readonly string[];
};

/** Order of subgroups within a category when rendering. */
export const EWA_SETTINGS_SUBGROUP_ORDER: readonly EwaSettingsSubgroupId[] = [
	'core',
	'think',
	'condense',
	'capacity',
	'memory',
	'llm',
	'gates',
	'reapers',
	'timeouts',
	'other',
] as const;

const BY_CATEGORY: Record<string, readonly EwaSettingsSubgroupDef[]> = {
	agentic: [
		{ id: 'think', keyIncludes: ['THINK', 'INTAKE'] },
		{ id: 'condense', keyIncludes: ['CONDENSE'] },
		{ id: 'capacity', keyIncludes: ['CAPACITY', 'BUDGET', 'LEASE', 'ORPHAN'] },
		{ id: 'core', keyIncludes: ['AGENTIC', 'SUBSTRATE', 'SESSION'] },
	],
	companion: [
		{
			id: 'memory',
			keyIncludes: ['MEMORY', 'EPISODIC', 'HCM', 'RECALL', 'EMBED'],
		},
		{
			id: 'llm',
			keyIncludes: ['NUM_PREDICT', 'NUM_CTX', 'CHAT_', 'CONDENSE', 'BANDWIDTH'],
		},
		{
			id: 'gates',
			keyIncludes: ['_ENABLED', 'VISION', 'SOCIAL', 'PLAN', 'VOICE'],
		},
		{ id: 'core', keyIncludes: ['COMPANION', 'WORKFLOW', 'ASYNC'] },
	],
	media: [
		{ id: 'reapers', keyIncludes: ['REAPER', 'STALE', 'ORPHAN', 'FRESH'] },
		{ id: 'timeouts', keyIncludes: ['TIMEOUT', 'TTL', 'SECONDS'] },
		{ id: 'gates', keyIncludes: ['_ENABLED', 'GENERATION'] },
	],
	orchestration: [
		{ id: 'llm', keyIncludes: ['LLM', 'MODEL', 'THINKING'] },
		{ id: 'core', keyIncludes: ['ORCH'] },
	],
	persona: [
		{ id: 'core', keyIncludes: ['PERSONA', 'STYLE', 'ARLIKA', 'MELA'] },
	],
	atoms: [{ id: 'core', keyIncludes: ['ATOM'] }],
	infrastructure: [
		{ id: 'core', keyIncludes: ['QDRANT', 'DATABASE', 'HEALTH'] },
	],
};

export function resolveEwaSettingsSubgroup(
	category: string,
	settingKey: string
): EwaSettingsSubgroupId {
	const key = settingKey.toUpperCase();
	const defs = BY_CATEGORY[category] ?? [];
	for (const def of defs) {
		if (def.keyIncludes.some((frag) => key.includes(frag.toUpperCase()))) {
			return def.id;
		}
	}
	return 'other';
}

export function settingsSubgroupI18nKey(
	subgroup: EwaSettingsSubgroupId
): string {
	return `ewaCompanionAdmin.settingsSubgroups.${subgroup}`;
}

export function groupSettingsBySubgroup<
	T extends { setting_key: string; category: string },
>(rows: T[]): Array<{ subgroup: EwaSettingsSubgroupId; items: T[] }> {
	const map = new Map<EwaSettingsSubgroupId, T[]>();
	for (const row of rows) {
		const sg = resolveEwaSettingsSubgroup(row.category, row.setting_key);
		const list = map.get(sg) ?? [];
		list.push(row);
		map.set(sg, list);
	}
	return EWA_SETTINGS_SUBGROUP_ORDER.filter((id) => map.has(id)).map((id) => ({
		subgroup: id,
		items: map.get(id) ?? [],
	}));
}
