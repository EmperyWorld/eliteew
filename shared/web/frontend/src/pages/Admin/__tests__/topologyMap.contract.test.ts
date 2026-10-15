/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for Admin topology API client + honest layout/edge builders.
 *
 * Related:
 * - pages/Admin/topology/topologyApi.ts
 * - pages/Admin/topology/layoutTopologyGraph.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildTopologyFlowEdges,
	buildTopologyFlowNodes,
	topologyKey,
} from '../topology/layoutTopologyGraph';
import {
	computeTopologyAutoLayout,
	LAYOUT_COLUMN_WIDTH,
	LAYOUT_ORIGIN_X,
} from '../topology/topologyAutoLayout';
import {
	applyTopologyViewFilters,
	filterTopologyEdges,
	nodeMatchesQuery,
} from '../topology/topologyAdminHelpers';
import type { TopologyEdge, TopologyNode } from '../topology/topologyApi';

vi.mock('../../../services/api/client', () => ({
	api: {
		get: vi.fn(),
	},
}));

describe('topologyApi contract', () => {
	it('GETs desktop admin topology base', async () => {
		const { api } = await import('../../../services/api/client');
		vi.mocked(api.get).mockResolvedValueOnce({
			schema_version: 1,
			nodes: [],
			edges: [],
			counts: { nodes: 0, dependency_edges: 0, event_edges: 0 },
		});
		const { getPlatformTopologyGraph } = await import(
			'../topology/topologyApi'
		);
		await getPlatformTopologyGraph();
		expect(api.get).toHaveBeenCalledWith('/api/v1/desktop/admin/topology');
	});
});

describe('layoutTopologyGraph', () => {
	const nodes: TopologyNode[] = [
		{
			id: 'a',
			label: 'A',
			band: 'prod_core',
			role: 'api',
			origin: 'platform',
			features: [],
			health: 'ok',
		},
		{
			id: 'b',
			label: 'B',
			band: 'gpu141',
			role: 'inference',
			origin: 'platform',
			features: ['embed'],
			health: 'unknown',
		},
	];
	const edges: TopologyEdge[] = [
		{
			id: 'dep:a->b',
			kind: 'dependency',
			source: 'a',
			target: 'b',
			topics: [],
		},
		{
			id: 'event:a->b',
			kind: 'event',
			source: 'a',
			target: 'b',
			topics: ['amqp.test'],
		},
	];

	it('builds one flow node per catalog node', () => {
		const flow = buildTopologyFlowNodes(nodes);
		expect(flow.map((n) => n.id).sort()).toEqual(['a', 'b']);
		expect(flow.every((n) => n.type === 'topologyService')).toBe(true);
	});

	it('marks event edges dashed/animated and keeps dependency solid', () => {
		const flowEdges = buildTopologyFlowEdges(edges);
		const dep = flowEdges.find((e) => e.id === 'dep:a->b');
		const ev = flowEdges.find((e) => e.id === 'event:a->b');
		expect(dep?.animated).toBeFalsy();
		expect(ev?.animated).toBe(true);
		expect(ev?.data?.topics).toEqual(['amqp.test']);
	});

	it('topologyKey ignores health (layout stable across refresh)', () => {
		const k1 = topologyKey(nodes, edges);
		const mutated = nodes.map((n) =>
			n.id === 'b' ? { ...n, health: 'ok' as const } : n
		);
		expect(topologyKey(mutated, edges)).toBe(k1);
	});

	it('rejects insane stored positions so layout stays on-canvas', () => {
		const flow = buildTopologyFlowNodes(nodes, {
			a: { x: 1e9, y: -1e9 },
			b: { x: 40, y: 40 },
		});
		const a = flow.find((n) => n.id === 'a');
		const b = flow.find((n) => n.id === 'b');
		expect(a?.position.x).not.toBe(1e9);
		expect(b?.position).toEqual({ x: 40, y: 40 });
	});

	it('uses role lanes: API hub is left of data plane', () => {
		const positions = computeTopologyAutoLayout([
			{
				id: 'stack0_api',
				label: 'stack0 API',
				band: 'prod_core',
				role: 'api',
				origin: 'platform',
				features: [],
				health: 'ok',
			},
			{
				id: 'stack1_postgres',
				label: 'Postgres',
				band: 'prod_core',
				role: 'data',
				origin: 'platform',
				features: [],
				health: 'unknown',
			},
		]);
		const api = positions.get('stack0_api');
		const pg = positions.get('stack1_postgres');
		expect(api?.x).toBeDefined();
		expect(pg?.x).toBeDefined();
		if (api == null || pg == null) return;
		expect(api.x).toBeLessThan(pg.x);
		expect(api.x).toBe(LAYOUT_ORIGIN_X + LAYOUT_COLUMN_WIDTH);
	});

	it('stacks bands vertically edge → prod_core → gpu141', () => {
		const positions = computeTopologyAutoLayout([
			{
				id: 'edge',
				label: 'edge',
				band: 'edge',
				role: 'ingress',
				origin: 'platform',
				features: [],
				health: 'unknown',
			},
			{
				id: 'stack0_api',
				label: 'api',
				band: 'prod_core',
				role: 'api',
				origin: 'platform',
				features: [],
				health: 'ok',
			},
			{
				id: 'gpu141_embed',
				label: 'embed',
				band: 'gpu141',
				role: 'inference',
				origin: 'platform',
				features: [],
				health: 'unknown',
			},
		]);
		const edgeY = positions.get('edge')?.y;
		const apiY = positions.get('stack0_api')?.y;
		const gpuY = positions.get('gpu141_embed')?.y;
		expect(edgeY).toBeDefined();
		expect(apiY).toBeDefined();
		expect(gpuY).toBeDefined();
		if (edgeY == null || apiY == null || gpuY == null) return;
		expect(edgeY).toBeLessThan(apiY);
		expect(apiY).toBeLessThan(gpuY);
	});
});

describe('topologyAdminHelpers', () => {
	const nodes: TopologyNode[] = [
		{
			id: 'api',
			label: 'stack0 API',
			band: 'prod_core',
			role: 'api',
			origin: 'platform',
			features: ['fastapi'],
			health: 'ok',
		},
		{
			id: 'embed',
			label: 'embed',
			band: 'gpu141',
			role: 'inference',
			origin: 'platform',
			features: ['embed'],
			health: 'unknown',
		},
	];
	const edges: TopologyEdge[] = [
		{
			id: 'dep:api->embed',
			kind: 'dependency',
			source: 'api',
			target: 'embed',
			topics: [],
		},
		{
			id: 'event:api->embed',
			kind: 'event',
			source: 'api',
			target: 'embed',
			topics: ['amqp.test'],
		},
	];

	it('filters nodes by query and band', () => {
		expect(nodeMatchesQuery(nodes[0], 'fastapi')).toBe(true);
		expect(nodeMatchesQuery(nodes[1], 'fastapi')).toBe(false);
		const filtered = applyTopologyViewFilters(nodes, edges, {
			query: 'embed',
			bands: new Set(['gpu141']),
			showEvents: true,
			showDependencies: true,
			factoryOnly: false,
		});
		expect(filtered.nodes.map((n) => n.id)).toEqual(['embed']);
		expect(filtered.edges).toHaveLength(0);
	});

	it('hides event edges when showEvents is false', () => {
		const visibleIds = new Set(['api', 'embed']);
		const onlyDep = filterTopologyEdges(edges, visibleIds, {
			showEvents: false,
			showDependencies: true,
		});
		expect(onlyDep).toHaveLength(1);
		expect(onlyDep[0]?.kind).toBe('dependency');
	});

	it('filters factory-only nodes', () => {
		const withFactory: TopologyNode[] = [
			{ ...nodes[0], factory_touch: true },
			nodes[1],
		];
		const filtered = applyTopologyViewFilters(withFactory, edges, {
			query: '',
			bands: new Set(),
			showEvents: true,
			showDependencies: true,
			factoryOnly: true,
		});
		expect(filtered.nodes).toHaveLength(1);
		expect(filtered.nodes[0]?.id).toBe('api');
	});

	it('highlights edges connected to selected node', () => {
		const flowEdges = buildTopologyFlowEdges(edges, 'api');
		const connected = flowEdges.find((e) => e.id === 'dep:api->embed');
		const dimmed = flowEdges.find((e) => e.id === 'event:api->embed');
		expect(connected?.style?.opacity).toBe(1);
		expect(dimmed?.style?.opacity).toBe(1);
		expect(connected?.style?.strokeWidth).toBeGreaterThan(1.75);
	});
});
