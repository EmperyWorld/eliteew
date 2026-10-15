/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Navigation metadata for the unified admin shell (sections, groups, header modes).
 *
 * Invariants:
 * - `AdminSectionId` and `ADMIN_SECTION_IDS` are derived from `ADMIN_SHELL_SECTIONS` (no orphan ids).
 * - Retired legacy `ugs` is not a section id; URL migrate lives in `ugsAdminShellUrl.ts`.
 * - Group order in `ADMIN_SHELL_NAV_GROUPS` defines sidebar rendering order.
 *
 * Related:
 * - `pages/Admin/UnifiedAdminPage.tsx`
 * - `pages/Admin/shell/adminShellUrl.ts`
 */

import type { ComponentType } from 'react';
import {
	BookOpenIcon,
	BuildingStorefrontIcon,
	ChatBubbleBottomCenterTextIcon,
	ChatBubbleLeftRightIcon,
	CircleStackIcon,
	Cog6ToothIcon,
	CommandLineIcon,
	CubeIcon,
	ExclamationTriangleIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	MapIcon,
	MusicalNoteIcon,
	MegaphoneIcon,
	NewspaperIcon,
	PresentationChartBarIcon,
	SparklesIcon,
	Squares2X2Icon,
	UserCircleIcon,
	ServerStackIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export type AdminNavGroupId = 'operations' | 'product' | 'ugsAi' | 'system';

/** How the sticky content header behaves above a section body. */
export type AdminShellHeaderMode = 'none' | 'breadcrumb' | 'full';

export interface AdminShellNavGroup {
	id: AdminNavGroupId;
	label: string;
	/** i18n key under `desktopUi` (e.g. `adminShell.groups.operations`). */
	labelI18nKey?: string;
}

/** Section metadata shape; `id` literals come from `ADMIN_SHELL_SECTIONS`. */
export interface AdminShellSectionMeta {
	id: string;
	label: string;
	/** i18n key under desktopUi when set (e.g. ewaCompanionAdmin.navLabel). */
	labelI18nKey?: string;
	icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
	group: AdminNavGroupId;
	description: string;
	/** `desktopUi` key; overrides static `description` in shell header when set. */
	descriptionI18nKey?: string;
	headerMode: AdminShellHeaderMode;
	/** Optional pill in sidebar / header (e.g. v2). */
	badge?: string;
	/** `id` for full-mode heading (`aria-labelledby` in section body). */
	headerTitleId?: string;
}

export const ADMIN_SHELL_NAV_GROUPS: readonly AdminShellNavGroup[] = [
	{
		id: 'operations',
		label: 'Operations',
		labelI18nKey: 'adminShell.groups.operations',
	},
	{
		id: 'product',
		label: 'Product',
		labelI18nKey: 'adminShell.groups.product',
	},
	{
		id: 'ugsAi',
		label: 'UGS & AI',
		labelI18nKey: 'adminShell.groups.ugsAi',
	},
	{
		id: 'system',
		label: 'System',
		labelI18nKey: 'adminShell.groups.system',
	},
] as const;

export const ADMIN_SHELL_SECTIONS: readonly AdminShellSectionMeta[] = [
	{
		id: 'users',
		label: 'Users',
		labelI18nKey: 'adminShell.sections.users',
		icon: UserCircleIcon,
		group: 'operations',
		description: 'Account catalog: Socket.IO, SSO, app store, balances',
		descriptionI18nKey: 'adminShell.descriptions.users',
		headerMode: 'breadcrumb',
	},
	{
		id: 'feedback',
		label: 'Feedback',
		labelI18nKey: 'adminShell.sections.feedback',
		icon: ChatBubbleLeftRightIcon,
		group: 'operations',
		description: 'Wishlist and bug queue from the desktop Feedback app',
		descriptionI18nKey: 'adminShell.descriptions.feedback',
		headerMode: 'full',
	},
	{
		id: 'socialReports',
		label: 'Social reports',
		labelI18nKey: 'adminShell.sections.socialReports',
		icon: ExclamationTriangleIcon,
		group: 'operations',
		description: 'Social Hub user-report moderation queue',
		descriptionI18nKey: 'adminShell.descriptions.socialReports',
		headerMode: 'full',
		headerTitleId: 'admin-social-reports-title',
	},
	{
		id: 'surveys',
		label: 'Surveys',
		labelI18nKey: 'adminShell.sections.surveys',
		icon: PresentationChartBarIcon,
		group: 'operations',
		description: 'Interactive surveys, audience targeting, and results',
		descriptionI18nKey: 'adminShell.descriptions.surveys',
		headerMode: 'full',
	},
	{
		id: 'content',
		label: 'Content',
		labelI18nKey: 'adminShell.sections.content',
		icon: CubeIcon,
		group: 'operations',
		description:
			'Unified content library ops, diagnostics, and processing failures',
		descriptionI18nKey: 'adminShell.descriptions.content',
		headerMode: 'full',
		headerTitleId: 'admin-content-section-title',
	},
	{
		id: 'desktop',
		label: 'App store',
		labelI18nKey: 'adminShell.sections.desktop',
		icon: CubeIcon,
		group: 'product',
		description: 'Desktop application catalog',
		descriptionI18nKey: 'adminShell.descriptions.desktop',
		headerMode: 'breadcrumb',
	},
	{
		id: 'professionalWorlds',
		label: 'Professional Worlds',
		labelI18nKey: 'adminShell.sections.professionalWorlds',
		icon: Squares2X2Icon,
		group: 'product',
		description: 'Professional world verticals and content',
		descriptionI18nKey: 'adminShell.descriptions.professionalWorlds',
		headerMode: 'breadcrumb',
	},
	{
		id: 'ewdesk',
		label: 'EWDesk',
		labelI18nKey: 'adminShell.sections.ewdesk',
		icon: NewspaperIcon,
		group: 'product',
		description: 'Desktop feed and publications',
		descriptionI18nKey: 'ewDeskAdmin.shellSubtitle',
		headerMode: 'full',
	},
	{
		id: 'ewaCompanion',
		label: 'EWA Companion',
		labelI18nKey: 'ewaCompanionAdmin.navLabel',
		icon: CommandLineIcon,
		group: 'product',
		description: 'Tool catalog, workflows, and runs',
		descriptionI18nKey: 'ewaCompanionAdmin.subtitle',
		headerMode: 'breadcrumb',
	},
	{
		id: 'siteStudio',
		label: 'Site Studio',
		labelI18nKey: 'adminShell.sections.siteStudio',
		icon: BuildingStorefrontIcon,
		group: 'product',
		description:
			'Site Manager Ops: instances, domain binding approval, DNS/TLS, publish smoke',
		descriptionI18nKey: 'adminShell.descriptions.siteStudio',
		headerMode: 'breadcrumb',
	},
	{
		id: 'docEditor',
		label: 'Doc Editor plugins',
		labelI18nKey: 'adminShell.sections.docEditor',
		icon: BookOpenIcon,
		group: 'product',
		description: 'Document editor plugin catalog — create, enable, disable',
		descriptionI18nKey: 'adminShell.descriptions.docEditor',
		headerMode: 'full',
		headerTitleId: 'admin-doc-editor-section-title',
	},
	{
		id: 'ugsV2',
		label: 'UGS',
		labelI18nKey: 'adminShell.sections.ugsV2',
		icon: SparklesIcon,
		group: 'ugsAi',
		description: 'UGS providers, workflows, and settings',
		descriptionI18nKey: 'adminShell.descriptions.ugsV2',
		headerMode: 'breadcrumb',
	},
	{
		id: 'assistant',
		label: 'Handbook',
		labelI18nKey: 'adminShell.sections.assistant',
		icon: BookOpenIcon,
		group: 'ugsAi',
		description: 'Assistant handbook and hints',
		descriptionI18nKey: 'assistantAdmin.subtitle',
		headerMode: 'full',
	},
	{
		id: 'search',
		label: 'Web search',
		labelI18nKey: 'adminShell.sections.search',
		icon: MagnifyingGlassIcon,
		group: 'ugsAi',
		description: 'Global web search config, diagnostics, and test queries',
		descriptionI18nKey: 'adminShell.descriptions.search',
		headerMode: 'full',
		headerTitleId: 'admin-search-section-title',
	},
	{
		id: 'musicForge',
		label: 'MusicForge',
		labelI18nKey: 'adminShell.sections.musicForge',
		icon: MusicalNoteIcon,
		group: 'ugsAi',
		description:
			'Song studio runs, feedback, config revisions, and render probe',
		descriptionI18nKey: 'adminShell.descriptions.musicForge',
		headerMode: 'full',
		headerTitleId: 'admin-music-forge-section-title',
	},
	{
		id: 'kbsew',
		label: 'KBSEW',
		labelI18nKey: 'adminShell.sections.kbsew',
		icon: CircleStackIcon,
		group: 'ugsAi',
		description:
			'Knowledge barrels, PDF ingestion, agent search access, semantic search test',
		descriptionI18nKey: 'adminShell.descriptions.kbsew',
		headerMode: 'full',
		headerTitleId: 'admin-kbsew-section-title',
	},
	{
		id: 'desktopAiChat',
		label: 'Desktop AI Chat',
		labelI18nKey: 'adminShell.sections.desktopAiChat',
		icon: ChatBubbleBottomCenterTextIcon,
		group: 'ugsAi',
		description:
			'Global defaults, prompt templates, blueprint plans, and health diagnostics',
		descriptionI18nKey: 'adminShell.descriptions.desktopAiChat',
		headerMode: 'full',
		headerTitleId: 'admin-desktop-ai-chat-section-title',
	},
	{
		id: 'gaf',
		label: 'GAF: instructions',
		labelI18nKey: 'adminShell.sections.gaf',
		icon: MegaphoneIcon,
		group: 'ugsAi',
		description: 'Template and outreach in GAF Chat',
		descriptionI18nKey: 'adminShell.descriptions.gaf',
		headerMode: 'full',
		headerTitleId: 'admin-gaf-section-title',
	},
	{
		id: 'i18nRewrite',
		label: 'i18n rewrite',
		labelI18nKey: 'adminShell.sections.i18nRewrite',
		icon: GlobeAltIcon,
		group: 'system',
		description: 'Batch UI copy rewrite via stack2 llama-chat',
		descriptionI18nKey: 'adminShell.descriptions.i18nRewrite',
		headerMode: 'full',
		headerTitleId: 'admin-i18n-rewrite-section-title',
	},
	{
		id: 'workers',
		label: 'Workers',
		labelI18nKey: 'adminShell.sections.workers',
		icon: ServerStackIcon,
		group: 'system',
		description:
			'Celery pools, beat schedule, RabbitMQ queue-worker, revoke and purge',
		descriptionI18nKey: 'adminShell.descriptions.workers',
		headerMode: 'full',
		headerTitleId: 'admin-workers-section-title',
	},
	{
		id: 'platformOps',
		label: 'Platform ops',
		labelI18nKey: 'adminShell.sections.platformOps',
		icon: ShieldCheckIcon,
		group: 'system',
		description:
			'Stack0 deploy line and Podman egress status (read-only; mutate via CLI)',
		descriptionI18nKey: 'adminShell.descriptions.platformOps',
		headerMode: 'full',
		headerTitleId: 'admin-platform-ops-section-title',
	},
	{
		id: 'topology',
		label: 'Topology',
		labelI18nKey: 'adminShell.sections.topology',
		icon: MapIcon,
		group: 'system',
		description:
			'Honest platform topology map — catalog cards linked by declared deps and event flows',
		descriptionI18nKey: 'adminShell.descriptions.topology',
		headerMode: 'full',
		headerTitleId: 'admin-topology-section-title',
	},
	{
		id: 'factory',
		label: 'Factory',
		labelI18nKey: 'adminShell.sections.factory',
		icon: SparklesIcon,
		group: 'system',
		description:
			'Gen/Forge factory intentions — plan/verify; assembly Gate T∧C via ELITEEW_FACTORY_ASSEMBLY (default OFF)',
		descriptionI18nKey: 'adminShell.descriptions.factory',
		headerMode: 'full',
		headerTitleId: 'admin-factory-section-title',
	},
	{
		id: 'system',
		label: 'System',
		labelI18nKey: 'adminShell.sections.system',
		icon: Cog6ToothIcon,
		group: 'system',
		description: 'API health, cache cleanup, and external SSO console',
		descriptionI18nKey: 'adminShell.descriptions.system',
		headerMode: 'full',
	},
] as const satisfies readonly AdminShellSectionMeta[];

/** Canonical section ids — derived from nav metadata (no retired legacy `ugs`). */
export type AdminSectionId = (typeof ADMIN_SHELL_SECTIONS)[number]['id'];

export const ADMIN_SECTION_IDS: ReadonlySet<AdminSectionId> = new Set(
	ADMIN_SHELL_SECTIONS.map((s) => s.id)
);

const SECTION_BY_ID = new Map(
	ADMIN_SHELL_SECTIONS.map((s) => [s.id, s] as const)
);

export function isAdminSectionId(value: string): value is AdminSectionId {
	return ADMIN_SECTION_IDS.has(value as AdminSectionId);
}

export function getAdminShellSectionMeta(
	id: AdminSectionId
): (typeof ADMIN_SHELL_SECTIONS)[number] {
	const meta = SECTION_BY_ID.get(id);
	if (!meta) {
		throw new Error(`Unknown admin section: ${id}`);
	}
	return meta;
}

export function listAdminShellSectionsByGroup(
	groupId: AdminNavGroupId
): AdminShellSectionMeta[] {
	return ADMIN_SHELL_SECTIONS.filter((s) => s.group === groupId);
}
