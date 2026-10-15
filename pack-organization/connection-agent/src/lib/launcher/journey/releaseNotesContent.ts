/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Embed Journey user release notes from docs/ (Vite ?raw) for Релизы tab.
 *
 * Invariants:
 * - Source paths match RELEASE_NOTES_SOURCES; no ops/bake jargon in user text.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.2
 */

import userNotesRaw from '../../../../docs/RELEASE-NOTES-user.ru.txt?raw';
import historyJsonRaw from '../../../../docs/RELEASE-NOTES-history.ru.json?raw';
import {
	RELEASE_NOTES_SOURCES,
	notesCopyLooksOpsJargon,
} from './releaseNotesPolicy';

export type ReleaseNotesHistoryEntry = {
	version: string;
	title: string;
	summary: string;
};

export type ReleaseNotesHistoryDoc = {
	schema: string;
	entries: ReleaseNotesHistoryEntry[];
};

export const BUNDLED_USER_RELEASE_NOTES: string = String(userNotesRaw).trim();

export function loadBundledReleaseNotesHistory(): ReleaseNotesHistoryDoc | null {
	try {
		const parsed = JSON.parse(String(historyJsonRaw)) as ReleaseNotesHistoryDoc;
		if (!parsed || !Array.isArray(parsed.entries)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Summaries for versions between current and available (best-effort). */
export function historySummariesBetween(
	history: ReleaseNotesHistoryDoc | null,
	fromVersion: string | null,
	toVersion: string | null
): string[] {
	if (!history || !toVersion) return [];
	const lines: string[] = [];
	for (const entry of history.entries) {
		if (fromVersion && entry.version === fromVersion) continue;
		lines.push(`${entry.version}: ${entry.summary}`);
		if (entry.version === toVersion) break;
	}
	return lines;
}

export function assertUserNotesSafe(text: string = BUNDLED_USER_RELEASE_NOTES): boolean {
	return !notesCopyLooksOpsJargon(text);
}

export function releaseNotesPathsMatchCanon(): boolean {
	return (
		RELEASE_NOTES_SOURCES.userNotesRelPath ===
			'docs/RELEASE-NOTES-user.ru.txt' &&
		RELEASE_NOTES_SOURCES.historyJsonRelPath ===
			'docs/RELEASE-NOTES-history.ru.json'
	);
}
