/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Monotonic edit-generation counter for Ultimate Doc Editor analytical pipeline.
 * Every doc-changing transaction bumps generation; async heavy jobs capture a
 * snapshot and abort when current generation has moved on.
 *
 * Invariants:
 * - Generation only increases while the controller is active (reset on doc switch).
 * - `isStale(jobGeneration)` is true when jobGeneration !== current.
 *
 * Related:
 * - `utils/docEditorAnalyticalPipeline.ts`
 */

export type DocEditorEditGeneration = number;

export interface DocEditorGenerationController {
	readonly current: DocEditorEditGeneration;
	bump(): DocEditorEditGeneration;
	reset(next?: DocEditorEditGeneration): DocEditorEditGeneration;
	isStale(jobGeneration: DocEditorEditGeneration): boolean;
}

export function createDocEditorGenerationController(
	initial: DocEditorEditGeneration = 0
): DocEditorGenerationController {
	let generation = initial;

	return {
		get current() {
			return generation;
		},
		bump() {
			generation += 1;
			return generation;
		},
		reset(next = 0) {
			generation = next;
			return generation;
		},
		isStale(jobGeneration) {
			return jobGeneration !== generation;
		},
	};
}
