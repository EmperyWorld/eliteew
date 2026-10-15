/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrative chapter ids and keyboard cycle helpers for Empery Nexus Chronicle.
 *
 * Invariants:
 * - Chapter copy lives in i18n; this file is ids + default reality layer only.
 *
 * Related:
 * - data/chronicleManifest.ts
 * - i18n/locales/{ru,en}/emperyNexusChronicle.json
 */

import {
	CHRONICLE_MANIFEST,
	type ChronicleDomainId,
	type RealityLayerId,
} from './chronicleManifest';

export type ChronicleChapterId =
	| 'husk'
	| 'word'
	| 'constellation'
	| 'sovereignty';

export type ChronicleChapter = {
	id: ChronicleChapterId;
	/** Reality layer this chapter emphasizes */
	layer: RealityLayerId;
};

export const CHRONICLE_CHAPTERS = [
	{ id: 'husk', layer: 'mask' },
	{ id: 'word', layer: 'muscle' },
	{ id: 'constellation', layer: 'muscle' },
	{ id: 'sovereignty', layer: 'soul' },
] as const satisfies readonly ChronicleChapter[];

export const CHRONICLE_DOMAIN_ORDER = CHRONICLE_MANIFEST.domains.map(
	(d) => d.id
) as ChronicleDomainId[];

export function cycleChronicleDomain(
	current: ChronicleDomainId | null,
	direction: 1 | -1
): ChronicleDomainId {
	const order = CHRONICLE_DOMAIN_ORDER;
	if (order.length === 0) {
		throw new Error('CHRONICLE_DOMAIN_ORDER is empty');
	}
	if (!current) {
		return direction === 1 ? order[0] : order[order.length - 1];
	}
	const index = order.indexOf(current);
	const from = index >= 0 ? index : 0;
	const next = (from + direction + order.length) % order.length;
	return order[next] ?? order[0];
}

export function cycleChronicleChapter(
	current: ChronicleChapterId,
	direction: 1 | -1
): ChronicleChapterId {
	const order = CHRONICLE_CHAPTERS;
	const index = order.findIndex((c) => c.id === current);
	const from = index >= 0 ? index : 0;
	const next = (from + direction + order.length) % order.length;
	return order[next]?.id ?? order[0].id;
}

export function chapterById(
	id: ChronicleChapterId
): (typeof CHRONICLE_CHAPTERS)[number] {
	return CHRONICLE_CHAPTERS.find((c) => c.id === id) ?? CHRONICLE_CHAPTERS[0];
}
