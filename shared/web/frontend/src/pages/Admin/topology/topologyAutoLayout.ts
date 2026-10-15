/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Curated auto-layout for Admin Topology Map — band swimlanes + role columns
 * aligned with PRODUCTION-TOPOLOGY-STATE §Current traffic flow.
 *
 * Invariants:
 * - Left→right: presentation → API hub → auth/meet → workers → bus → data → adjunct services.
 * - Unknown catalog ids fall back to role lane + stable label sort within lane.
 * - Bump TOPOLOGY_LAYOUT_VERSION when slot contract changes (invalidates sessionStorage).
 *
 * Related:
 * - layoutTopologyGraph.ts
 * - shared/api/services/platform_topology/data/topology_catalog.json
 */

import type { TopologyNode } from './topologyApi';

/** Bump when auto-layout contract changes — session positions key includes this. */
export const TOPOLOGY_LAYOUT_VERSION = 2;

export const TOPOLOGY_POSITION_STORAGE_KEY = `eliteew.admin.topology.positions.v${TOPOLOGY_LAYOUT_VERSION}`;

export const LAYOUT_COLUMN_WIDTH = 260;
export const LAYOUT_ROW_HEIGHT = 110;
export const LAYOUT_BAND_GAP = 56;
export const LAYOUT_ORIGIN_X = 48;
export const LAYOUT_ORIGIN_Y = 40;

/** prod_core columns — ingress-facing left, data plane right. */
const PROD_CORE_COLS = 7;

type Slot = { col: number; row: number };

/** Explicit slots for living catalog ids (layout v2). */
const CATALOG_SLOTS: Readonly<Record<string, Slot>> = {
	edge: { col: 3, row: 0 },

	stack0_frontend: { col: 0, row: 0 },
	landing: { col: 0, row: 1 },
	mobile_ota: { col: 0, row: 2 },

	stack0_api: { col: 1, row: 1 },

	stack6_keycloak: { col: 2, row: 0 },
	stack11_meet: { col: 2, row: 1 },
	stack12_dns: { col: 2, row: 2 },

	stack0_queue_worker: { col: 3, row: 0 },
	stack0_celery_beat: { col: 3, row: 1 },
	stack0_celery_general: { col: 3, row: 2 },
	stack0_celery_agentic: { col: 3, row: 3 },
	stack0_celery_companion: { col: 3, row: 4 },

	stack1_rabbitmq: { col: 4, row: 1 },

	stack1_postgres: { col: 5, row: 0 },
	stack1_redis: { col: 5, row: 1 },
	stack_ewa_postgres: { col: 5, row: 2 },
	stack1_qdrant: { col: 5, row: 3 },
	stack1_elasticsearch: { col: 5, row: 4 },
	stack1_seaweedfs: { col: 5, row: 5 },

	stack2_llama_chat: { col: 6, row: 0 },
	stack4_ocr: { col: 6, row: 1 },
	kbsew: { col: 6, row: 2 },

	gpu141_embed: { col: 0, row: 0 },
	gpu141_rerank: { col: 1, row: 0 },
	gpu141_tool_router: { col: 2, row: 0 },

	command_center: { col: 0, row: 0 },
	comfyui: { col: 1, row: 0 },
};

const ROLE_LANE: Readonly<Record<string, number>> = {
	ingress: 3,
	frontend: 0,
	mobile: 0,
	api: 1,
	auth: 2,
	meet: 2,
	dns: 2,
	worker: 3,
	scheduler: 3,
	bus: 4,
	data: 5,
	inference: 6,
	docs: 6,
	knowledge: 6,
	media: 1,
	ops: 0,
};

const BAND_COLUMN_COUNT: Readonly<Record<string, number>> = {
	edge: PROD_CORE_COLS,
	prod_core: PROD_CORE_COLS,
	gpu141: 3,
	command_center: 2,
};

function slotForNode(node: TopologyNode, bandPeers: TopologyNode[]): Slot {
	const explicit = CATALOG_SLOTS[node.id];
	if (explicit) return explicit;

	const lane = ROLE_LANE[node.role] ?? 6;
	const inLane = bandPeers
		.filter((peer) => (ROLE_LANE[peer.role] ?? 6) === lane)
		.sort((a, b) => a.label.localeCompare(b.label));
	const row = inLane.findIndex((peer) => peer.id === node.id);
	return { col: lane, row: row >= 0 ? row : inLane.length };
}

function bandGridMetrics(
	nodes: TopologyNode[],
	band: string
): { rows: number; cols: number } {
	if (nodes.length === 0) return { rows: 0, cols: 0 };
	let maxRow = 0;
	let maxCol = 0;
	for (const node of nodes) {
		const slot = slotForNode(node, nodes);
		maxRow = Math.max(maxRow, slot.row);
		maxCol = Math.max(maxCol, slot.col);
	}
	const configuredCols = BAND_COLUMN_COUNT[band] ?? maxCol + 1;
	return {
		rows: maxRow + 1,
		cols: Math.max(configuredCols, maxCol + 1),
	};
}

export function computeBandAutoLayout(
	nodes: TopologyNode[],
	_band: string,
	bandOffsetY: number
): Map<string, { x: number; y: number }> {
	const positions = new Map<string, { x: number; y: number }>();
	for (const node of nodes) {
		const slot = slotForNode(node, nodes);
		positions.set(node.id, {
			x: LAYOUT_ORIGIN_X + slot.col * LAYOUT_COLUMN_WIDTH,
			y: bandOffsetY + slot.row * LAYOUT_ROW_HEIGHT,
		});
	}
	return positions;
}

export function computeTopologyAutoLayout(
	services: TopologyNode[]
): Map<string, { x: number; y: number }> {
	const byBand = new Map<string, TopologyNode[]>();
	for (const service of services) {
		const band = service.band || 'prod_core';
		const list = byBand.get(band) ?? [];
		list.push(service);
		byBand.set(band, list);
	}

	const bandOrder = ['edge', 'prod_core', 'gpu141', 'command_center'];
	const out = new Map<string, { x: number; y: number }>();
	let bandOffsetY = LAYOUT_ORIGIN_Y;

	for (const band of bandOrder) {
		const group = byBand.get(band) ?? [];
		if (group.length === 0) continue;
		const bandPositions = computeBandAutoLayout(group, band, bandOffsetY);
		for (const [id, pos] of bandPositions) {
			out.set(id, pos);
		}
		const { rows } = bandGridMetrics(group, band);
		bandOffsetY += rows * LAYOUT_ROW_HEIGHT + LAYOUT_BAND_GAP;
	}

	for (const [band, group] of byBand) {
		if (bandOrder.includes(band)) continue;
		const bandPositions = computeBandAutoLayout(group, band, bandOffsetY);
		for (const [id, pos] of bandPositions) {
			out.set(id, pos);
		}
		const { rows } = bandGridMetrics(group, band);
		bandOffsetY += rows * LAYOUT_ROW_HEIGHT + LAYOUT_BAND_GAP;
	}

	return out;
}

export interface TopologyBandSwimlane {
	band: string;
	y: number;
	height: number;
}

/** Vertical band regions for swimlane backgrounds on the canvas. */
export function computeBandSwimlanes(
	services: TopologyNode[]
): TopologyBandSwimlane[] {
	const byBand = new Map<string, TopologyNode[]>();
	for (const service of services) {
		const band = service.band || 'prod_core';
		const list = byBand.get(band) ?? [];
		list.push(service);
		byBand.set(band, list);
	}

	const bandOrder = ['edge', 'prod_core', 'gpu141', 'command_center'];
	const lanes: TopologyBandSwimlane[] = [];
	let bandOffsetY = LAYOUT_ORIGIN_Y;

	for (const band of bandOrder) {
		const group = byBand.get(band) ?? [];
		if (group.length === 0) continue;
		const { rows } = bandGridMetrics(group, band);
		const height = rows * LAYOUT_ROW_HEIGHT;
		lanes.push({ band, y: bandOffsetY, height });
		bandOffsetY += height + LAYOUT_BAND_GAP;
	}

	for (const [band, group] of byBand) {
		if (bandOrder.includes(band)) continue;
		const { rows } = bandGridMetrics(group, band);
		const height = rows * LAYOUT_ROW_HEIGHT;
		lanes.push({ band, y: bandOffsetY, height });
		bandOffsetY += height + LAYOUT_BAND_GAP;
	}

	return lanes;
}

/** Human-readable prod_core column labels for docs/tests. */
export const TOPOLOGY_LAYOUT_LANE_LABELS = [
	'presentation',
	'api hub',
	'auth / meet / dns',
	'workers',
	'message bus',
	'data plane',
	'adjunct services',
] as const;
