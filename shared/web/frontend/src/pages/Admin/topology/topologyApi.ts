/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for read-only platform topology graph (Wave G1).
 *
 * Invariants:
 * - Routes under `/api/v1/desktop/admin/topology`.
 * - `api.get` already returns the response body — do not unwrap `.data` again.
 *
 * Related:
 * - `pages/Admin/topology/TopologyAdminSection.tsx`
 * - documentation/platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md
 */

import { api } from '../../../services/api/client';

const BASE = '/api/v1/desktop/admin/topology';

export type TopologyHealth = 'ok' | 'degraded' | 'down' | 'unknown';
export type TopologyEdgeKind = 'dependency' | 'event';

export interface TopologyFactoryTouch {
	intention_id: string;
	title: string;
	stage: string;
	status: string;
	pack_stems: string[];
}

export interface TopologyNode {
	id: string;
	label: string;
	band: string;
	role: string;
	origin: string;
	features: string[];
	health: TopologyHealth;
	factory_touch?: boolean;
	factory_stage?: string | null;
	factory_status?: string | null;
	factory_touches?: TopologyFactoryTouch[];
}

export interface TopologyEdge {
	id: string;
	kind: TopologyEdgeKind;
	source: string;
	target: string;
	topics: string[];
}

export interface TopologyGraphResponse {
	schema_version: number;
	probe_scope: string;
	probed_at: string;
	source: string;
	honest_contract: string;
	nodes: TopologyNode[];
	edges: TopologyEdge[];
	counts: {
		nodes: number;
		dependency_edges: number;
		event_edges: number;
		factory_active?: number;
		factory_touched_nodes?: number;
	};
	factory_overlay?: {
		active_intentions: number;
		touched_nodes: number;
		pack_map: string;
	};
	cli_hint: string;
	legend: Record<string, string>;
}

export async function getPlatformTopologyGraph(): Promise<TopologyGraphResponse> {
	return api.get<TopologyGraphResponse>(BASE);
}
