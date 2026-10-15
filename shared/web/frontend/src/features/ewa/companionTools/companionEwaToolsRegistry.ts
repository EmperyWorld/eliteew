/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical map of EWA companion server tools → user catalog: access channels and quick-intent linkage.
 *
 * Invariants:
 * - ``ewaToolName`` values match ``tool_registry`` / ``user_workflow_allowlist`` names.
 * - Built-in quick chips dedupe extended rows when ``builtinKey`` is set on the chip entry.
 *
 * Related:
 * - api/ewa_platform/companion/orchestration/tool_registry.py
 * - api/ewa_platform/companion/ux/quick_intents.py
 * - documentation/product/ewa/EWA-COMPANION-QUICK-INTENTS.md
 */

import type { BuiltinQuickPresetKey } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import type { CompanionToolCategoryId } from '@/features/ewa/companionTools/companionToolsCatalogUi';
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import type { EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionToolAccessChannel =
	| 'quick_chip'
	| 'chat'
	| 'workflow'
	| 'slash';

export type CompanionEwaToolSpec = {
	/** Stable catalog id (builtin key or ewa tool name). */
	id: string;
	ewaToolNames: readonly string[];
	builtinKey?: BuiltinQuickPresetKey;
	category: CompanionToolCategoryId;
	access: readonly CompanionToolAccessChannel[];
	icon: EwaIconId;
	tone: EwaIconTone;
	/** i18n suffix under ``ewaCompanion.toolsCatalog.ewaTools.{id}`` */
	i18nKey: string;
	sortOrder: number;
	needsEditor?: boolean;
	desktopOnly?: boolean;
};

/** Built-in quick-intent chips ↔ server tools (22 chip keys + EWA-only catalog rows). */
export const COMPANION_BUILTIN_EWA_TOOL_SPECS: readonly CompanionEwaToolSpec[] =
	[
		{
			id: 'documentList',
			ewaToolNames: ['catalog_list'],
			builtinKey: 'documentList',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow', 'slash'],
			icon: 'icon-search-default',
			tone: 'brand',
			i18nKey: 'documentList',
			sortOrder: 10,
		},
		{
			id: 'documentOpen',
			ewaToolNames: ['file_open'],
			builtinKey: 'documentOpen',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-plugins',
			tone: 'brand',
			i18nKey: 'documentOpen',
			sortOrder: 20,
		},
		{
			id: 'documentCreate',
			ewaToolNames: ['file_create'],
			builtinKey: 'documentCreate',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-bookmark',
			tone: 'aura',
			i18nKey: 'documentCreate',
			sortOrder: 30,
		},
		{
			id: 'documentRewrite',
			ewaToolNames: ['file_rewrite'],
			builtinKey: 'documentRewrite',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-high-contrast',
			tone: 'aura',
			i18nKey: 'documentRewrite',
			sortOrder: 40,
			needsEditor: true,
		},
		{
			id: 'catalogDiscuss',
			ewaToolNames: ['catalog_discuss'],
			builtinKey: 'catalogDiscuss',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-focus-indicator',
			tone: 'muted',
			i18nKey: 'catalogDiscuss',
			sortOrder: 50,
			needsEditor: true,
		},
		{
			id: 'fileRename',
			ewaToolNames: ['file_rename'],
			builtinKey: 'fileRename',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-drag-handle',
			tone: 'aura',
			i18nKey: 'fileRename',
			sortOrder: 60,
		},
		{
			id: 'fileDelete',
			ewaToolNames: ['file_delete'],
			builtinKey: 'fileDelete',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-delete-default',
			tone: 'danger',
			i18nKey: 'fileDelete',
			sortOrder: 70,
		},
		{
			id: 'doc_insert',
			ewaToolNames: ['doc_insert'],
			category: 'files',
			access: ['chat', 'workflow'],
			icon: 'icon-ewa-plugins',
			tone: 'brand',
			i18nKey: 'doc_insert',
			sortOrder: 75,
			needsEditor: true,
		},
		{
			id: 'paperless_import',
			ewaToolNames: ['paperless_import'],
			category: 'files',
			access: ['chat', 'workflow'],
			icon: 'icon-bookmark',
			tone: 'muted',
			i18nKey: 'paperless_import',
			sortOrder: 78,
		},
		{
			id: 'imageGenerate',
			ewaToolNames: ['image_generation'],
			builtinKey: 'imageGenerate',
			category: 'images',
			access: ['quick_chip', 'chat', 'workflow', 'slash'],
			icon: 'icon-star-filled',
			tone: 'aura',
			i18nKey: 'imageGenerate',
			sortOrder: 100,
		},
		{
			id: 'imageEdit',
			ewaToolNames: ['image_generation'],
			builtinKey: 'imageEdit',
			category: 'images',
			access: ['quick_chip', 'chat'],
			icon: 'icon-drag-handle',
			tone: 'brand',
			i18nKey: 'imageEdit',
			sortOrder: 110,
		},
		{
			id: 'imageAnalyze',
			ewaToolNames: [],
			builtinKey: 'imageAnalyze',
			category: 'images',
			access: ['quick_chip', 'chat'],
			icon: 'icon-focus-indicator',
			tone: 'muted',
			i18nKey: 'imageAnalyze',
			sortOrder: 120,
		},
		{
			id: 'imageTool',
			ewaToolNames: ['image_tool'],
			category: 'images',
			access: ['chat'],
			icon: 'icon-star-filled',
			tone: 'brand',
			i18nKey: 'imageTool',
			sortOrder: 121,
		},
		{
			id: 'imageOcr',
			ewaToolNames: [],
			category: 'images',
			access: ['quick_chip'],
			icon: 'icon-high-contrast',
			tone: 'brand',
			i18nKey: 'imageOcr',
			sortOrder: 125,
		},
		{
			id: 'presentationCreate',
			ewaToolNames: ['presentation_generation'],
			builtinKey: 'presentationCreate',
			category: 'images',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-analytics',
			tone: 'aura',
			i18nKey: 'presentationCreate',
			sortOrder: 130,
		},
		{
			id: 'presentationOnTopic',
			ewaToolNames: ['presentation_generation'],
			builtinKey: 'presentationOnTopic',
			category: 'images',
			access: ['quick_chip', 'chat'],
			icon: 'icon-ewa-analytics',
			tone: 'brand',
			i18nKey: 'presentationOnTopic',
			sortOrder: 132,
		},
		{
			id: 'socialPostCompose',
			ewaToolNames: ['social_post_compose'],
			builtinKey: 'socialPostCompose',
			category: 'files',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-dashboard',
			tone: 'brand',
			i18nKey: 'socialPostCompose',
			sortOrder: 135,
		},
		{
			id: 'longreadCompose',
			ewaToolNames: ['social_post_compose'],
			category: 'files',
			access: ['chat'],
			icon: 'icon-ewa-dashboard',
			tone: 'aura',
			i18nKey: 'longreadCompose',
			sortOrder: 136,
		},
		{
			id: 'musicGenerate',
			ewaToolNames: ['music_generation'],
			builtinKey: 'musicGenerate',
			category: 'music',
			access: ['quick_chip', 'chat', 'workflow', 'slash'],
			icon: 'icon-pulse',
			tone: 'brand',
			i18nKey: 'musicGenerate',
			sortOrder: 200,
		},
		{
			id: 'musicOnTopic',
			ewaToolNames: ['music_generation'],
			builtinKey: 'musicOnTopic',
			category: 'music',
			access: ['quick_chip', 'chat'],
			icon: 'icon-pulse',
			tone: 'aura',
			i18nKey: 'musicOnTopic',
			sortOrder: 205,
		},
		{
			id: 'musicAutonomous',
			ewaToolNames: ['music_generation_xl_base'],
			builtinKey: 'musicAutonomous',
			category: 'music',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-perplexity',
			tone: 'brand',
			i18nKey: 'musicAutonomous',
			sortOrder: 210,
		},
		{
			id: 'xlBaseInteractive',
			ewaToolNames: ['music_xl_base_interactive'],
			builtinKey: 'xlBaseInteractive',
			category: 'music',
			access: ['quick_chip', 'chat'],
			icon: 'icon-pulse',
			tone: 'brand',
			i18nKey: 'xlBaseInteractive',
			sortOrder: 220,
		},
		{
			id: 'musicStudioOpen',
			ewaToolNames: ['music_studio_open'],
			builtinKey: 'musicStudioOpen',
			category: 'music',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-perplexity',
			tone: 'brand',
			i18nKey: 'musicStudioOpen',
			sortOrder: 230,
			desktopOnly: true,
		},
		{
			id: 'operationsStatus',
			ewaToolNames: ['operations_status', 'check_task_status'],
			builtinKey: 'operationsStatus',
			category: 'desk',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-ewa-dashboard',
			tone: 'brand',
			i18nKey: 'operationsStatus',
			sortOrder: 300,
		},
		{
			id: 'operationsCancel',
			ewaToolNames: ['operation_cancel'],
			builtinKey: 'operationsCancel',
			category: 'desk',
			access: ['quick_chip', 'chat'],
			icon: 'icon-warning',
			tone: 'warning',
			i18nKey: 'operationsCancel',
			sortOrder: 310,
		},
		{
			id: 'app_open',
			ewaToolNames: ['app_open'],
			category: 'desk',
			access: ['chat', 'workflow'],
			icon: 'icon-ewa-dashboard',
			tone: 'brand',
			i18nKey: 'app_open',
			sortOrder: 320,
			desktopOnly: true,
		},
		{
			id: 'planWeek',
			ewaToolNames: ['plan_v1'],
			builtinKey: 'planWeek',
			category: 'plan',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-success',
			tone: 'success',
			i18nKey: 'planWeek',
			sortOrder: 400,
		},
		{
			id: 'plan_task_complete',
			ewaToolNames: ['plan_task_complete_v1'],
			category: 'plan',
			access: ['chat'],
			icon: 'icon-success',
			tone: 'success',
			i18nKey: 'plan_task_complete',
			sortOrder: 410,
		},
		{
			id: 'reflect_week',
			ewaToolNames: [],
			category: 'plan',
			access: ['chat', 'workflow'],
			icon: 'icon-ewa-analytics',
			tone: 'aura',
			i18nKey: 'reflect_week',
			sortOrder: 420,
		},
		{
			id: 'recall_memory',
			ewaToolNames: ['recall_memory'],
			category: 'memory',
			access: ['chat', 'workflow'],
			icon: 'icon-focus-indicator',
			tone: 'muted',
			i18nKey: 'recall_memory',
			sortOrder: 500,
		},
		{
			id: 'themeSet',
			ewaToolNames: ['theme_set'],
			builtinKey: 'themeSet',
			category: 'theme',
			access: ['quick_chip', 'chat', 'workflow'],
			icon: 'icon-high-contrast',
			tone: 'aura',
			i18nKey: 'themeSet',
			sortOrder: 600,
			desktopOnly: true,
		},
	];

export function companionBuiltinChipId(key: BuiltinQuickPresetKey): string {
	return `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}${key}`;
}

function chipIdFromCompanionEwaToolSpec(spec: CompanionEwaToolSpec): string {
	if (spec.builtinKey) {
		return companionBuiltinChipId(spec.builtinKey);
	}
	return `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}ewa.${spec.id}`;
}

/** Orchestrator branch aliases → canonical registry tool name. */
const COMPANION_SERVER_TOOL_BRANCH_ALIASES: Readonly<Record<string, string>> = {
	doc_create: 'file_create',
	doc_insert_file_into_editor: 'doc_insert',
};

const _ewaToolNameToChipId = (() => {
	const map = new Map<string, string>();
	const sorted = [...COMPANION_BUILTIN_EWA_TOOL_SPECS].sort(
		(a, b) => a.sortOrder - b.sortOrder
	);
	for (const spec of sorted) {
		for (const name of spec.ewaToolNames) {
			const key = name.trim().toLowerCase();
			if (!key || map.has(key)) continue;
			map.set(key, chipIdFromCompanionEwaToolSpec(spec));
		}
	}
	return map;
})();

/** Map server tool/branch name from ``companion_recent_server_actions`` to catalog chip id. */
export function companionChipIdForEwaToolName(
	toolOrBranch: string
): string | null {
	const raw = toolOrBranch.trim().toLowerCase();
	if (!raw) return null;
	const resolved = COMPANION_SERVER_TOOL_BRANCH_ALIASES[raw] ?? raw;
	return _ewaToolNameToChipId.get(resolved) ?? null;
}

export function companionEwaToolSpecById(
	id: string
): CompanionEwaToolSpec | undefined {
	return COMPANION_BUILTIN_EWA_TOOL_SPECS.find((row) => row.id === id);
}
