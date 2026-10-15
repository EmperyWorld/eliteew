/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Flow canvas wrapper for companion DAG workflows with selection hooks.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 */

import { useMemo, type DragEvent } from 'react';
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	type Connection,
	type Edge,
	type OnEdgesChange,
	type OnNodesChange,
	type Viewport,
} from '@xyflow/react';

import { CompanionDagNode } from '@/features/ewa/companionWorkflowDagBuilder/canvas/nodes/CompanionDagNode';
import {
	COMPANION_DAG_NODE_TYPE,
	type CompanionDagFlowNode,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import type { DagSelection } from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderSelection';
import '@xyflow/react/dist/style.css';

type Props = {
	nodes: CompanionDagFlowNode[];
	edges: Edge[];
	selection: DagSelection;
	onNodesChange: OnNodesChange<CompanionDagFlowNode>;
	onEdgesChange: OnEdgesChange;
	onConnect: (connection: Connection) => void;
	onNodeSelect: (nodeId: string) => void;
	onEdgeSelect: (flowEdgeId: string) => void;
	onPaneClick: () => void;
	onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
	onDrop?: (event: DragEvent<HTMLDivElement>) => void;
	onViewportChange?: (viewport: Viewport) => void;
	defaultViewport?: Viewport;
};

export function CompanionDagCanvas({
	nodes,
	edges,
	selection,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeSelect,
	onEdgeSelect,
	onPaneClick,
	onDragOver,
	onDrop,
	onViewportChange,
	defaultViewport,
}: Props) {
	const nodeTypes = useMemo(
		() => ({ [COMPANION_DAG_NODE_TYPE]: CompanionDagNode }),
		[]
	);

	const selectedNodeId = selection.kind === 'node' ? selection.nodeId : null;
	const selectedEdgeId =
		selection.kind === 'edge' ? selection.flowEdgeId : null;

	const styledNodes = useMemo(
		() =>
			nodes.map((node) => ({
				...node,
				selected: node.id === selectedNodeId,
			})),
		[nodes, selectedNodeId]
	);

	const styledEdges = useMemo(
		() =>
			edges.map((edge) => ({
				...edge,
				selected: edge.id === selectedEdgeId,
				style:
					edge.id === selectedEdgeId
						? {
								stroke: 'rgb(var(--companion-aura-rgb, 147 112 219))',
								strokeWidth: 2,
							}
						: undefined,
			})),
		[edges, selectedEdgeId]
	);

	return (
		<div className="min-h-[420px] flex-1 rounded-xl border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40">
			<ReactFlow
				nodes={styledNodes}
				edges={styledEdges}
				nodeTypes={nodeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeClick={(_, node) => onNodeSelect(node.id)}
				onEdgeClick={(_, edge) => onEdgeSelect(edge.id)}
				onPaneClick={onPaneClick}
				onDragOver={onDragOver}
				onDrop={onDrop}
				onMoveEnd={(_, viewport) => onViewportChange?.(viewport)}
				defaultViewport={defaultViewport}
				fitView={!defaultViewport}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={18} size={1} />
				<MiniMap pannable zoomable />
				<Controls showInteractive={false} />
			</ReactFlow>
		</div>
	);
}
