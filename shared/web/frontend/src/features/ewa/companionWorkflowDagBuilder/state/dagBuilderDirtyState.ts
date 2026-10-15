/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Snapshot helpers for unsaved-change detection in the DAG visual builder.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 */

import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type DagBuilderDirtySnapshot = {
	name: string;
	triggerPhrase: string;
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
};

export function createDagBuilderDirtySnapshot(input: {
	name: string;
	triggerPhrase: string;
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
}): DagBuilderDirtySnapshot {
	return {
		name: input.name.trim(),
		triggerPhrase: input.triggerPhrase.trim(),
		nodes: input.nodes,
		edges: input.edges,
	};
}

export function isDagBuilderDirty(
	current: DagBuilderDirtySnapshot,
	baseline: DagBuilderDirtySnapshot | null
): boolean {
	if (!baseline) return false;
	return JSON.stringify(current) !== JSON.stringify(baseline);
}

export const DAG_BUILDER_UNSAVED_EXIT_MESSAGE_RU =
	'Есть несохранённые изменения. Выйти без сохранения?';

export const DAG_BUILDER_UNSAVED_EXIT_MESSAGE_EN =
	'You have unsaved changes. Leave without saving?';

export const DAG_BUILDER_PRESET_REPLACE_MESSAGE_RU =
	'Текущий граф будет заменён шаблоном. Продолжить?';

export const DAG_BUILDER_PRESET_REPLACE_MESSAGE_EN =
	'The current graph will be replaced by the preset. Continue?';
