/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UI helpers and starter templates for companion user workflows.
 *
 * Invariants:
 * - Helpers are pure; server/merged catalog remains the allowlist for executable tools.
 * - Palette categories prefer ``companionEwaToolsRegistry`` when the tool is workflow-access.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 * - companionEwaToolsRegistry.ts
 * - companionUserWorkflowsApi.ts
 */

import { COMPANION_BUILTIN_EWA_TOOL_SPECS } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import type { CompanionToolCategoryId } from '@/features/ewa/companionTools/companionToolsCatalogUi';
import type {
	CompanionUserWorkflow,
	CompanionUserWorkflowStep,
	CompanionUserWorkflowToolCatalogEntry,
} from '@/services/ewa/companionUserWorkflowsApi';

export type CompanionUserWorkflowTemplate = {
	id: string;
	title_ru: string;
	title_en: string;
	name_ru: string;
	name_en: string;
	trigger_ru: string;
	trigger_en: string;
	/** Authoring-time partial steps; normalize before HTTP. */
	steps: CompanionUserWorkflowStepDraft[];
};

/** FE-only draft for workflow templates (not HTTP SoT). */
export type CompanionUserWorkflowStepDraft = {
	step_kind?: CompanionUserWorkflowStep['step_kind'];
	tool_name?: string;
	title_ru?: string;
	title_en?: string;
	args_template?: Record<string, unknown>;
};

export function normalizeCompanionUserWorkflowStep(
	step: CompanionUserWorkflowStep | CompanionUserWorkflowStepDraft
): CompanionUserWorkflowStep {
	if (step.step_kind === COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND) {
		return {
			step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND,
			tool_name: String(step.tool_name ?? '').trim(),
			title_ru: step.title_ru ?? '',
			title_en: step.title_en ?? '',
		};
	}
	return {
		step_kind: 'tool',
		tool_name: String(step.tool_name || '').trim(),
		args_template: step.args_template ?? {},
		title_ru: step.title_ru ?? '',
		title_en: step.title_en ?? '',
	};
}

export type CompanionWorkflowToolCategoryId =
	| 'all'
	| 'music'
	| 'images'
	| 'files'
	| 'content'
	| 'desk'
	| 'windows'
	| 'theme'
	| 'catalog';

export type CompanionWorkflowToolCategory = {
	id: CompanionWorkflowToolCategoryId;
	titleKey: string;
};

export type CompanionWorkflowPreviewStep = {
	index: number;
	toolName: string;
	title: string;
	category: CompanionWorkflowToolCategoryId;
	argsSummary: string;
	asyncStep: boolean;
	requiresConfirm: boolean;
};

export const COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND =
	'confirm_gate' as const;

export function isCompanionUserWorkflowConfirmGateStep(
	step: Pick<CompanionUserWorkflowStep, 'step_kind' | 'tool_name'>
): boolean {
	return step.step_kind === COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND;
}

export function serializeCompanionUserWorkflowSteps(
	steps: Array<CompanionUserWorkflowStep | CompanionUserWorkflowStepDraft>
): CompanionUserWorkflowStep[] {
	return steps.map((step) => normalizeCompanionUserWorkflowStep(step));
}

export const COMPANION_WORKFLOW_TOOL_CATEGORIES: CompanionWorkflowToolCategory[] =
	[
		{ id: 'all', titleKey: 'ewaCompanion.userWorkflowToolCategoryAll' },
		{ id: 'music', titleKey: 'ewaCompanion.userWorkflowToolCategoryMusic' },
		{ id: 'images', titleKey: 'ewaCompanion.userWorkflowToolCategoryImages' },
		{ id: 'files', titleKey: 'ewaCompanion.userWorkflowToolCategoryFiles' },
		{ id: 'content', titleKey: 'ewaCompanion.userWorkflowToolCategoryContent' },
		{ id: 'desk', titleKey: 'ewaCompanion.userWorkflowToolCategoryDesk' },
		{ id: 'windows', titleKey: 'ewaCompanion.userWorkflowToolCategoryWindows' },
		{ id: 'theme', titleKey: 'ewaCompanion.userWorkflowToolCategoryTheme' },
		{ id: 'catalog', titleKey: 'ewaCompanion.userWorkflowToolCategoryCatalog' },
	];

export const COMPANION_USER_WORKFLOW_TEMPLATES: CompanionUserWorkflowTemplate[] =
	[
		{
			id: 'marketing_launch_kit',
			title_ru: 'Маркетинг: запуск',
			title_en: 'Marketing: launch kit',
			name_ru: 'Пакет запуска продукта',
			name_en: 'Product launch pack',
			trigger_ru: 'пакет запуска',
			trigger_en: 'launch pack',
			steps: [
				{
					tool_name: 'plan_v1',
					args_template: {
						plan_focus: 'запуск продукта: цели, каналы, сроки',
						horizon: '2 недели',
					},
				},
				{
					tool_name: 'presentation_generation',
					args_template: {
						topic: 'запуск продукта для клиентов',
						num_slides: '8',
						presentation_theme: 'aurora',
					},
				},
				{
					tool_name: 'image_generation',
					args_template: {
						prompt: 'обложка анонса продукта, чистый премиальный стиль',
						aspect_ratio: '16:9',
					},
				},
				{
					tool_name: 'social_post_compose',
					args_template: {
						brief: 'анонс запуска по плану и презентации',
						channel: 'telegram',
					},
				},
			],
		},
		{
			id: 'marketing_post_from_doc',
			title_ru: 'Маркетинг: пост из файла',
			title_en: 'Marketing: post from file',
			name_ru: 'Пост и лонгрид из документа',
			name_en: 'Post and longread from document',
			trigger_ru: 'пост из документа',
			trigger_en: 'post from document',
			steps: [
				{
					tool_name: 'catalog_discuss',
					args_template: { file_query: 'brief.md' },
				},
				{
					tool_name: 'llm_summarize',
					args_template: {
						text: '{{steps.0.output.reply}}',
						instruction: 'ключевые тезисы для соцсетей, 5 буллетов',
					},
				},
				{
					tool_name: 'social_post_compose',
					args_template: {
						brief: '{{steps.1.output.reply}}',
						channel: 'telegram',
					},
				},
				{
					tool_name: 'social_post_compose',
					args_template: {
						brief: '{{steps.1.output.reply}}',
						channel: 'blog',
					},
				},
			],
		},
		{
			id: 'marketing_telegram_send',
			title_ru: 'Маркетинг: в Telegram',
			title_en: 'Marketing: to Telegram',
			name_ru: 'Черновик поста → Telegram',
			name_en: 'Draft post → Telegram',
			trigger_ru: 'отправь пост в телеграм',
			trigger_en: 'send post to telegram',
			steps: [
				{
					tool_name: 'social_post_compose',
					args_template: {
						brief: 'короткий анонс для канала',
						channel: 'telegram',
					},
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'telegram_sender',
					args_template: {
						message_text: '{{steps.0.output.reply}}',
					},
				},
			],
		},
		{
			id: 'docs_weekly_brief',
			title_ru: 'Документы: бриф',
			title_en: 'Documents: brief',
			name_ru: 'Недельный бриф в файл',
			name_en: 'Weekly brief to file',
			trigger_ru: 'недельный бриф',
			trigger_en: 'weekly brief',
			steps: [
				{
					tool_name: 'plan_v1',
					args_template: {
						plan_focus: 'приоритеты недели и риски',
						horizon: 'неделю',
					},
				},
				{
					tool_name: 'file_create',
					args_template: {
						name: 'weekly-brief.md',
						body: '# Недельный бриф\n\n',
					},
				},
				{
					tool_name: 'app_open',
					args_template: { app_component: 'DocEditor' },
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_save_text',
					args_template: {
						name: 'weekly-brief.md',
						body: '{{steps.0.output.reply}}',
					},
				},
			],
		},
		{
			id: 'docs_rewrite_polish',
			title_ru: 'Документы: правка',
			title_en: 'Documents: rewrite',
			name_ru: 'Переписать документ',
			name_en: 'Rewrite document',
			trigger_ru: 'перепиши документ',
			trigger_en: 'rewrite document',
			steps: [
				{
					tool_name: 'catalog_discuss',
					args_template: { file_query: 'draft.md' },
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_rewrite',
					args_template: {
						file_query: 'draft.md',
						rewrite_brief: 'сделай яснее и короче, сохрани смысл, деловой тон',
						open_editor: '1',
					},
				},
			],
		},
		{
			id: 'files_catalog_digest',
			title_ru: 'Файлы: обзор',
			title_en: 'Files: digest',
			name_ru: 'Обзор каталога → заметка',
			name_en: 'Catalog digest → note',
			trigger_ru: 'обзор моих файлов',
			trigger_en: 'digest my files',
			steps: [
				{ tool_name: 'catalog_list', args_template: { mode: 'list' } },
				{
					tool_name: 'catalog_discuss',
					args_template: { file_query: '' },
				},
				{
					tool_name: 'llm_summarize',
					args_template: {
						text: '{{steps.1.output.reply}}',
						instruction: 'краткая выжимка и что сделать дальше',
					},
				},
				{
					tool_name: 'app_open',
					args_template: { app_component: 'ContentManagerPro' },
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_save_text',
					args_template: {
						name: 'catalog-digest.md',
						body: '{{steps.2.output.reply}}',
					},
				},
			],
		},
		{
			id: 'files_pdf_to_notes',
			title_ru: 'Файлы: PDF → заметки',
			title_en: 'Files: PDF → notes',
			name_ru: 'PDF в краткие заметки',
			name_en: 'PDF into short notes',
			trigger_ru: 'разбери pdf',
			trigger_en: 'parse pdf',
			steps: [
				{
					tool_name: 'pdf_parser',
					args_template: { filename: 'report.pdf' },
				},
				{
					tool_name: 'llm_summarize',
					args_template: {
						text: '{{steps.0.output.text}}',
						instruction: 'структурированные заметки: факты, выводы, вопросы',
					},
				},
				{
					tool_name: 'app_open',
					args_template: { app_component: 'DocEditor' },
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_save_text',
					args_template: {
						name: 'pdf-notes.md',
						body: '{{steps.1.output.reply}}',
					},
				},
			],
		},
		{
			id: 'files_paperless_inbox',
			title_ru: 'Файлы: Paperless',
			title_en: 'Files: Paperless',
			name_ru: 'Paperless → выжимка',
			name_en: 'Paperless → digest',
			trigger_ru: 'разбери paperless',
			trigger_en: 'digest paperless',
			steps: [
				{
					tool_name: 'paperless_import',
					args_template: { paperless_id: '' },
				},
				{
					tool_name: 'document_extractor',
					args_template: {
						unified_content_id: '{{steps.0.output.unified_content_id}}',
					},
				},
				{
					tool_name: 'llm_summarize',
					args_template: {
						text: '{{steps.1.output.text}}',
						instruction: 'кратко: тип документа, даты, действия',
					},
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_save_text',
					args_template: {
						name: 'paperless-digest.md',
						body: '{{steps.2.output.reply}}',
					},
				},
			],
		},
		{
			id: 'myth_world_chain',
			title_ru: 'Миф: мир и сцена',
			title_en: 'Myth: world and scene',
			name_ru: 'Мифологическая цепочка',
			name_en: 'Myth worldbuilding chain',
			trigger_ru: 'миф цепочка',
			trigger_en: 'myth chain',
			steps: [
				{ tool_name: 'recall_memory', args_template: {} },
				{
					tool_name: 'image_generation',
					args_template: {
						prompt:
							'эпическая сцена мира: атмосфера мифа, кинематографичный свет',
						aspect_ratio: '16:9',
					},
				},
				{
					tool_name: 'music_generation_xl_base',
					args_template: { mood: 'epic mythic', style: 'cinematic' },
				},
				{
					tool_name: 'file_create',
					args_template: {
						name: 'myth-scene.md',
						body: '# Сцена мифа\n\n',
					},
				},
				{
					tool_name: 'social_post_compose',
					args_template: {
						brief: 'короткий лор-анонс сцены для аудитории',
						channel: 'blog',
					},
				},
			],
		},
		{
			id: 'creative_studio_session',
			title_ru: 'Студия: сессия',
			title_en: 'Studio: session',
			name_ru: 'Творческая сессия',
			name_en: 'Creative session',
			trigger_ru: 'творческая сессия',
			trigger_en: 'creative session',
			steps: [
				{ tool_name: 'theme_set', args_template: { theme: 'dark' } },
				{ tool_name: 'music_studio_open', args_template: {} },
				{
					tool_name: 'image_generation',
					args_template: {
						prompt: 'moodboard для трека, атмосферный арт',
						aspect_ratio: '1:1',
					},
				},
				{
					tool_name: 'music_generation_xl_base',
					args_template: { mood: 'inspired', vocal: 'instrumental' },
				},
			],
		},
		{
			id: 'vision_to_notes',
			title_ru: 'Зрение: в заметки',
			title_en: 'Vision: to notes',
			name_ru: 'Скриншот → заметки',
			name_en: 'Screenshot → notes',
			trigger_ru: 'разбери скриншот',
			trigger_en: 'analyze screenshot',
			steps: [
				{
					tool_name: 'vision_analyze',
					args_template: {
						prompt: 'опиши содержимое и выпиши ключевые факты списком',
					},
				},
				{
					tool_name: 'llm_classify',
					args_template: {
						text: '{{steps.0.output.reply}}',
						categories: 'задача, справка, баг, идея',
					},
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'file_save_text',
					args_template: {
						name: 'vision-notes.md',
						body: '{{steps.0.output.reply}}',
					},
				},
			],
		},
		{
			id: 'email_team_digest',
			title_ru: 'Почта: дайджест',
			title_en: 'Email: digest',
			name_ru: 'Дайджест команде на почту',
			name_en: 'Team digest by email',
			trigger_ru: 'дайджест на почту',
			trigger_en: 'email digest',
			steps: [
				{
					tool_name: 'catalog_discuss',
					args_template: { file_query: 'status.md' },
				},
				{
					tool_name: 'llm_summarize',
					args_template: {
						text: '{{steps.0.output.reply}}',
						instruction: 'письмо команде: итоги, блокеры, next steps',
					},
				},
				{ step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND },
				{
					tool_name: 'email_dispatcher',
					args_template: {
						to: '',
						subject: 'Дайджест статуса',
						body: '{{steps.1.output.reply}}',
					},
				},
			],
		},
	];

type DefinitionStep = {
	kind?: string;
	tool_name?: string;
	step_kind?: string;
	args_template?: Record<string, unknown>;
	title_ru?: string;
	title_en?: string;
};

export function stepsFromWorkflowDefinition(
	definition: Record<string, unknown> | null | undefined
): CompanionUserWorkflowStep[] {
	const raw = definition?.steps;
	if (!Array.isArray(raw)) return [];
	const out: CompanionUserWorkflowStep[] = [];
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const step = row as DefinitionStep;
		const kind = String(step.kind || step.step_kind || 'tool').trim();
		if (kind === COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND) {
			out.push(
				normalizeCompanionUserWorkflowStep({
					step_kind: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND,
				})
			);
			continue;
		}
		const toolName = String(step.tool_name || '').trim();
		if (!toolName) continue;
		const args = step.args_template;
		const cleanedArgs: Record<string, unknown> = {};
		if (args && typeof args === 'object' && !Array.isArray(args)) {
			for (const [key, value] of Object.entries(args)) {
				if (key === 'user_line') continue;
				if (value === null || value === undefined) continue;
				if (typeof value === 'string' && !value.trim()) continue;
				cleanedArgs[key] = value;
			}
		}
		out.push(
			normalizeCompanionUserWorkflowStep({
				tool_name: toolName,
				args_template: cleanedArgs,
				title_ru: step.title_ru,
				title_en: step.title_en,
			})
		);
	}
	return out;
}

export function triggerPatternsFromWorkflow(
	workflow: CompanionUserWorkflow
): string[] {
	const patterns = workflow.trigger_json?.patterns;
	if (!Array.isArray(patterns)) return [''];
	const cleaned = patterns
		.map((row) => String(row || '').trim())
		.filter(Boolean);
	return cleaned.length > 0 ? cleaned : [''];
}

export function toolTitleFromCatalog(
	toolName: string,
	catalog: CompanionUserWorkflowToolCatalogEntry[],
	ru: boolean
): string {
	const entry = catalog.find((row) => row.name === toolName);
	if (entry) return ru ? entry.title_ru : entry.title_en;
	return toolName;
}

function registryCategoryToWorkflowCategory(
	category: CompanionToolCategoryId,
	toolName: string
): CompanionWorkflowToolCategoryId {
	const key = toolName.trim().toLowerCase();
	if (key.startsWith('catalog_')) return 'catalog';
	if (key === 'app_open' || key.includes('window')) return 'windows';
	switch (category) {
		case 'files':
			return 'files';
		case 'music':
			return 'music';
		case 'images':
			return 'images';
		case 'desk':
			return 'desk';
		case 'theme':
			return 'theme';
		case 'plan':
		case 'memory':
			return 'content';
		default:
			return 'content';
	}
}

/** Workflow-access tool → builder palette category (registry first). */
const WORKFLOW_TOOL_CATEGORY_BY_NAME: ReadonlyMap<
	string,
	CompanionWorkflowToolCategoryId
> = (() => {
	const map = new Map<string, CompanionWorkflowToolCategoryId>();
	for (const spec of COMPANION_BUILTIN_EWA_TOOL_SPECS) {
		if (!spec.access.includes('workflow')) continue;
		for (const name of spec.ewaToolNames) {
			const trimmed = String(name || '').trim();
			if (!trimmed || map.has(trimmed)) continue;
			map.set(
				trimmed,
				registryCategoryToWorkflowCategory(spec.category, trimmed)
			);
		}
	}
	return map;
})();

export function workflowToolCategory(
	toolName: string
): CompanionWorkflowToolCategoryId {
	const key = toolName.trim();
	const fromRegistry = WORKFLOW_TOOL_CATEGORY_BY_NAME.get(key);
	if (fromRegistry) return fromRegistry;

	const lower = key.toLowerCase();
	if (lower.includes('music')) return 'music';
	if (
		lower.includes('image') ||
		lower.includes('presentation') ||
		lower.includes('vision')
	)
		return 'images';
	if (
		lower.includes('social_post') ||
		lower.includes('recall_memory') ||
		lower.includes('longread') ||
		lower.startsWith('llm_') ||
		lower.includes('telegram') ||
		lower.includes('email')
	)
		return 'content';
	if (lower.includes('plan')) return 'content';
	if (lower.includes('operations')) return 'desk';
	if (
		lower.includes('file') ||
		lower.includes('doc') ||
		lower.includes('pdf') ||
		lower.includes('paperless') ||
		lower.includes('document_extractor')
	)
		return 'files';
	if (lower.includes('app') || lower.includes('window')) return 'windows';
	if (lower.includes('theme')) return 'theme';
	if (lower.includes('catalog')) return 'catalog';
	return 'content';
}

/** Names from the live/merged workflow tool catalog (save allowlist source). */
export function workflowCatalogAllowedToolNames(
	catalog: readonly CompanionUserWorkflowToolCatalogEntry[]
): string[] {
	return catalog
		.map((entry) => String(entry.name || '').trim())
		.filter(Boolean);
}

/** Catalog field keys that open Unified Content picker in the workflow builder. */
export const WORKFLOW_BUILDER_FILE_FIELD_KEYS: ReadonlySet<string> = new Set([
	'file_query',
	'source_file_query',
	'delete_file_query',
	'rename_old_query',
]);

/** Catalog fields that store unified content UUID from picker. */
export const WORKFLOW_BUILDER_CONTENT_ID_FIELD_KEYS: ReadonlySet<string> =
	new Set(['source_unified_content_id']);

/** Text fields where prior-step output placeholders are offered. */
export const WORKFLOW_BUILDER_STEP_LINK_FIELD_KEYS: ReadonlySet<string> =
	new Set([
		'brief',
		'rewrite_brief',
		'plan_focus',
		'body',
		'prompt',
		'topic',
		'task_hint',
		'run_id',
		'extra_context',
		'source_unified_content_id',
	]);

export function workflowStepOutputPlaceholder(
	stepIndexZeroBased: number,
	field = 'reply'
): string {
	return `{{steps.${stepIndexZeroBased}.output.${field}}}`;
}

export function workflowPriorStepIndexes(currentStepIndex: number): number[] {
	const out: number[] = [];
	for (let index = 0; index < currentStepIndex; index += 1) {
		out.push(index);
	}
	return out;
}

export function workflowToolArgsSummary(
	args: Record<string, unknown> | null | undefined
): string {
	if (!args || typeof args !== 'object') return '—';
	const pairs = Object.entries(args)
		.filter(([, value]) => {
			if (value === null || value === undefined) return false;
			if (typeof value === 'string') return value.trim().length > 0;
			return true;
		})
		.slice(0, 3)
		.map(([key, value]) => {
			const rendered =
				typeof value === 'string'
					? value.trim()
					: typeof value === 'number' || typeof value === 'boolean'
						? String(value)
						: Array.isArray(value)
							? `[${value.length}]`
							: '{…}';
			return `${key}: ${rendered}`;
		});
	return pairs.length > 0 ? pairs.join(' · ') : '—';
}

export function buildWorkflowPreviewSteps(
	steps: CompanionUserWorkflowStep[],
	catalog: CompanionUserWorkflowToolCatalogEntry[],
	ru: boolean
): CompanionWorkflowPreviewStep[] {
	return steps.map((step, idx) => {
		if (isCompanionUserWorkflowConfirmGateStep(step)) {
			return {
				index: idx + 1,
				toolName: COMPANION_USER_WORKFLOW_CONFIRM_GATE_STEP_KIND,
				title: ru ? 'Подтверждение' : 'Confirmation',
				category: 'desk',
				argsSummary: '—',
				asyncStep: false,
				requiresConfirm: true,
			};
		}
		const toolName = String(step.tool_name || '').trim();
		const meta = catalog.find((entry) => entry.name === toolName);
		return {
			index: idx + 1,
			toolName,
			title: meta ? (ru ? meta.title_ru : meta.title_en) : toolName,
			category: workflowToolCategory(toolName),
			argsSummary: workflowToolArgsSummary(step.args_template),
			asyncStep: Boolean(meta?.async_step),
			requiresConfirm: Boolean(meta?.requires_confirm),
		};
	});
}

export function workflowWarningStepIndex(code: string): number | null {
	const match = /^step_(\d+)_/.exec(code.trim());
	if (!match) return null;
	const value = Number.parseInt(match[1] ?? '', 10);
	return Number.isFinite(value) && value > 0 ? value : null;
}

export function groupWorkflowWarningsByStep(
	warnings: string[]
): Map<number | null, string[]> {
	const grouped = new Map<number | null, string[]>();
	for (const warning of warnings) {
		const key = workflowWarningStepIndex(warning);
		grouped.set(key, [...(grouped.get(key) ?? []), warning]);
	}
	return grouped;
}

export function summarizeWorkflowSteps(
	workflow: CompanionUserWorkflow,
	catalog: CompanionUserWorkflowToolCatalogEntry[],
	ru: boolean
): string {
	const steps = stepsFromWorkflowDefinition(workflow.definition_json);
	if (steps.length === 0) return '—';
	return steps
		.map((step) =>
			isCompanionUserWorkflowConfirmGateStep(step)
				? ru
					? 'Подтверждение'
					: 'Confirmation'
				: toolTitleFromCatalog(String(step.tool_name || ''), catalog, ru)
		)
		.join(' → ');
}

export function mergeCompanionUserWorkflowRows(
	serverRows: CompanionUserWorkflow[],
	optimisticRow: CompanionUserWorkflow | null | undefined
): CompanionUserWorkflow[] {
	if (!optimisticRow?.id) return serverRows;
	if (serverRows.some((row) => row.id === optimisticRow.id)) return serverRows;
	return [optimisticRow, ...serverRows];
}

export function duplicateWorkflowName(name: string, ru: boolean): string {
	const trimmed = name.trim() || (ru ? 'Цепочка' : 'Chain');
	const suffix = ru ? ' (копия)' : ' (copy)';
	const maxLen = 120 - suffix.length;
	return `${trimmed.slice(0, maxLen)}${suffix}`;
}

/** True when definition is companion workflow DAG schema v2. */
export function isCompanionUserWorkflowDagV2(
	workflow:
		| CompanionUserWorkflow
		| { definition_json?: unknown }
		| null
		| undefined
): boolean {
	const def = workflow?.definition_json;
	if (!def || typeof def !== 'object' || Array.isArray(def)) return false;
	return Number((def as { schema_version?: unknown }).schema_version) === 2;
}

/** Node count for list summary: DAG uses `nodes[]`, linear uses `steps[]`. */
export function workflowGraphUnitCount(
	definition: Record<string, unknown> | null | undefined
): number {
	if (!definition) return 0;
	if (Number(definition.schema_version) === 2) {
		const nodes = definition.nodes;
		return Array.isArray(nodes) ? nodes.length : 0;
	}
	return stepsFromWorkflowDefinition(definition).length;
}
