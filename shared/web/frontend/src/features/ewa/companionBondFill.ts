/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composite **bond arc** fill (0..1) for `CompanionSigil` — blends durable memory richness, trust meter,
 * and shared chat depth so the arc stays meaningful after many turns (unlike raw `companion_revision` alone).
 *
 * Invariants:
 * - Pure function; never throws. Floor **0.06** keeps a visible stub for new friends.
 * - Memory line count prefers server `memory_display` when present (same strip as «Помнит о вас»).
 *
 * Related:
 * - src/features/ewa/companionLearnedUi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionPresence/CompanionSigil.tsx
 */
import {
	extractCompanionTrustMeterScore,
	extractTopCompanionMemoryLines,
	EWA_COMPANION_MEMORY_STRIP_MAX_LINES,
} from '@/features/ewa/companionLearnedUi';

/** Lines in «Помнит о вас» that feel “warm” before the strip cap. */
const MEMORY_WARM_LINES = 24;
/** Revision count at which the depth term reaches ~100% of its weight (log curve). */
const REVISION_DEPTH_FULL = 240;

const BOND_FLOOR = 0.06;
const WEIGHT_MEMORY = 0.35;
const WEIGHT_TRUST = 0.3;
const WEIGHT_DEPTH = 0.35;

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return BOND_FLOOR;
	return Math.max(0, Math.min(1, value));
}

function depthBondFromRevision(revision: number): number {
	if (!Number.isFinite(revision) || revision <= 1) return 0;
	const v = Math.log(revision) / Math.log(REVISION_DEPTH_FULL);
	return clamp01(v);
}

function memoryBondFromCount(lineCount: number): number {
	if (lineCount <= 0) return 0;
	return clamp01(lineCount / MEMORY_WARM_LINES);
}

function trustBondFromScore(
	trustScore: number | null,
	revision: number
): number {
	if (trustScore !== null) return clamp01(trustScore / 10);
	// Before trust baseline exists, depth alone nudges the arc slightly.
	if (revision <= 1) return 0.08;
	return clamp01(revision / 160);
}

export type CompanionBondFillInput = {
	companionRevision: number;
	learnedPreferences: unknown;
	memoryDisplay?: string[] | null;
};

/**
 * Bond arc fill for the sigil (0..1).
 * Grows when the companion remembers more about you, trust rises, and shared history deepens.
 */
export function computeCompanionBondFill(
	input: CompanionBondFillInput
): number {
	const revision = input.companionRevision;
	const memoryLines =
		Array.isArray(input.memoryDisplay) && input.memoryDisplay.length > 0
			? input.memoryDisplay.filter(
					(line) => typeof line === 'string' && line.trim().length > 0
				)
			: extractTopCompanionMemoryLines(
					input.learnedPreferences,
					EWA_COMPANION_MEMORY_STRIP_MAX_LINES
				);
	const mem = memoryBondFromCount(memoryLines.length);
	const trust = trustBondFromScore(
		extractCompanionTrustMeterScore(input.learnedPreferences),
		revision
	);
	const depth = depthBondFromRevision(revision);
	const composite =
		WEIGHT_MEMORY * mem + WEIGHT_TRUST * trust + WEIGHT_DEPTH * depth;
	return Math.max(BOND_FLOOR, clamp01(composite));
}
