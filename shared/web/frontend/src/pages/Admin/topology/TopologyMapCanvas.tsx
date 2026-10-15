/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Flow canvas for Admin Topology Map (cards + dependency/event edges).
 *
 * Invariants:
 * - Explicit size + dark colorMode; deferred fitView after nodesInitialized
 *   (Desktop uiScale / Admin shell transform break first-paint fitView).
 * - nodesDraggable; not connectable (read-only map).
 *
 * Related:
 * - TopologyAdminSection.tsx
 * - genEW EcosystemMapPage.tsx (harvest fitView pattern)
 */

import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	ReactFlowProvider,
	useNodesInitialized,
	useReactFlow,
	type Edge,
	type Node,
	type NodeMouseHandler,
	type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TopologyEdgeData } from './layoutTopologyGraph';
import { TopologyBandLaneNode } from './TopologyBandLaneNode';
import { TopologyServiceNode } from './TopologyServiceNode';

const nodeTypes = {
	topologyService: TopologyServiceNode,
	topologyBandLane: TopologyBandLaneNode,
};

export interface TopologyMapCanvasProps {
	nodes: Node[];
	edges: Edge<TopologyEdgeData>[];
	onNodesChange: OnNodesChange;
	/** Bumps when operator asks Fit — forces another fitView pass. */
	fitRequestId?: number;
	/** Focus viewport on a single node (inspector action). */
	focusNodeId?: string | null;
	focusNodeRequestId?: number;
	onNodeClick?: NodeMouseHandler;
	/** Soft overlay while background refresh runs. */
	refreshing?: boolean;
}

function TopologyMapCanvasInner({
	nodes,
	edges,
	onNodesChange,
	fitRequestId = 0,
	focusNodeId = null,
	focusNodeRequestId = 0,
	onNodeClick,
	refreshing = false,
}: TopologyMapCanvasProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const types = useMemo(() => nodeTypes, []);
	const { fitView } = useReactFlow();
	const nodesInitialized = useNodesInitialized();
	const fittedLenRef = useRef(0);
	const lastFitReqRef = useRef(0);
	const lastFocusReqRef = useRef(0);

	useEffect(() => {
		if (!nodesInitialized || nodes.length === 0) return;
		const force = fitRequestId !== lastFitReqRef.current;
		if (!force && fittedLenRef.current === nodes.length) return;
		fittedLenRef.current = nodes.length;
		lastFitReqRef.current = fitRequestId;
		const id = window.requestAnimationFrame(() => {
			void fitView({ padding: 0.22, duration: force ? 280 : 0 });
		});
		return () => window.cancelAnimationFrame(id);
	}, [nodesInitialized, nodes.length, fitRequestId, fitView]);

	useEffect(() => {
		if (!nodesInitialized || !focusNodeId) return;
		if (focusNodeRequestId === lastFocusReqRef.current) return;
		lastFocusReqRef.current = focusNodeRequestId;
		const target = nodes.find((n) => n.id === focusNodeId);
		if (!target) return;
		const id = window.requestAnimationFrame(() => {
			void fitView({
				nodes: [target],
				padding: 0.55,
				duration: 320,
				maxZoom: 1.2,
			});
		});
		return () => window.cancelAnimationFrame(id);
	}, [focusNodeId, focusNodeRequestId, nodes, nodesInitialized, fitView]);

	return (
		<div className="topology-map-canvas relative h-[min(72vh,680px)] min-h-[500px] w-full overflow-hidden rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
			{refreshing ? (
				<div
					className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end bg-[var(--admin-ui-backdrop)]/20 p-3"
					aria-live="polite"
				>
					<span className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)]/95 px-2.5 py-1 text-[11px] text-[var(--admin-ui-fg-muted)]">
						{t('adminTopology.refreshing', 'Refreshing…')}
					</span>
				</div>
			) : null}
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onNodeClick={onNodeClick}
				nodeTypes={types}
				nodesDraggable
				nodesConnectable={false}
				elementsSelectable
				fitView
				fitViewOptions={{ padding: 0.22 }}
				minZoom={0.15}
				maxZoom={1.8}
				proOptions={{ hideAttribution: true }}
				colorMode="dark"
				className="h-full w-full relative z-[1]"
				style={{ width: '100%', height: '100%' }}
				onInit={(instance) => {
					void instance.fitView({ padding: 0.22 });
				}}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={20}
					size={1}
					color="rgba(255,255,255,0.08)"
				/>
				<Controls
					showInteractive={false}
					className="!rounded-[var(--admin-ui-radius-sm)] !border-[var(--admin-ui-border)] !bg-[var(--admin-ui-surface-strong)] !shadow-none [&>button]:!border-[var(--admin-ui-border)] [&>button]:!bg-[var(--admin-ui-surface)] [&>button]:!fill-[var(--admin-ui-fg-muted)]"
				/>
				<MiniMap
					pannable
					zoomable
					nodeStrokeWidth={2}
					maskColor="rgba(0,0,0,0.75)"
					className="!rounded-[var(--admin-ui-radius-sm)] !border !border-[var(--admin-ui-border)] !bg-[var(--admin-ui-surface-strong)]"
				/>
			</ReactFlow>
		</div>
	);
}

export function TopologyMapCanvas(
	props: TopologyMapCanvasProps
): React.ReactElement {
	return (
		<ReactFlowProvider>
			<TopologyMapCanvasInner {...props} />
		</ReactFlowProvider>
	);
}
