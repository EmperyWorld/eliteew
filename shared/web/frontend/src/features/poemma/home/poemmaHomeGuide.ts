/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home block E — guide entry buttons and testing-initiative fallback (P-407).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §9
 * - src/features/poemma/guide/poemmaDecisionFlow.ts
 */

import {
	getPoemmaDecisionBranchEntryChoice,
	listPoemmaDecisionBranchIds,
	type PoemmaDecisionBranchId,
} from '../guide/poemmaDecisionFlow';
import type { PoemmaInitiative } from '../poemmaDomain';

export type PoemmaHomeGuideMode = 'entries' | 'testing';

export interface PoemmaHomeGuideEntry {
	key: PoemmaDecisionBranchId;
	label: string;
	path: string;
}

export interface PoemmaHomeGuideView {
	mode: PoemmaHomeGuideMode;
	entries: PoemmaHomeGuideEntry[];
	testingInitiative: PoemmaInitiative | null;
}

export function buildPoemmaHomeGuideEntryPath(
	branchId: PoemmaDecisionBranchId
): string {
	return `/guide?branch=${branchId}`;
}

export function buildPoemmaHomeGuideEntries(): PoemmaHomeGuideEntry[] {
	return listPoemmaDecisionBranchIds().map((branchId) => {
		const choice = getPoemmaDecisionBranchEntryChoice(branchId);
		return {
			key: branchId,
			label: choice.label,
			path: buildPoemmaHomeGuideEntryPath(branchId),
		};
	});
}

export function findPoemmaHomeTestingInitiative(
	initiatives: PoemmaInitiative[]
): PoemmaInitiative | null {
	return (
		initiatives.find((initiative) => initiative.status === 'testing') ?? null
	);
}

export function buildPoemmaHomeGuideView(
	initiatives: PoemmaInitiative[]
): PoemmaHomeGuideView {
	const entries = buildPoemmaHomeGuideEntries();
	const testingInitiative = findPoemmaHomeTestingInitiative(initiatives);

	if (testingInitiative) {
		return {
			mode: 'testing',
			entries,
			testingInitiative,
		};
	}

	return {
		mode: 'entries',
		entries,
		testingInitiative: null,
	};
}
