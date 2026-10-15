/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bidirectional mapping between React Flow canvas state and v2 DAG payloads.
 *
 * Invariants:
 * - Semantic graph (nodes/edges) is canonical; positions live in builder_meta only.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 * - documentation/api/API-INTEGRITY-BACKLOG.md (Wave7 Pattern A cleared)
 */

import type { Edge, Node, Viewport } from '@xyflow/react';

import type {
	CompanionUserWorkflowDagBodyV2,
	CompanionWorkflowBuilderMetaV2,
	CompanionWorkflowDefinitionV2,
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type CompanionDagNodeData = {
	nodeType: string;
	title: string;
};

export const COMPANION_DAG_NODE_TYPE = 'companionDagNode';

/** React Flow node typed for companion DAG canvas (xyflow v12 NodeProps / useNodesState). */
export type CompanionDagFlowNode = Node<
	CompanionDagNodeData,
	typeof COMPANION_DAG_NODE_TYPE
>;

/** MIME for palette → canvas drag-and-drop (companion DAG builder only). */
export const COMPANION_DAG_NODE_DRAG_MIME =
	'application/x-companion-dag-node-type' as const;

const COMPANION_DAG_NODE_DRAG_SESSION_KEY =
	'companion-dag-builder-drag-node-type' as const;

export function encodeCompanionDagNodeDragType(nodeType: string): string {
	return nodeType;
}

export function writeCompanionDagNodeDragPayload(
	dataTransfer: DataTransfer,
	nodeType: string
): void {
	const encoded = encodeCompanionDagNodeDragType(nodeType);
	dataTransfer.effectAllowed = 'copy';
	dataTransfer.setData(COMPANION_DAG_NODE_DRAG_MIME, encoded);
	if (typeof window !== 'undefined') {
		window.sessionStorage.setItem(COMPANION_DAG_NODE_DRAG_SESSION_KEY, encoded);
	}
}

export function parseCompanionDagNodeDragType(
	dataTransfer: DataTransfer | null
): string | null {
	const raw =
		dataTransfer?.getData(COMPANION_DAG_NODE_DRAG_MIME) ||
		(typeof window !== 'undefined'
			? window.sessionStorage.getItem(COMPANION_DAG_NODE_DRAG_SESSION_KEY)
			: null);
	const type = String(raw || '').trim();
	return type || null;
}

export function clearCompanionDagNodeDragPayload(): void {
	if (typeof window !== 'undefined') {
		window.sessionStorage.removeItem(COMPANION_DAG_NODE_DRAG_SESSION_KEY);
	}
}

export function defaultNodePosition(index: number): { x: number; y: number } {
	return { x: 80 + index * 220, y: 120 };
}

export function definitionToCanvas(definition: CompanionWorkflowDefinitionV2): {
	nodes: CompanionDagFlowNode[];
	edges: Edge[];
	viewport: Viewport | undefined;
} {
	const positions = definition.builder_meta?.node_positions ?? {};
	const nodes: CompanionDagFlowNode[] = definition.nodes.map((node, index) => ({
		id: node.id,
		type: COMPANION_DAG_NODE_TYPE,
		position: positions[node.id] ?? defaultNodePosition(index),
		data: {
			nodeType: node.type,
			title: node.title_ru || node.title_en || node.type,
		},
	}));
	const edges: Edge[] = definition.edges.map((edge, index) => ({
		id: edgeId(edge, index),
		source: edge.source_node_id,
		target: edge.target_node_id,
		type: 'smoothstep',
		animated: false,
	}));
	const viewportRaw = definition.builder_meta?.viewport;
	const viewport =
		viewportRaw &&
		typeof viewportRaw.x === 'number' &&
		typeof viewportRaw.y === 'number' &&
		typeof viewportRaw.zoom === 'number'
			? { x: viewportRaw.x, y: viewportRaw.y, zoom: viewportRaw.zoom }
			: undefined;
	return { nodes, edges, viewport };
}

export function canvasToDagBody(
	semanticNodes: CompanionWorkflowNodeV2[],
	semanticEdges: CompanionWorkflowEdgeV2[],
	flowNodes: Node[],
	viewport?: Viewport
): CompanionUserWorkflowDagBodyV2 {
	const node_positions: CompanionWorkflowBuilderMetaV2['node_positions'] = {};
	for (const flowNode of flowNodes) {
		node_positions[flowNode.id] = {
			x: flowNode.position.x,
			y: flowNode.position.y,
		};
	}
	const builder_meta: CompanionWorkflowBuilderMetaV2 = {
		schema_version: 1,
		node_positions,
		...(viewport
			? { viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom } }
			: {}),
	};
	return {
		nodes: semanticNodes,
		edges: semanticEdges,
		builder_meta,
		execution_mode: 'async',
	};
}

export function parseDefinitionV2(
	raw: Record<string, unknown> | undefined
): CompanionWorkflowDefinitionV2 | null {
	if (!raw || intOrZero(raw.schema_version) !== 2) return null;
	if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return null;

	const workflowId =
		typeof raw.workflow_id === 'string' ? raw.workflow_id.trim() : '';
	if (!workflowId) return null;

	const triggers = Array.isArray(raw.triggers)
		? raw.triggers.flatMap((row) => {
				if (!row || typeof row !== 'object') return [];
				const rec = row as Record<string, unknown>;
				const type = typeof rec.type === 'string' ? rec.type.trim() : '';
				const pattern =
					typeof rec.pattern === 'string' ? rec.pattern.trim() : '';
				if (!type || !pattern) return [];
				return [{ type, pattern }];
			})
		: [];

	const edges = Array.isArray(raw.edges)
		? (raw.edges as CompanionWorkflowEdgeV2[])
		: [];

	const builderMeta =
		raw.builder_meta &&
		typeof raw.builder_meta === 'object' &&
		!Array.isArray(raw.builder_meta)
			? (raw.builder_meta as CompanionWorkflowBuilderMetaV2)
			: null;

	const tags = Array.isArray(raw.tags)
		? raw.tags.filter((t): t is string => typeof t === 'string')
		: undefined;

	return {
		schema_version: 2,
		workflow_id: workflowId,
		version:
			typeof raw.version === 'number' && Number.isFinite(raw.version)
				? Math.trunc(raw.version)
				: 1,
		title_ru: typeof raw.title_ru === 'string' ? raw.title_ru : '',
		title_en: typeof raw.title_en === 'string' ? raw.title_en : '',
		description_ru:
			typeof raw.description_ru === 'string' ? raw.description_ru : undefined,
		description_en:
			typeof raw.description_en === 'string' ? raw.description_en : undefined,
		enabled: Boolean(raw.enabled),
		triggers,
		nodes: raw.nodes as CompanionWorkflowNodeV2[],
		edges,
		execution_mode: raw.execution_mode === 'sync' ? 'sync' : 'async',
		env_gate:
			raw.env_gate == null
				? null
				: typeof raw.env_gate === 'string'
					? raw.env_gate
					: null,
		tags,
		builder_meta: builderMeta,
	};
}

function edgeId(edge: CompanionWorkflowEdgeV2, index: number): string {
	return `e:${edge.source_node_id}:${edge.target_node_id}:${edge.branch ?? ''}:${index}`;
}

export function semanticEdgeFlowId(
	edge: CompanionWorkflowEdgeV2,
	index: number
): string {
	return edgeId(edge, index);
}

export function findSemanticEdgeByFlowId(
	edges: CompanionWorkflowEdgeV2[],
	flowEdgeId: string
): { edge: CompanionWorkflowEdgeV2; flowEdgeId: string; index: number } | null {
	for (let index = 0; index < edges.length; index += 1) {
		const edge = edges[index];
		if (!edge) continue;
		const id = semanticEdgeFlowId(edge, index);
		if (id === flowEdgeId) return { edge, flowEdgeId: id, index };
	}
	return null;
}

function intOrZero(value: unknown): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function connectEdge(
	edges: CompanionWorkflowEdgeV2[],
	source: string,
	target: string
): CompanionWorkflowEdgeV2[] {
	if (source === target) return edges;
	const exists = edges.some(
		(edge) => edge.source_node_id === source && edge.target_node_id === target
	);
	if (exists) return edges;
	return [...edges, { source_node_id: source, target_node_id: target }];
}

export function disconnectFlowEdge(
	edges: CompanionWorkflowEdgeV2[],
	edge: Edge
): CompanionWorkflowEdgeV2[] {
	return edges.filter(
		(item) =>
			!(
				item.source_node_id === edge.source &&
				item.target_node_id === edge.target
			)
	);
}
