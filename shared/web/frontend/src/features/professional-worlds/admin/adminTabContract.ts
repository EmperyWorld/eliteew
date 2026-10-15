/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Professional Worlds admin tab ids and empty snapshot (shell contract without Old World chrome).
 *
 * Invariants:
 * - Tab ids must stay aligned with ProfessionalWorldsAdminSection panel switch.
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ProfessionalWorldsAdminSnapshot } from './types';

export type AdminTab =
	| 'overview'
	| 'ops'
	| 'verticals'
	| 'modules'
	| 'schemas'
	| 'ai-actions'
	| 'playbooks'
	| 'evaluation'
	| 'photo-presets'
	| 'integrations'
	| 'packs'
	| 'rollouts'
	| 'audit';

export const TABS: { id: AdminTab; labelKey: string }[] = [
	{ id: 'overview', labelKey: 'admin.tabs.overview' },
	{ id: 'ops', labelKey: 'admin.tabs.ops' },
	{ id: 'verticals', labelKey: 'admin.tabs.verticals' },
	{ id: 'modules', labelKey: 'admin.tabs.modules' },
	{ id: 'schemas', labelKey: 'admin.tabs.schemas' },
	{ id: 'ai-actions', labelKey: 'admin.tabs.aiActions' },
	{ id: 'playbooks', labelKey: 'admin.tabs.playbooks' },
	{ id: 'evaluation', labelKey: 'admin.tabs.evaluation' },
	{ id: 'photo-presets', labelKey: 'admin.tabs.photoPresets' },
	{ id: 'integrations', labelKey: 'admin.tabs.integrations' },
	{ id: 'packs', labelKey: 'admin.tabs.packs' },
	{ id: 'rollouts', labelKey: 'admin.tabs.rollouts' },
	{ id: 'audit', labelKey: 'admin.tabs.audit' },
];

export const EMPTY_SNAPSHOT: ProfessionalWorldsAdminSnapshot = {
	overview: {
		verticals_count: 0,
		modules_count: 0,
		ai_actions_count: 0,
		photo_presets_count: 0,
		enabled_integrations_count: 0,
		pack_versions_count: 0,
		pack_releases_count: 0,
		published_releases_count: 0,
		active_rollouts_count: 0,
		broken_bindings: [],
	},
	verticals: [],
	modules: [],
	assignments: [],
	schemas: [],
	aiActions: [],
	photoPresets: [],
	integrations: [],
	audit: [],
};
