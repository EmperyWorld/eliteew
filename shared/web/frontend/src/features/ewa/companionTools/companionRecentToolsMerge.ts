/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge localStorage recent instrument chip ids with server ``companion_recent_server_actions`` ring (U1.6).
 *
 * Invariants:
 * - Server-derived ids precede local-only clicks; dedupe by chip id; cap at ``COMPANION_RECENT_TOOLS_MAX``.
 * - Only server actions with user-meaningful statuses appear in the merged list.
 *
 * Related:
 * - src/features/ewa/companionRecentServerActionsUi.ts
 * - src/features/ewa/companionTools/companionEwaToolsRegistry.ts
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md §U1.6
 */

import { extractRecentServerActionsForDisplay } from '@/features/ewa/companionRecentServerActionsUi';
import { companionChipIdForEwaToolName } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import { COMPANION_RECENT_TOOLS_MAX } from '@/features/ewa/companionTools/companionRecentToolsStorage';

const _SERVER_RECENT_STATUSES = new Set(['ok', 'needs_confirm', 'accepted']);

export type MergeCompanionRecentToolChipIdsArgs = {
	localRecent: readonly string[];
	learnedPreferences: unknown;
	max?: number;
};

/** Newest server actions first, then local-only chip ids not already listed. */
export function mergeCompanionRecentToolChipIds(
	args: MergeCompanionRecentToolChipIdsArgs
): string[] {
	const max = args.max ?? COMPANION_RECENT_TOOLS_MAX;
	const serverEntries = extractRecentServerActionsForDisplay(
		args.learnedPreferences
	);
	const serverChipIds: string[] = [];
	for (let i = serverEntries.length - 1; i >= 0; i -= 1) {
		const entry = serverEntries[i];
		if (!_SERVER_RECENT_STATUSES.has(entry.status)) continue;
		const chipId =
			companionChipIdForEwaToolName(entry.tool) ??
			companionChipIdForEwaToolName(entry.branch);
		if (!chipId) continue;
		if (!serverChipIds.includes(chipId)) {
			serverChipIds.push(chipId);
		}
	}

	const out: string[] = [];
	const seen = new Set<string>();
	for (const id of serverChipIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= max) return out;
	}
	for (const id of args.localRecent) {
		const trimmed = id.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
		if (out.length >= max) return out;
	}
	return out;
}
