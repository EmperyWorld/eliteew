/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared editor state for the companion DAG builder (selection, patches, picker).
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 */

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react';

import {
	findSemanticEdgeByFlowId,
	semanticEdgeFlowId,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import type {
	DagSelection,
	PickerAnchor,
	PickerSession,
} from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderSelection';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

type DagBuilderEditorContextValue = {
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	selection: DagSelection;
	setSelection: (selection: DagSelection) => void;
	pickerSession: PickerSession;
	openPicker: (anchor: PickerAnchor, anchorEl: HTMLElement | null) => void;
	closePicker: () => void;
	patchNode: (
		nodeId: string,
		patch: Partial<CompanionWorkflowNodeV2> & {
			config?: Record<string, unknown>;
			inputs?: Record<string, unknown>;
			on_error?: Record<string, unknown>;
		}
	) => void;
	patchEdgeMapping: (
		flowEdgeId: string,
		mappingKey: string,
		value: string
	) => void;
	addEdgeMappingRow: (flowEdgeId: string, mappingKey: string) => void;
	removeEdgeMappingRow: (flowEdgeId: string, mappingKey: string) => void;
	onNodeTitleChange: (nodeId: string, title: string) => void;
};

const DagBuilderEditorContext =
	createContext<DagBuilderEditorContextValue | null>(null);

type ProviderProps = {
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	setNodes: React.Dispatch<React.SetStateAction<CompanionWorkflowNodeV2[]>>;
	setEdges: React.Dispatch<React.SetStateAction<CompanionWorkflowEdgeV2[]>>;
	onFlowNodeTitle?: (nodeId: string, title: string) => void;
	children: ReactNode;
};

export function DagBuilderEditorProvider({
	nodes,
	edges,
	setNodes,
	setEdges,
	onFlowNodeTitle,
	children,
}: ProviderProps) {
	const [selection, setSelection] = useState<DagSelection>({ kind: 'none' });
	const [pickerSession, setPickerSession] = useState<PickerSession>(null);

	const openPicker = useCallback(
		(anchor: PickerAnchor, anchorEl: HTMLElement | null) => {
			setPickerSession({
				anchor,
				anchorRect: anchorEl?.getBoundingClientRect() ?? null,
			});
		},
		[]
	);

	const closePicker = useCallback(() => setPickerSession(null), []);

	const patchNode = useCallback(
		(
			nodeId: string,
			patch: Partial<CompanionWorkflowNodeV2> & {
				config?: Record<string, unknown>;
				inputs?: Record<string, unknown>;
				on_error?: Record<string, unknown>;
			}
		) => {
			setNodes((current) =>
				current.map((node) => {
					if (node.id !== nodeId) return node;
					return {
						...node,
						...patch,
						config: patch.config
							? { ...(node.config ?? {}), ...patch.config }
							: node.config,
						inputs: patch.inputs
							? { ...(node.inputs ?? {}), ...patch.inputs }
							: node.inputs,
						on_error: patch.on_error
							? { ...(node.on_error ?? {}), ...patch.on_error }
							: node.on_error,
					};
				})
			);
		},
		[setNodes]
	);

	const onNodeTitleChange = useCallback(
		(nodeId: string, title: string) => {
			onFlowNodeTitle?.(nodeId, title);
		},
		[onFlowNodeTitle]
	);

	const patchEdgeMapping = useCallback(
		(flowEdgeId: string, mappingKey: string, value: string) => {
			setEdges((current) =>
				current.map((edge, index) => {
					if (semanticEdgeFlowId(edge, index) !== flowEdgeId) return edge;
					return {
						...edge,
						mapping_rules: {
							...(edge.mapping_rules ?? {}),
							[mappingKey]: value,
						},
					};
				})
			);
		},
		[setEdges]
	);

	const addEdgeMappingRow = useCallback(
		(flowEdgeId: string, mappingKey: string) => {
			setEdges((current) =>
				current.map((edge, index) => {
					if (semanticEdgeFlowId(edge, index) !== flowEdgeId) return edge;
					if (edge.mapping_rules?.[mappingKey] !== undefined) return edge;
					return {
						...edge,
						mapping_rules: {
							...(edge.mapping_rules ?? {}),
							[mappingKey]: '',
						},
					};
				})
			);
		},
		[setEdges]
	);

	const removeEdgeMappingRow = useCallback(
		(flowEdgeId: string, mappingKey: string) => {
			setEdges((current) =>
				current.map((edge, index) => {
					if (semanticEdgeFlowId(edge, index) !== flowEdgeId) return edge;
					const next = { ...(edge.mapping_rules ?? {}) };
					delete next[mappingKey];
					return { ...edge, mapping_rules: next };
				})
			);
		},
		[setEdges]
	);

	const value = useMemo(
		() => ({
			nodes,
			edges,
			selection,
			setSelection,
			pickerSession,
			openPicker,
			closePicker,
			patchNode,
			patchEdgeMapping,
			addEdgeMappingRow,
			removeEdgeMappingRow,
			onNodeTitleChange,
		}),
		[
			nodes,
			edges,
			selection,
			pickerSession,
			openPicker,
			closePicker,
			patchNode,
			patchEdgeMapping,
			addEdgeMappingRow,
			removeEdgeMappingRow,
			onNodeTitleChange,
		]
	);

	return (
		<DagBuilderEditorContext.Provider value={value}>
			{children}
		</DagBuilderEditorContext.Provider>
	);
}

export function useDagBuilderEditor(): DagBuilderEditorContextValue {
	const ctx = useContext(DagBuilderEditorContext);
	if (!ctx) {
		throw new Error('useDagBuilderEditor requires DagBuilderEditorProvider');
	}
	return ctx;
}

export function useSelectedSemanticEdge(): {
	edge: CompanionWorkflowEdgeV2;
	flowEdgeId: string;
	index: number;
} | null {
	const { edges, selection } = useDagBuilderEditor();
	if (selection.kind !== 'edge') return null;
	for (let index = 0; index < edges.length; index += 1) {
		const edge = edges[index];
		if (!edge) continue;
		const flowEdgeId = semanticEdgeFlowId(edge, index);
		if (flowEdgeId === selection.flowEdgeId) {
			return { edge, flowEdgeId, index };
		}
	}
	return findSemanticEdgeByFlowId(edges, selection.flowEdgeId);
}

export function useSelectedNode(): CompanionWorkflowNodeV2 | null {
	const { nodes, selection } = useDagBuilderEditor();
	if (selection.kind !== 'node') return null;
	return nodes.find((node) => node.id === selection.nodeId) ?? null;
}
