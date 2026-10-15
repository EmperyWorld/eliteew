/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Filter, band meta, and health styling helpers for Admin Topology Map UX.
 *
 * Invariants:
 * - Pure functions only; no API calls.
 * - Edge filter keeps only edges whose endpoints are both visible.
 *
 * Related:
 * - TopologyAdminSection.tsx
 * - layoutTopologyGraph.ts
 */

import type { TopologyEdge, TopologyHealth, TopologyNode } from './topologyApi';

export const adminUiMetaClass =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

export const TOPOLOGY_BAND_ORDER = [
	'edge',
	'prod_core',
	'gpu141',
	'command_center',
] as const;

export type TopologyBandId = (typeof TOPOLOGY_BAND_ORDER)[number];

export interface TopologyBandMeta {
	id: TopologyBandId;
	labelKey: string;
	accent: string;
}

export const TOPOLOGY_BAND_META: readonly TopologyBandMeta[] = [
	{
		id: 'edge',
		labelKey: 'adminTopology.bands.edge',
		accent: 'var(--admin-ui-status-info)',
	},
	{
		id: 'prod_core',
		labelKey: 'adminTopology.bands.prodCore',
		accent: 'var(--admin-ui-accent)',
	},
	{
		id: 'gpu141',
		labelKey: 'adminTopology.bands.gpu141',
		accent: 'var(--admin-ui-status-warning)',
	},
	{
		id: 'command_center',
		labelKey: 'adminTopology.bands.commandCenter',
		accent: 'var(--admin-ui-status-success)',
	},
];

export function bandAccent(band: string): string {
	const meta = TOPOLOGY_BAND_META.find((b) => b.id === band);
	return meta?.accent ?? 'var(--admin-ui-fg-dim)';
}

export function healthTone(health: TopologyHealth): {
	color: string;
	bg: string;
	border: string;
} {
	switch (health) {
		case 'ok':
			return {
				color: 'var(--admin-ui-status-success)',
				bg: 'var(--admin-ui-status-success-bg)',
				border: 'var(--admin-ui-status-success)',
			};
		case 'degraded':
			return {
				color: 'var(--admin-ui-status-warning)',
				bg: 'var(--admin-ui-status-warning-bg)',
				border: 'var(--admin-ui-status-warning)',
			};
		case 'down':
			return {
				color: 'var(--admin-ui-status-danger)',
				bg: 'var(--admin-ui-status-danger-bg)',
				border: 'var(--admin-ui-status-danger)',
			};
		default:
			return {
				color: 'var(--admin-ui-fg-dim)',
				bg: 'var(--admin-ui-surface)',
				border: 'var(--admin-ui-border)',
			};
	}
}

export interface TopologyViewFilters {
	query: string;
	bands: ReadonlySet<string>;
	showEvents: boolean;
	showDependencies: boolean;
	factoryOnly: boolean;
}

export const TOPOLOGY_FILTERS_STORAGE_KEY = 'eliteew.admin.topology.filters';

export function defaultTopologyFilters(): TopologyViewFilters {
	return {
		query: '',
		bands: new Set<string>(),
		showEvents: true,
		showDependencies: true,
		factoryOnly: false,
	};
}

export function loadStoredTopologyFilters(): TopologyViewFilters {
	const defaults = defaultTopologyFilters();
	if (typeof sessionStorage === 'undefined') return defaults;
	try {
		const raw = sessionStorage.getItem(TOPOLOGY_FILTERS_STORAGE_KEY);
		if (!raw) return defaults;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return defaults;
		const row = parsed as Record<string, unknown>;
		const bands = Array.isArray(row.bands)
			? new Set(row.bands.filter((x): x is string => typeof x === 'string'))
			: new Set<string>();
		return {
			query: typeof row.query === 'string' ? row.query : '',
			bands,
			showEvents: row.showEvents !== false,
			showDependencies: row.showDependencies !== false,
			factoryOnly: row.factoryOnly === true,
		};
	} catch {
		return defaults;
	}
}

export function persistTopologyFilters(filters: TopologyViewFilters): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(
			TOPOLOGY_FILTERS_STORAGE_KEY,
			JSON.stringify({
				query: filters.query,
				bands: [...filters.bands],
				showEvents: filters.showEvents,
				showDependencies: filters.showDependencies,
				factoryOnly: filters.factoryOnly,
			})
		);
	} catch {
		/* ignore quota */
	}
}

export function normalizeTopologyQuery(raw: string): string {
	return raw.trim().toLowerCase();
}

export function nodeMatchesQuery(node: TopologyNode, query: string): boolean {
	if (!query) return true;
	const haystack = [
		node.id,
		node.label,
		node.role,
		node.band,
		node.origin,
		...(node.features ?? []),
	]
		.join(' ')
		.toLowerCase();
	return haystack.includes(query);
}

export function filterTopologyNodes(
	nodes: TopologyNode[],
	filters: Pick<TopologyViewFilters, 'query' | 'bands' | 'factoryOnly'>
): TopologyNode[] {
	const query = normalizeTopologyQuery(filters.query);
	const bandFilterActive = filters.bands.size > 0;
	return nodes.filter((node) => {
		if (filters.factoryOnly && !node.factory_touch) return false;
		if (bandFilterActive && !filters.bands.has(node.band)) return false;
		return nodeMatchesQuery(node, query);
	});
}

export function filterTopologyEdges(
	edges: TopologyEdge[],
	visibleNodeIds: ReadonlySet<string>,
	filters: Pick<TopologyViewFilters, 'showEvents' | 'showDependencies'>
): TopologyEdge[] {
	return edges.filter((edge) => {
		if (!filters.showEvents && edge.kind === 'event') return false;
		if (!filters.showDependencies && edge.kind === 'dependency') return false;
		return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
	});
}

export function applyTopologyViewFilters(
	nodes: TopologyNode[],
	edges: TopologyEdge[],
	filters: TopologyViewFilters
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
	const visibleNodes = filterTopologyNodes(nodes, filters);
	const visibleIds = new Set(visibleNodes.map((n) => n.id));
	const visibleEdges = filterTopologyEdges(edges, visibleIds, filters);
	return { nodes: visibleNodes, edges: visibleEdges };
}

/** Keep inspector target on canvas even when filters would hide it. */
export function ensureSelectedNodeVisible(
	visibleNodes: TopologyNode[],
	allNodes: TopologyNode[],
	selectedId: string | null
): TopologyNode[] {
	if (!selectedId || visibleNodes.some((n) => n.id === selectedId)) {
		return visibleNodes;
	}
	const selected = allNodes.find((n) => n.id === selectedId);
	return selected ? [...visibleNodes, selected] : visibleNodes;
}

export function collectBandsPresent(nodes: TopologyNode[]): TopologyBandId[] {
	const present = new Set(nodes.map((n) => n.band));
	return TOPOLOGY_BAND_ORDER.filter((id) => present.has(id));
}

export function formatProbedAt(iso: string | undefined): string {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString(undefined, {
		dateStyle: 'short',
		timeStyle: 'medium',
	});
}
