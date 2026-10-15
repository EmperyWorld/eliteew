/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin section — platform topology map (honest catalog cards + edges).
 *
 * Invariants:
 * - Read-only; no mutate. Empty/error/loading are honest.
 * - Auto-refresh does not invent mesh; unknown health stays unknown.
 *
 * Related:
 * - topologyApi.ts
 * - documentation/platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md
 */

import {
	applyNodeChanges,
	type Edge,
	type Node,
	type NodeMouseHandler,
	type OnNodesChange,
} from '@xyflow/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import { AdminButton, AdminStatusBanner } from '../ui';
import {
	buildBandLaneFlowNodes,
	buildTopologyFlowEdges,
	buildTopologyFlowNodes,
	topologyKey,
	type TopologyEdgeData,
} from './layoutTopologyGraph';
import { TopologyAdminToolbar } from './TopologyAdminToolbar';
import { TopologyMapCanvas } from './TopologyMapCanvas';
import { TopologyMapSkeleton } from './TopologyMapSkeleton';
import { TopologyNodeInspector } from './TopologyNodeInspector';
import { TOPOLOGY_POSITION_STORAGE_KEY } from './topologyAutoLayout';
import {
	applyTopologyViewFilters,
	defaultTopologyFilters,
	ensureSelectedNodeVisible,
	loadStoredTopologyFilters,
	persistTopologyFilters,
	filterTopologyEdges,
	type TopologyViewFilters,
} from './topologyAdminHelpers';
import {
	getPlatformTopologyGraph,
	type TopologyGraphResponse,
	type TopologyNode,
} from './topologyApi';

const REFRESH_MS = 30_000;
const POSITION_KEY = TOPOLOGY_POSITION_STORAGE_KEY;

const DEFAULT_FILTERS: TopologyViewFilters = loadStoredTopologyFilters();

function loadPositions(): Record<string, { x: number; y: number }> {
	if (typeof sessionStorage === 'undefined') return {};
	try {
		const raw = sessionStorage.getItem(POSITION_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return {};
		const out: Record<string, { x: number; y: number }> = {};
		for (const [id, pos] of Object.entries(parsed as Record<string, unknown>)) {
			if (
				pos &&
				typeof pos === 'object' &&
				typeof (pos as { x?: unknown }).x === 'number' &&
				typeof (pos as { y?: unknown }).y === 'number'
			) {
				out[id] = { x: (pos as { x: number }).x, y: (pos as { y: number }).y };
			}
		}
		return out;
	} catch {
		return {};
	}
}

function persistPositions(nodes: Node[]): void {
	if (typeof sessionStorage === 'undefined') return;
	const next: Record<string, { x: number; y: number }> = {};
	for (const n of nodes) {
		if (n.type !== 'topologyService') continue;
		next[n.id] = { x: n.position.x, y: n.position.y };
	}
	try {
		sessionStorage.setItem(POSITION_KEY, JSON.stringify(next));
	} catch {
		/* ignore quota */
	}
}

function mergeFlowNodesFromCatalog(
	prev: Node[],
	catalogNodes: TopologyNode[],
	stored: Record<string, { x: number; y: number }>,
	selectedId: string | null
): Node[] {
	const laneNodes = buildBandLaneFlowNodes(catalogNodes);
	const built = buildTopologyFlowNodes(catalogNodes, stored);
	const prevById = new Map(
		prev
			.filter((n) => n.type === 'topologyService')
			.map((n) => [n.id, n] as const)
	);
	const serviceNodes = built.map((n) => {
		const prior = prevById.get(n.id);
		const dimmed = Boolean(selectedId && n.id !== selectedId);
		return {
			...n,
			position: prior?.position ?? n.position,
			selected: n.id === selectedId,
			data: { ...n.data, dimmed },
		};
	});
	return [...laneNodes, ...serviceNodes];
}

export interface TopologyAdminSectionProps {
	urlSyncEnabled?: boolean;
}

export function TopologyAdminSection({
	urlSyncEnabled: _urlSyncEnabled = true,
}: TopologyAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const meta = getAdminShellSectionMeta('topology');
	const [graph, setGraph] = React.useState<TopologyGraphResponse | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [nodes, setNodes] = React.useState<Node[]>([]);
	const [edges, setEdges] = React.useState<Edge<TopologyEdgeData>[]>([]);
	const [fitRequestId, setFitRequestId] = React.useState(0);
	const [focusNodeRequestId, setFocusNodeRequestId] = React.useState(0);
	const [filters, setFilters] =
		React.useState<TopologyViewFilters>(DEFAULT_FILTERS);
	const [inspectorNode, setInspectorNode] = React.useState<TopologyNode | null>(
		null
	);
	const lastKeyRef = React.useRef<string>('');
	const nodesRef = React.useRef<Node[]>([]);
	const filtersRef = React.useRef(filters);
	const inspectorRef = React.useRef(inspectorNode);

	React.useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

	React.useEffect(() => {
		filtersRef.current = filters;
	}, [filters]);

	React.useEffect(() => {
		inspectorRef.current = inspectorNode;
	}, [inspectorNode]);

	const syncView = React.useCallback(
		(
			payload: TopologyGraphResponse,
			viewFilters: TopologyViewFilters,
			selectedId: string | null,
			opts?: { forceLayoutReset?: boolean }
		) => {
			if (opts?.forceLayoutReset) {
				lastKeyRef.current = '';
			}
			const { nodes: visibleNodes } = applyTopologyViewFilters(
				payload.nodes,
				payload.edges,
				viewFilters
			);
			const nodesForCanvas = ensureSelectedNodeVisible(
				visibleNodes,
				payload.nodes,
				selectedId
			);
			const visibleIds = new Set(nodesForCanvas.map((n) => n.id));
			const edgesForCanvas = filterTopologyEdges(
				payload.edges,
				visibleIds,
				viewFilters
			);
			const stored = loadPositions();
			const key = topologyKey(payload.nodes, payload.edges);
			const prev = nodesRef.current;

			if (key !== lastKeyRef.current) {
				lastKeyRef.current = key;
				setNodes(
					mergeFlowNodesFromCatalog([], nodesForCanvas, stored, selectedId)
				);
			} else {
				setNodes(
					mergeFlowNodesFromCatalog(prev, nodesForCanvas, stored, selectedId)
				);
			}
			setEdges(buildTopologyFlowEdges(edgesForCanvas, selectedId));
		},
		[]
	);

	const handleFiltersChange = React.useCallback((next: TopologyViewFilters) => {
		setFilters(next);
		persistTopologyFilters(next);
	}, []);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const payload = await getPlatformTopologyGraph();
			setGraph(payload);
			syncView(payload, filtersRef.current, inspectorRef.current?.id ?? null);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [syncView]);

	React.useEffect(() => {
		void refresh();
		const id = window.setInterval(() => {
			void refresh();
		}, REFRESH_MS);
		return () => window.clearInterval(id);
	}, [refresh]);

	React.useEffect(() => {
		if (!graph) return;
		syncView(graph, filters, inspectorNode?.id ?? null);
	}, [graph, filters, inspectorNode?.id, syncView]);

	const resetLayout = React.useCallback(() => {
		if (!graph) return;
		try {
			sessionStorage.removeItem(POSITION_KEY);
		} catch {
			/* ignore */
		}
		syncView(graph, filters, inspectorNode?.id ?? null, {
			forceLayoutReset: true,
		});
		setFitRequestId((n) => n + 1);
	}, [filters, graph, inspectorNode?.id, syncView]);

	const selectNodeById = React.useCallback(
		(nodeId: string) => {
			if (!graph) return;
			const fresh = graph.nodes.find((n) => n.id === nodeId);
			if (!fresh) return;
			setInspectorNode(fresh);
			syncView(graph, filtersRef.current, nodeId);
		},
		[graph, syncView]
	);

	const onNodesChange: OnNodesChange = React.useCallback((changes) => {
		setNodes((prev) => {
			const next = applyNodeChanges(changes, prev);
			persistPositions(next);
			return next;
		});
	}, []);

	const onNodeClick: NodeMouseHandler = React.useCallback(
		(_event, node) => {
			if (node.type !== 'topologyService') return;
			selectNodeById(node.id);
		},
		[selectNodeById]
	);

	const focusInspectorOnMap = React.useCallback(() => {
		if (!inspectorNode) return;
		setFocusNodeRequestId((n) => n + 1);
	}, [inspectorNode]);

	const visibleNodeCount = React.useMemo(() => {
		if (!graph) return 0;
		return applyTopologyViewFilters(graph.nodes, graph.edges, filters).nodes
			.length;
	}, [graph, filters]);

	const filterEmpty =
		graph != null &&
		visibleNodeCount === 0 &&
		(filters.query.trim() !== '' ||
			filters.bands.size > 0 ||
			filters.factoryOnly);

	return (
		<AdminSectionFrame variant="full">
			<div className="flex h-full min-h-0 flex-col gap-4 p-4">
				<header className="min-w-0">
					<h2
						id={meta.headerTitleId}
						className="text-[length:var(--admin-ui-text-lg)] font-semibold text-[var(--admin-ui-fg)]"
					>
						{t(meta.labelI18nKey ?? '', meta.label)}
					</h2>
					<p className="mt-1 max-w-3xl text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
						{t(meta.descriptionI18nKey ?? '', meta.description)}
					</p>
				</header>

				<TopologyAdminToolbar
					graph={graph}
					filters={filters}
					onFiltersChange={handleFiltersChange}
					visibleNodeCount={visibleNodeCount}
					loading={loading}
					onFitView={() => setFitRequestId((n) => n + 1)}
					onResetLayout={() => resetLayout()}
					onRefresh={() => void refresh()}
					canResetLayout={Boolean(graph) && nodes.length > 0}
					canFitView={nodes.length > 0}
				/>

				{error ? (
					<AdminStatusBanner
						tone="danger"
						title={t('adminTopology.loadFailed', { error })}
					>
						<AdminButton
							variant="secondary"
							className="mt-2"
							onClick={() => void refresh()}
						>
							{t('adminTopology.retry', 'Try again')}
						</AdminButton>
					</AdminStatusBanner>
				) : null}

				{!error && !graph && loading ? <TopologyMapSkeleton /> : null}

				{graph && nodes.length === 0 && !filterEmpty ? (
					<AdminStatusBanner tone="info" title={t('adminTopology.empty')} />
				) : null}

				{filterEmpty ? (
					<AdminStatusBanner
						tone="info"
						title={t(
							'adminTopology.filterEmpty',
							'No services match the current filters.'
						)}
					>
						<AdminButton
							variant="ghost"
							className="mt-2"
							onClick={() => handleFiltersChange(defaultTopologyFilters())}
						>
							{t('adminTopology.clearFilters', 'Clear filters')}
						</AdminButton>
					</AdminStatusBanner>
				) : null}

				{nodes.length > 0 ? (
					<div className="min-h-0 w-full shrink-0">
						<TopologyMapCanvas
							nodes={nodes}
							edges={edges}
							onNodesChange={onNodesChange}
							fitRequestId={fitRequestId}
							focusNodeId={inspectorNode?.id ?? null}
							focusNodeRequestId={focusNodeRequestId}
							onNodeClick={onNodeClick}
							refreshing={loading && graph != null}
						/>
						<p className="mt-2 text-center text-[11px] text-[var(--admin-ui-fg-dim)]">
							{t(
								'adminTopology.clickHint',
								'Click a service card for details · drag to rearrange'
							)}
						</p>
					</div>
				) : null}

				<TopologyNodeInspector
					node={inspectorNode}
					allNodes={graph?.nodes ?? []}
					edges={graph?.edges ?? []}
					onClose={() => {
						setInspectorNode(null);
						if (graph) {
							syncView(graph, filtersRef.current, null);
						}
					}}
					onNavigateToNode={selectNodeById}
					onFocusOnMap={focusInspectorOnMap}
				/>
			</div>
		</AdminSectionFrame>
	);
}
