/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared helpers for AMKA views (status badges, dates, snapshot summaries, timeline re-exports).
 *
 * Invariants:
 * - Timeline stage logic is owned by `amkaTimelineModel`; helpers stay free of React hooks.
 *
 * Related:
 * - src/features/amka/amkaTimelineModel.ts
 * - src/pages/MarketingCabinet/views/AmkaView.tsx (legacy path re-exports this module)
 */
/** Терминальные статусы прогона AMKA. */
export const AMKA_RUN_TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export type { AmkaTimelineStageId } from '@/features/amka/amkaTimelineModel';
export {
	computeAmkaTimelineState,
	timelineConnectorClass,
} from '@/features/amka/amkaTimelineModel';

export function readStringField(
	payload: Record<string, unknown> | null | undefined,
	key: string
): string | null {
	const value = payload?.[key];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readNumberField(
	payload: Record<string, unknown> | null | undefined,
	key: string
): number | null {
	const value = payload?.[key];
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function readBooleanField(
	payload: Record<string, unknown> | null | undefined,
	key: string
): boolean | null {
	const value = payload?.[key];
	return typeof value === 'boolean' ? value : null;
}

export function readErrorSummary(
	payload: Record<string, unknown> | null | undefined
): { message: string | null; stage: string | null } | null {
	const message = readStringField(payload, 'message');
	const stage = readStringField(payload, 'stage');
	if (!message && !stage) {
		return null;
	}
	return { message, stage };
}

export function readObjectArray(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is Record<string, unknown> =>
			Boolean(item) && typeof item === 'object' && !Array.isArray(item)
	);
}

export function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is string => typeof item === 'string' && item.trim().length > 0
	);
}

export type AmkaStepEnsembleMeta = {
	isEnsembleStep: boolean;
	execMode: string | null;
	heroIds: string[];
	template: string | null;
	fallback: boolean;
	error: string | null;
	elapsedMs: number | null;
};

export function resolveAmkaStepExecutionMode(step: {
	plan_payload?: Record<string, unknown> | null;
	report_payload?: Record<string, unknown> | null;
}): string | null {
	const plan = step.plan_payload ?? null;
	const report = step.report_payload ?? null;
	return (
		readStringField(plan, 'execution_mode') ||
		readStringField(report, 'execution_mode')
	);
}

/** Reads ensemble execute evidence from report_payload and nested ensemble_subset. */
export function resolveAmkaStepEnsembleMeta(step: {
	status?: string;
	plan_payload?: Record<string, unknown> | null;
	report_payload?: Record<string, unknown> | null;
	error_payload?: Record<string, unknown> | null;
}): AmkaStepEnsembleMeta {
	const plan = step.plan_payload ?? null;
	const report = step.report_payload ?? null;
	const ensembleSubset =
		report?.ensemble_subset && typeof report.ensemble_subset === 'object'
			? (report.ensemble_subset as Record<string, unknown>)
			: null;
	const payload = ensembleSubset ?? report;

	const execMode = resolveAmkaStepExecutionMode(step);
	const isEnsembleStep =
		execMode === 'desktop_ensemble' ||
		readStringField(report, 'mode') === 'desktop_ensemble' ||
		readStringField(payload, 'mode') === 'desktop_ensemble';

	const heroesFrom = (src: Record<string, unknown> | null | undefined) =>
		readStringArray(src?.heroes);
	const heroIds =
		heroesFrom(payload).length > 0
			? heroesFrom(payload)
			: heroesFrom(report).length > 0
				? heroesFrom(report)
				: readStringArray(plan?.ensemble_hero_ids);

	const template =
		readStringField(payload, 'plan_template_id') ||
		readStringField(payload, 'template_hint') ||
		readStringField(report, 'plan_template_id') ||
		readStringField(report, 'template_hint') ||
		readStringField(plan, 'ensemble_template_hint');

	const ensembleError =
		readStringField(report, 'ensemble_error') ||
		readStringField(payload, 'ensemble_error') ||
		readStringField(report, 'error') ||
		readStringField(payload, 'error') ||
		(step.status === 'failed'
			? readStringField(step.error_payload, 'message')
			: null);

	return {
		isEnsembleStep,
		execMode,
		heroIds,
		template,
		fallback: readBooleanField(report, 'ensemble_fallback') === true,
		error: ensembleError,
		elapsedMs:
			readNumberField(payload, 'elapsed_ms') ??
			readNumberField(report, 'elapsed_ms'),
	};
}

const AMKA_EXPORT_LINE_MAX = 400;

export function truncateAmkaExportLine(
	value: string,
	maxLength = AMKA_EXPORT_LINE_MAX
): string {
	const trimmed = value.trim();
	if (trimmed.length <= maxLength) {
		return trimmed;
	}
	return `${trimmed.slice(0, maxLength)}…`;
}

/** Markdown bullet lines for step execute/ensemble metadata (client + server export parity). */
export function buildAmkaStepExportMetaLines(step: {
	status: string;
	plan_payload?: Record<string, unknown> | null;
	report_payload?: Record<string, unknown> | null;
	error_payload?: Record<string, unknown> | null;
	metrics_after?: Record<string, unknown> | null;
}): string[] {
	const lines: string[] = [];
	const execMode = resolveAmkaStepExecutionMode(step);
	if (execMode) {
		lines.push(`- Режим выполнения: \`${execMode}\``);
	}
	const ensemble = resolveAmkaStepEnsembleMeta(step);
	if (ensemble.isEnsembleStep) {
		if (ensemble.template) {
			lines.push(`- Blueprint: \`${ensemble.template}\``);
		}
		if (ensemble.heroIds.length > 0) {
			lines.push(`- Команда: ${ensemble.heroIds.join(', ')}`);
		}
		if (ensemble.elapsedMs !== null && ensemble.elapsedMs > 0) {
			lines.push(
				`- Длительность ensemble: ~${Math.round(ensemble.elapsedMs / 1000)} с`
			);
		}
		if (ensemble.fallback) {
			lines.push('- Fallback: marketing_tool_agent');
		}
		if (ensemble.error) {
			lines.push(
				`- Ошибка ensemble: ${truncateAmkaExportLine(ensemble.error)}`
			);
		}
	}
	const stepErr = readErrorSummary(step.error_payload);
	if (step.status === 'failed' && stepErr?.message) {
		const stepMsg = normalizeAmkaExportErrorLine(stepErr.message);
		const ensembleMsg = ensemble.error
			? normalizeAmkaExportErrorLine(ensemble.error)
			: null;
		if (!ensembleMsg || stepMsg !== ensembleMsg) {
			lines.push(`- Ошибка шага: ${stepMsg}`);
		}
	}
	if (readBooleanField(step.metrics_after, 'ensemble_completed') === true) {
		lines.push('- Ensemble: completed');
	}
	if (
		readBooleanField(step.metrics_after, 'ensemble_fallback_to_tool_agent') ===
		true
	) {
		lines.push('- Ensemble: fallback to tool-agent');
	}
	return lines;
}

export function formatAmkaEnsembleErrorForUi(
	t: (key: string, options?: { defaultValue?: string }) => string,
	raw: string | null | undefined
): string | null {
	if (!raw?.trim()) return null;
	const code = raw.trim();
	return t(`amkaView.ensembleErrorCodes.${code}`, { defaultValue: code });
}

export function findFirstFailedEnsembleStep(
	steps: Array<{
		status: string;
		title?: string;
		ordinal?: number;
		plan_payload?: Record<string, unknown> | null;
		report_payload?: Record<string, unknown> | null;
		error_payload?: Record<string, unknown> | null;
	}>
): { ordinal: number; title: string; meta: AmkaStepEnsembleMeta } | null {
	for (const step of steps) {
		if (step.status !== 'failed') continue;
		const meta = resolveAmkaStepEnsembleMeta(step);
		if (!meta.isEnsembleStep && meta.execMode !== 'desktop_ensemble') continue;
		return {
			ordinal: Number(step.ordinal ?? 0),
			title: String(step.title ?? '').trim() || '—',
			meta,
		};
	}
	return null;
}

export function findFirstFailedStepIndex(
	steps: Array<{ status: string }>
): number | null {
	const index = steps.findIndex((step) => step.status === 'failed');
	return index >= 0 ? index : null;
}

/**
 * Optional plan-task fields present at runtime but not yet on OpenAPI `AmkaPlanTaskOut`.
 * Prefer `'key' in task` + Reflect — do not invent BE schema fields on the FE type.
 */
export function readPlanTaskOptionalString(
	task: object,
	key: string
): string | null {
	if (!(key in task)) return null;
	const value = Reflect.get(task, key);
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readPlanTaskOptionalStringArray(
	task: object,
	key: string
): string[] {
	if (!(key in task)) return [];
	return readStringArray(Reflect.get(task, key));
}

export function countAmkaPlanEnsembleTasks(
	tasks: ReadonlyArray<object>
): number {
	return tasks.filter(
		(task) =>
			readPlanTaskOptionalString(task, 'execution_mode') === 'desktop_ensemble'
	).length;
}

export type AmkaEnsembleStepOutcomes = {
	planned: number;
	completed: number;
	fallback: number;
	failed: number;
	running: number;
	pending: number;
};

/** Aggregate persisted ensemble execute outcomes for run header / operator hints. */
export function summarizeAmkaEnsembleStepOutcomes(
	steps: Array<{
		status: string;
		plan_payload?: Record<string, unknown> | null;
		report_payload?: Record<string, unknown> | null;
		error_payload?: Record<string, unknown> | null;
		metrics_after?: Record<string, unknown> | null;
	}>,
	plannedCount = 0
): AmkaEnsembleStepOutcomes {
	const outcomes: AmkaEnsembleStepOutcomes = {
		planned: plannedCount,
		completed: 0,
		fallback: 0,
		failed: 0,
		running: 0,
		pending: 0,
	};
	for (const step of steps) {
		const meta = resolveAmkaStepEnsembleMeta(step);
		if (!meta.isEnsembleStep && meta.execMode !== 'desktop_ensemble') {
			continue;
		}
		if (step.status === 'failed') {
			outcomes.failed += 1;
			continue;
		}
		if (step.status === 'running') {
			outcomes.running += 1;
			continue;
		}
		if (step.status === 'completed') {
			if (
				meta.fallback ||
				readBooleanField(
					step.metrics_after,
					'ensemble_fallback_to_tool_agent'
				) === true
			) {
				outcomes.fallback += 1;
			} else {
				outcomes.completed += 1;
			}
			continue;
		}
		outcomes.pending += 1;
	}
	if (outcomes.planned <= 0) {
		outcomes.planned =
			outcomes.completed +
			outcomes.fallback +
			outcomes.failed +
			outcomes.running +
			outcomes.pending;
	}
	return outcomes;
}

/** Hide zero-state ensemble summary before execute starts or when plan has no team steps. */
export function shouldShowAmkaEnsembleOutcomeSummary(
	outcomes: AmkaEnsembleStepOutcomes,
	runStatus?: string | null
): boolean {
	if (outcomes.planned <= 0) {
		return false;
	}
	const touched =
		outcomes.completed + outcomes.fallback + outcomes.failed + outcomes.running;
	if (touched > 0) {
		return true;
	}
	return (
		runStatus === 'running' ||
		runStatus === 'failed' ||
		runStatus === 'completed'
	);
}

function normalizeAmkaExportErrorLine(value: string): string {
	return truncateAmkaExportLine(value).replace(/\s+/g, ' ').trim();
}

export function summarizeSnapshot(value: unknown): string | null {
	if (Array.isArray(value)) {
		const labels = value
			.slice(0, 3)
			.map((item) =>
				typeof item === 'object' && item
					? String(
							(item as Record<string, unknown>).title ||
								(item as Record<string, unknown>).name ||
								(item as Record<string, unknown>).headline ||
								''
						).trim()
					: ''
			)
			.filter(Boolean);
		return labels.length ? labels.join(', ') : null;
	}
	if (!value || typeof value !== 'object') return null;
	const snapshot = value as Record<string, unknown>;
	const nested = snapshot.entities;
	if (Array.isArray(nested)) {
		return summarizeSnapshot(nested);
	}
	const text = String(
		snapshot.title ||
			snapshot.name ||
			snapshot.headline ||
			snapshot.summary ||
			snapshot.status ||
			''
	).trim();
	return text || null;
}

export function amkaRunStatusClass(status: string): string {
	switch (status) {
		case 'completed':
			return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30';
		case 'failed':
			return 'bg-red-500/15 text-red-200 ring-red-500/30';
		case 'cancelled':
			return 'bg-(--desktop-text-dim)/20 text-(--desktop-text-muted) ring-(--desktop-border-subtle)';
		case 'skipped':
			return 'bg-(--desktop-text-dim)/25 text-(--desktop-text-muted) ring-(--desktop-border-subtle)';
		case 'pending':
			return 'bg-(--desktop-surface-panel) text-(--desktop-text-secondary) ring-(--desktop-border-subtle)';
		case 'awaiting_approval':
		case 'awaiting_step_approval':
			return 'bg-sky-500/15 text-sky-200 ring-sky-500/30';
		case 'planning':
		case 'queued':
		case 'running':
			return 'bg-amber-500/15 text-amber-200 ring-amber-500/30';
		default:
			return 'bg-(--desktop-surface-soft) text-(--desktop-text-muted) ring-(--desktop-border-subtle)';
	}
}

export function amkaStepStatusClass(status: string): string {
	return amkaRunStatusClass(status);
}

export function formatShortDate(value?: string | null): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(date);
}
