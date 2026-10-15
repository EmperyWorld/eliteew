/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static forensic metrics driving the Empery Nexus Chronicle visualization density and domain nodes.
 *
 * Invariants:
 * - Values are measured product-tree facts from the 2026-07-14 monorepo audit (not live API).
 * - User-facing labels live in i18n `emperyNexusChronicle` — this file is metrics + geometry only.
 *
 * Related:
 * - documentation/product/EMPERY-NEXUS-CHRONICLE.md
 * - i18n/locales/{ru,en}/emperyNexusChronicle.json
 */

export type RealityLayerId = 'mask' | 'muscle' | 'soul';

export type ChronicleDomainId =
	| 'api'
	| 'spa'
	| 'mobile'
	| 'dewa'
	| 'ewgen'
	| 'ops';

export type ChronicleDomain = {
	id: ChronicleDomainId;
	linesOfCode: number;
	/** Orbit radius from Nexus core */
	orbit: number;
	/** Base angle radians */
	phase: number;
	layer: RealityLayerId;
	accent: string;
};

export const CHRONICLE_MANIFEST = {
	measuredLinesOfCode: 1_972_965,
	fileCountMeasuredTrees: 9_670,
	commits30d: 874,
	governance: {
		rules: 66,
		hooks: 24,
		skills: 19,
	},
	ops: {
		dockerScripts: 144,
		stackYml: 35,
	},
	domains: [
		{
			id: 'spa',
			linesOfCode: 908_174,
			orbit: 4.2,
			phase: 0.15,
			layer: 'mask',
			accent: '#c9a227',
		},
		{
			id: 'api',
			linesOfCode: 513_722,
			orbit: 3.4,
			phase: 1.4,
			layer: 'muscle',
			accent: '#7eb8c9',
		},
		{
			id: 'mobile',
			linesOfCode: 76_670,
			orbit: 5.0,
			phase: 2.5,
			layer: 'mask',
			accent: '#a8b5c4',
		},
		{
			id: 'dewa',
			linesOfCode: 63_344,
			orbit: 5.6,
			phase: 3.6,
			layer: 'muscle',
			accent: '#8fa39a',
		},
		{
			id: 'ewgen',
			linesOfCode: 252_740,
			orbit: 4.6,
			phase: 4.7,
			layer: 'muscle',
			accent: '#b8a88a',
		},
		{
			id: 'ops',
			linesOfCode: 19_640,
			orbit: 6.2,
			phase: 5.5,
			layer: 'soul',
			accent: '#6b7c8a',
		},
	] as const satisfies readonly ChronicleDomain[],
	layers: [
		{ id: 'mask' as const, cameraZ: 11 },
		{ id: 'muscle' as const, cameraZ: 7.5 },
		{ id: 'soul' as const, cameraZ: 4.2 },
	],
} as const;

export type ChronicleManifest = typeof CHRONICLE_MANIFEST;

export function particleBudgetFromManifest(
	manifest: ChronicleManifest = CHRONICLE_MANIFEST
): number {
	const raw = Math.round(manifest.measuredLinesOfCode / 2_400);
	return Math.min(2_800, Math.max(900, raw));
}

export function findChronicleDomain(
	id: ChronicleDomainId | null
): ChronicleDomain | null {
	if (!id) return null;
	return CHRONICLE_MANIFEST.domains.find((d) => d.id === id) ?? null;
}
