/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure layout + edge builders for Admin Topology Map (genEW honest-graph pattern).
 *
 * Invariants:
 * - Band-aware columns; no invented edges — only catalog-sourced TopologyEdge[].
 * - Topology key excludes health so layout stays stable across refresh.
 *
 * Related:
 * - genEW ecosystem-map/layoutGraph.ts (harvest pattern)
 * - TopologyAdminSection.tsx
 */

import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import {
	computeBandSwimlanes,
	computeTopologyAutoLayout,
	LAYOUT_COLUMN_WIDTH,
	LAYOUT_ORIGIN_X,
	LAYOUT_ORIGIN_Y,
	TOPOLOGY_LAYOUT_VERSION,
} from './topologyAutoLayout';
import type { TopologyBandSwimlane } from './topologyAutoLayout';
import type { TopologyEdge, TopologyNode } from './topologyApi';

export interface TopologyNodeData extends Record<string, unknown> {
	service: TopologyNode;
	/** When another node is selected, non-neighbors render subdued. */
	dimmed?: boolean;
}

export interface TopologyEdgeData extends Record<string, unknown> {
	kind: TopologyEdge['kind'];
	topics: string[];
}

const ORIGIN_X = LAYOUT_ORIGIN_X;
const ORIGIN_Y = LAYOUT_ORIGIN_Y;

export { TOPOLOGY_LAYOUT_VERSION };
export type { TopologyBandSwimlane };

/** Reject sessionStorage positions that would leave the map "empty" off-viewport. */
const POSITION_BOUND = 12_000;

export function isSaneTopologyPosition(pos: { x: number; y: number }): boolean {
	return (
		Number.isFinite(pos.x) &&
		Number.isFinite(pos.y) &&
		Math.abs(pos.x) <= POSITION_BOUND &&
		Math.abs(pos.y) <= POSITION_BOUND
	);
}

export function topologyKey(
	nodes: TopologyNode[],
	edges: TopologyEdge[]
): string {
	const n = [...nodes]
		.map((x) => x.id)
		.sort()
		.join(',');
	const e = [...edges]
		.map((x) => `${x.kind}:${x.source}->${x.target}`)
		.sort()
		.join(',');
	return `L${TOPOLOGY_LAYOUT_VERSION}|${n}|${e}`;
}

export function buildTopologyFlowNodes(
	services: TopologyNode[],
	stored: Record<string, { x: number; y: number }> = {}
): Node<TopologyNodeData>[] {
	const autoLayout = computeTopologyAutoLayout(services);

	return services.map((service) => {
		const auto = autoLayout.get(service.id) ?? {
			x: ORIGIN_X,
			y: ORIGIN_Y,
		};
		const storedPos = stored[service.id];
		const position =
			storedPos && isSaneTopologyPosition(storedPos) ? storedPos : auto;
		return {
			id: service.id,
			type: 'topologyService',
			position,
			data: { service },
			zIndex: 1,
		};
	});
}

const BAND_LANE_WIDTH =
	LAYOUT_ORIGIN_X + 7 * LAYOUT_COLUMN_WIDTH + LAYOUT_ORIGIN_X;

export function buildBandLaneFlowNodes(
	services: TopologyNode[]
): Node<{ band: string; width: number; height: number }>[] {
	const lanes = computeBandSwimlanes(services);
	return lanes.map((lane) => ({
		id: `__band_lane_${lane.band}`,
		type: 'topologyBandLane',
		position: { x: LAYOUT_ORIGIN_X - 16, y: lane.y - 10 },
		data: {
			band: lane.band,
			width: BAND_LANE_WIDTH,
			height: lane.height + 20,
		},
		draggable: false,
		selectable: false,
		focusable: false,
		connectable: false,
		zIndex: 0,
	}));
}

export function buildTopologyFlowNodesWithLanes(
	services: TopologyNode[],
	stored: Record<string, { x: number; y: number }> = {}
): Node<TopologyNodeData | { band: string; width: number; height: number }>[] {
	const laneNodes = buildBandLaneFlowNodes(services);
	const serviceNodes = buildTopologyFlowNodes(services, stored);
	return [...laneNodes, ...serviceNodes];
}

export function buildTopologyFlowEdges(
	edges: TopologyEdge[],
	highlightNodeId?: string | null
): Edge<TopologyEdgeData>[] {
	return edges.map((edge) => {
		const isEvent = edge.kind === 'event';
		const connected = highlightNodeId
			? edge.source === highlightNodeId || edge.target === highlightNodeId
			: true;
		const dimmed = Boolean(highlightNodeId && !connected);
		const strokeBase = isEvent
			? 'var(--admin-ui-fg-dim)'
			: 'var(--admin-ui-fg-muted)';
		const strokeActive = isEvent
			? 'var(--admin-ui-status-info)'
			: 'var(--admin-ui-fg)';
		return {
			id: edge.id,
			source: edge.source,
			target: edge.target,
			type: 'smoothstep',
			animated: isEvent && !dimmed,
			style: {
				stroke: connected && highlightNodeId ? strokeActive : strokeBase,
				strokeWidth:
					connected && highlightNodeId
						? isEvent
							? 1.75
							: 2.25
						: isEvent
							? 1.25
							: 1.75,
				strokeDasharray: isEvent ? '6 4' : undefined,
				opacity: dimmed ? 0.18 : 1,
			},
			markerEnd: {
				type: MarkerType.ArrowClosed,
				width: 14,
				height: 14,
				color: connected && highlightNodeId ? strokeActive : strokeBase,
			},
			data: {
				kind: edge.kind,
				topics: edge.topics ?? [],
			},
			label:
				isEvent && edge.topics.length && !dimmed ? edge.topics[0] : undefined,
			labelStyle: {
				fill: 'var(--admin-ui-fg-muted)',
				fontSize: 10,
			},
		};
	});
}
