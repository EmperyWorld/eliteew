/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side tool/quick-action chips for the EWA companion composer: built-in i18n launchers plus user-saved presets
 * from companion profile API.
 *
 * Invariants:
 * - Built-in ids use ``EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX``; never sent to quick-actions CRUD.
 * - Dedupe by normalized prompt text; server presets win label order over builtins when prompts match.
 * - ``isCompanionQuickPresetDeletable`` — only rows with ``builtin: false`` (user quick-actions API).
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 * - api/ewa_platform/companion/ux/quick_intents.py
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import {
	EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX,
	type EwaCompanionQuickPreset,
} from '@/services/ewa/ewaCompanionProfileApi';
import type { EwaCompanionPlanTask } from '@/services/ewa/ewaCompanionPlansApi';
import type { TFunction } from 'i18next';

export type CompanionQuickPresetChip = {
	id: string;
	label: string;
	promptText: string;
	builtin: boolean;
	sortOrder: number;
};

const BUILTIN_QUICK_PRESET_KEYS = [
	'documentList',
	'documentOpen',
	'documentCreate',
	'documentRewrite',
	'catalogDiscuss',
	'fileRename',
	'fileDelete',
	'imageGenerate',
	'imageEdit',
	'imageAnalyze',
	'presentationCreate',
	'presentationOnTopic',
	'socialPostCompose',
	'musicGenerate',
	'musicOnTopic',
	'musicAutonomous',
	'xlBaseInteractive',
	'musicStudioOpen',
	'operationsStatus',
	'operationsCancel',
	'planWeek',
	'themeSet',
] as const;

export type BuiltinQuickPresetKey = (typeof BUILTIN_QUICK_PRESET_KEYS)[number];

function normalizePromptKey(text: string): string {
	return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function readServerQuickPresetLabel(row: EwaCompanionQuickPreset): string {
	const raw = row.label ?? (row as { label?: string }).label ?? '';
	return String(raw).trim();
}

function readServerQuickPresetPrompt(row: EwaCompanionQuickPreset): string {
	const raw =
		row.prompt_text ?? (row as { promptText?: string }).promptText ?? '';
	return String(raw).trim();
}

/** Built-in chips from ``ewaCompanion.quickPresetDefaults.*`` (no network). */
export function buildBuiltinCompanionQuickPresets(
	t: TFunction<'marketing', undefined>
): CompanionQuickPresetChip[] {
	return BUILTIN_QUICK_PRESET_KEYS.map((key, index) => ({
		id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}${key}`,
		label: t(`ewaCompanion.quickPresetDefaults.${key}.label`),
		promptText: t(`ewaCompanion.quickPresetDefaults.${key}.prompt`),
		builtin: true,
		sortOrder: index,
	})).filter((row) => row.label.trim() && row.promptText.trim());
}

/** Merge server presets with builtins; server rows first (all DB rows, by id). */
export function mergeCompanionQuickPresets(
	serverPresets: EwaCompanionQuickPreset[],
	builtins: CompanionQuickPresetChip[]
): CompanionQuickPresetChip[] {
	const serverPromptKeys = new Set<string>();
	const merged: CompanionQuickPresetChip[] = [];

	for (const row of [...serverPresets].sort(
		(a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
	)) {
		const promptText = readServerQuickPresetPrompt(row);
		const label = readServerQuickPresetLabel(row);
		if (!promptText || !label || !row.id) continue;
		serverPromptKeys.add(normalizePromptKey(promptText));
		merged.push({
			id: row.id,
			label,
			promptText,
			builtin: false,
			sortOrder: row.sort_order ?? merged.length,
		});
	}

	for (const row of builtins) {
		const key = normalizePromptKey(row.promptText);
		if (serverPromptKeys.has(key)) continue;
		merged.push(row);
	}

	return merged;
}

/** Saved quick-actions only (for a dedicated UI strip). */
export function partitionCompanionQuickPresets(
	presets: CompanionQuickPresetChip[]
): {
	user: CompanionQuickPresetChip[];
	builtin: CompanionQuickPresetChip[];
} {
	const user: CompanionQuickPresetChip[] = [];
	const builtin: CompanionQuickPresetChip[] = [];
	for (const row of presets) {
		if (isCompanionQuickPresetDeletable(row)) user.push(row);
		else builtin.push(row);
	}
	return { user, builtin };
}

const PLAN_COMPLETE_CHIP_MAX = 2;
const PLAN_COMPLETE_TITLE_CHIP_MAX = 32;

function truncatePlanTaskTitleForChip(title: string): string {
	const trimmed = title.trim();
	if (trimmed.length <= PLAN_COMPLETE_TITLE_CHIP_MAX) return trimmed;
	return `${trimmed.slice(0, PLAN_COMPLETE_TITLE_CHIP_MAX - 1)}…`;
}

/** Dynamic chips for the first open plan tasks (shown when an active plan exists). */
export function buildPlanCompleteQuickPresets(
	t: TFunction<'marketing', undefined>,
	openTasks: EwaCompanionPlanTask[],
	max = PLAN_COMPLETE_CHIP_MAX
): CompanionQuickPresetChip[] {
	return openTasks.slice(0, max).flatMap((task, index) => {
		const title = (task.title ?? '').trim();
		const taskId = (task.id ?? '').trim();
		if (!title || !taskId) return [];
		const shortTitle = truncatePlanTaskTitleForChip(title);
		return [
			{
				id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}planComplete:${taskId}`,
				label: t('ewaCompanion.planQuickCompleteLabel', { title: shortTitle }),
				promptText: t('ewaCompanion.planQuickCompletePrompt', { title }),
				builtin: true,
				sortOrder: -20 - index,
			},
		];
	});
}

/** Plan-complete chips first; skip base rows with duplicate prompt text. */
export function prependPlanCompleteQuickPresets(
	base: CompanionQuickPresetChip[],
	planComplete: CompanionQuickPresetChip[]
): CompanionQuickPresetChip[] {
	if (!planComplete.length) return base;
	const seen = new Set(
		planComplete.map((row) => normalizePromptKey(row.promptText))
	);
	const rest = base.filter(
		(row) => !seen.has(normalizePromptKey(row.promptText))
	);
	return [...planComplete, ...rest];
}

/** User-saved presets from quick-actions API; built-ins and plan-complete chips are not deletable. */
export function isCompanionQuickPresetDeletable(
	preset: CompanionQuickPresetChip
): boolean {
	return !preset.builtin;
}

/** User-saved presets can be renamed via PATCH quick-actions. */
export function isCompanionQuickPresetRenamable(
	preset: CompanionQuickPresetChip
): boolean {
	return isCompanionQuickPresetDeletable(preset);
}
