/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Own visual workflow load, duplicate, validation, and persistence behavior.
 *
 * Invariants:
 * - A duplicated workflow always saves through POST, never patches its source.
 * - Legacy v1 linear definitions cannot open in DAG builder; user exits to workflow list.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 * - companionOutputSurface/companionWorkflowValidationMessages.ts
 */

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Viewport } from '@xyflow/react';

import { duplicateWorkflowName } from '@/features/ewa/companionOutputSurface/companionUserWorkflowUi';
import { mapWorkflowValidationError } from '@/features/ewa/companionOutputSurface/companionWorkflowValidationMessages';
import {
	canvasToDagBody,
	parseDefinitionV2,
	type CompanionDagNodeData,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import {
	createDagBuilderDirtySnapshot,
	type DagBuilderDirtySnapshot,
} from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderDirtyState';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import type { useNotifications } from '@/notifications';
import {
	createCompanionUserWorkflow,
	getCompanionUserWorkflow,
	patchCompanionUserWorkflow,
	validateCompanionUserWorkflowV2,
	type CompanionUserWorkflow,
} from '@/services/ewa/companionUserWorkflowsApi';
import type {
	CompanionWorkflowDefinitionV2,
	UserWorkflowDagBodyV2,
} from '@/services/ewa/ewaOpenApi';
import type { CompanionUserWorkflowDagBodyV2 } from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

function toOpenApiUserWorkflowDagBody(
	dag: CompanionUserWorkflowDagBodyV2
): UserWorkflowDagBodyV2 {
	return {
		nodes: dag.nodes as UserWorkflowDagBodyV2['nodes'],
		edges: dag.edges ?? [],
		builder_meta: dag.builder_meta as UserWorkflowDagBodyV2['builder_meta'],
		execution_mode: dag.execution_mode ?? 'async',
	};
}

function buildPreviewWorkflowDefinitionV2(params: {
	title: string;
	triggerPattern: string;
	dag: CompanionUserWorkflowDagBodyV2;
}): CompanionWorkflowDefinitionV2 {
	const dagBody = toOpenApiUserWorkflowDagBody(params.dag);
	return {
		schema_version: 2,
		workflow_id: 'user_preview',
		version: 1,
		title_ru: params.title,
		title_en: params.title,
		description_ru: '',
		description_en: '',
		enabled: true,
		triggers: [
			{ type: 'regex', pattern: params.triggerPattern, min_confidence: 0.65 },
		],
		nodes: dagBody.nodes,
		edges: dagBody.edges,
		builder_meta: dagBody.builder_meta,
		execution_mode: dagBody.execution_mode,
		tags: ['user_workflow', 'dag_builder'],
	};
}

export const MAX_NODES_MVP = 10;

type Notify = ReturnType<typeof useNotifications>['notify'];
type FlowNodes = Array<{
	id: string;
	position: { x: number; y: number };
	data: CompanionDagNodeData;
}>;

type Params = {
	workflowId?: string;
	duplicateFromId?: string;
	onSaved: (workflow: CompanionUserWorkflow) => void;
	onExitToWorkflows: () => void;
	t: TFunction<'marketing'>;
	isRu: boolean;
	notify: Notify;
	name: string;
	setName: (value: string) => void;
	triggerPhrase: string;
	setTriggerPhrase: (value: string) => void;
	semanticNodes: CompanionWorkflowNodeV2[];
	setSemanticNodes: (value: CompanionWorkflowNodeV2[]) => void;
	semanticEdges: CompanionWorkflowEdgeV2[];
	setSemanticEdges: (value: CompanionWorkflowEdgeV2[]) => void;
	flowNodes: FlowNodes;
	viewport: Viewport | undefined;
	syncFlowFromSemantic: (
		nodes: CompanionWorkflowNodeV2[],
		edges: CompanionWorkflowEdgeV2[],
		builderMeta?: {
			node_positions?: Record<string, { x: number; y: number }>;
			viewport?: Viewport;
		}
	) => void;
	setDirtyBaseline: (snapshot: DagBuilderDirtySnapshot) => void;
};

export function useCompanionDagBuilderLoadSave({
	workflowId,
	duplicateFromId,
	onSaved,
	onExitToWorkflows,
	t,
	isRu,
	notify,
	name,
	setName,
	triggerPhrase,
	setTriggerPhrase,
	semanticNodes,
	setSemanticNodes,
	semanticEdges,
	setSemanticEdges,
	flowNodes,
	viewport,
	syncFlowFromSemantic,
	setDirtyBaseline,
}: Params) {
	const effectiveDuplicateFromId = workflowId ? undefined : duplicateFromId;
	const sourceId = workflowId ?? effectiveDuplicateFromId;
	const [loading, setLoading] = useState(Boolean(sourceId));
	const [saving, setSaving] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [maxNodesAllowed, setMaxNodesAllowed] = useState(MAX_NODES_MVP);
	const [loadAttempt, setLoadAttempt] = useState(0);

	useEffect(() => {
		void loadAttempt;
		if (!sourceId) {
			setDirtyBaseline(
				createDagBuilderDirtySnapshot({
					name: '',
					triggerPhrase: '',
					nodes: [],
					edges: [],
				})
			);
			return;
		}
		let cancelled = false;
		void (async () => {
			setLoading(true);
			setLoadError(null);
			try {
				const row = await getCompanionUserWorkflow(sourceId);
				if (cancelled) return;
				const definition = parseDefinitionV2(row.definition_json);
				if (!definition) {
					notify.warning(
						t('ewaCompanion.workflowDag.linearRedirectTitle'),
						t('ewaCompanion.workflowDag.linearRedirectBody')
					);
					onExitToWorkflows();
					return;
				}
				const patterns = row.trigger_json?.patterns;
				const loadedTrigger = Array.isArray(patterns)
					? String(patterns[0] ?? '')
					: '';
				const loadedName = effectiveDuplicateFromId
					? duplicateWorkflowName(row.name, isRu)
					: row.name;
				setName(loadedName);
				setTriggerPhrase(loadedTrigger);
				setSemanticNodes(definition.nodes);
				setSemanticEdges(definition.edges);
				syncFlowFromSemantic(
					definition.nodes,
					definition.edges,
					definition.builder_meta ?? undefined
				);
				setDirtyBaseline(
					createDagBuilderDirtySnapshot(
						effectiveDuplicateFromId
							? { name: '', triggerPhrase: '', nodes: [], edges: [] }
							: {
									name: loadedName,
									triggerPhrase: loadedTrigger,
									nodes: definition.nodes,
									edges: definition.edges,
								}
					)
				);
			} catch (error) {
				if (cancelled) return;
				setLoadError(error instanceof Error ? error.message : String(error));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		sourceId,
		effectiveDuplicateFromId,
		isRu,
		loadAttempt,
		notify,
		onExitToWorkflows,
		setDirtyBaseline,
		setName,
		setSemanticEdges,
		setSemanticNodes,
		setTriggerPhrase,
		syncFlowFromSemantic,
		t,
	]);

	const retryLoad = useCallback(() => setLoadAttempt((value) => value + 1), []);

	const handleSave = useCallback(async () => {
		const trimmedName = name.trim();
		const trimmedPhrase = triggerPhrase.trim();
		if (!trimmedName || !trimmedPhrase) {
			notify.warning(
				t('ewaCompanion.workflowDag.missingFieldsTitle'),
				t('ewaCompanion.workflowDag.missingFieldsBody')
			);
			return;
		}
		if (semanticNodes.length === 0) {
			notify.warning(
				t('ewaCompanion.workflowDag.emptyGraphTitle'),
				t('ewaCompanion.workflowDag.emptyGraphBody')
			);
			return;
		}

		setSaving(true);
		setValidationErrors([]);
		try {
			const dag = canvasToDagBody(
				semanticNodes,
				semanticEdges,
				flowNodes,
				viewport
			);
			const validation = await validateCompanionUserWorkflowV2({
				definition: buildPreviewWorkflowDefinitionV2({
					title: trimmedName,
					triggerPattern: trimmedPhrase,
					dag,
				}),
			});
			if (Number.isFinite(validation.max_nodes_allowed)) {
				setMaxNodesAllowed(validation.max_nodes_allowed);
			}
			if (!validation.ok) {
				const mapped = (validation.errors ?? []).map((code) =>
					mapWorkflowValidationError(code, t)
				);
				setValidationErrors(mapped);
				notify.error(
					t('ewaCompanion.workflowDag.validationFailedTitle'),
					mapped[0] ?? t('ewaCompanion.workflowDag.validationFailedBody')
				);
				return;
			}

			const body = {
				name: trimmedName,
				enabled: true,
				trigger: { type: 'phrase' as const, patterns: [trimmedPhrase] },
				dag: toOpenApiUserWorkflowDagBody(dag),
			};
			const saved = workflowId
				? await patchCompanionUserWorkflow(workflowId, body)
				: await createCompanionUserWorkflow(body);
			setDirtyBaseline(
				createDagBuilderDirtySnapshot({
					name: trimmedName,
					triggerPhrase: trimmedPhrase,
					nodes: dag.nodes,
					edges: dag.edges,
				})
			);
			notify.success(
				t('ewaCompanion.workflowDag.savedTitle'),
				t('ewaCompanion.workflowDag.postSaveHint', { trigger: trimmedPhrase })
			);
			onSaved(saved);
		} catch (error) {
			notify.error(
				t('ewaCompanion.workflowDag.saveErrorTitle'),
				error instanceof Error ? error.message : String(error)
			);
		} finally {
			setSaving(false);
		}
	}, [
		flowNodes,
		name,
		notify,
		onSaved,
		semanticEdges,
		semanticNodes,
		setDirtyBaseline,
		t,
		triggerPhrase,
		viewport,
		workflowId,
	]);

	return {
		loading,
		saving,
		loadError,
		validationErrors,
		setValidationErrors,
		maxNodesAllowed,
		retryLoad,
		handleSave,
	};
}
