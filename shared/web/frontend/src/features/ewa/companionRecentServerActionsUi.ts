/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read **`learned_preferences.companion_recent_server_actions`** (orchestrator Phase D.2 ring buffer) and coerce rows
 * into a small typed list for the EWA chat **user-visible** strip — mirrors the Python sanitizer in
 * ``api/ewa_platform/companion/sidecar/recent_server_actions.py`` (`_coerce_entry`).
 *
 * Invariants:
 * - Pure helpers; tolerant of malformed JSON / missing fields; never throws.
 * - Keys and length limits stay aligned with ``companion_asyncpg.py`` / ``recent_server_actions.py`` on the API.
 * - User strip filters stale open-app rows and entries older than ``RECENT_SERVER_ACTIONS_UI_MAX_AGE_MS``.
 *
 * Related:
 * - api/ewa_platform/persistence_pg/companion_asyncpg.py (`COMPANION_RECENT_SERVER_ACTIONS_KEY`)
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import { normalizeLearnedPreferences } from '@/services/ewa/ewaCompanionChatApi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

/** Canonical storage key — must match backend ``COMPANION_RECENT_SERVER_ACTIONS_KEY``. */
export const EWA_COMPANION_RECENT_SERVER_ACTIONS_KEY =
	'companion_recent_server_actions' as const;

const _MAX_LINE_CHARS = 220;
const _MAX_TOOL_CHARS = 64;

export type CompanionRecentServerActionDisplay = {
	tool: string;
	branch: string;
	status: string;
	summary: string;
	ts: string;
};

function coerceEntry(raw: unknown): CompanionRecentServerActionDisplay | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const o = raw as Record<string, unknown>;
	const tool = String(o.tool ?? o.branch ?? '')
		.trim()
		.slice(0, _MAX_TOOL_CHARS);
	if (!tool) return null;
	const branch = String(o.branch ?? tool)
		.trim()
		.slice(0, _MAX_TOOL_CHARS);
	const status = String(o.status ?? 'ok')
		.trim()
		.toLowerCase()
		.slice(0, 32);
	const summary = String(o.summary ?? '')
		.trim()
		.slice(0, _MAX_LINE_CHARS);
	const ts = String(o.ts ?? '')
		.trim()
		.slice(0, 40);
	return { tool, branch, status, summary, ts };
}

/** User-facing strip hides entries older than this (LLM ring buffer unchanged). */
export const RECENT_SERVER_ACTIONS_UI_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const _OPEN_ACTION_APP_COMPONENT: Record<string, string> = {
	music_studio_open: 'MusicForgeApp',
};

export function resolveOpenAppComponentForRecentServerAction(
	tool: string
): string | null {
	const key = tool.trim().toLowerCase();
	return _OPEN_ACTION_APP_COMPONENT[key] ?? null;
}

function parseRecentServerActionTimestampMs(ts: string): number | null {
	const raw = ts.trim();
	if (!raw) return null;
	const ms = Date.parse(raw);
	return Number.isFinite(ms) ? ms : null;
}

export type FilterRecentServerActionsOptions = {
	nowMs?: number;
	maxAgeMs?: number;
	/** When set, hides open-app tool rows if the app is not currently open on the desk. */
	openAppComponents?: ReadonlySet<string> | null;
};

/** Drop aged rows and stale open-app actions for the user-visible strip. */
export function filterRecentServerActionsForDisplay(
	entries: CompanionRecentServerActionDisplay[],
	options?: FilterRecentServerActionsOptions
): CompanionRecentServerActionDisplay[] {
	const nowMs = options?.nowMs ?? Date.now();
	const maxAgeMs = options?.maxAgeMs ?? RECENT_SERVER_ACTIONS_UI_MAX_AGE_MS;
	const openApps = options?.openAppComponents;

	return entries.filter((entry) => {
		const tsMs = parseRecentServerActionTimestampMs(entry.ts);
		if (tsMs != null && nowMs - tsMs > maxAgeMs) return false;

		const appComponent = resolveOpenAppComponentForRecentServerAction(
			entry.tool
		);
		if (appComponent && openApps && !openApps.has(appComponent)) {
			return false;
		}
		return true;
	});
}

export type CompanionRecentServerActionDisplayLabels = {
	musicStudioOpen: string;
	appOpen: string;
	themeSet: string;
	docCreate: string;
	docInsert: string;
	fileRename: string;
	fileDelete: string;
	planCreate: string;
	planTaskComplete: string;
	operationsStatus: string;
	operationCancel: string;
	generic: (tool: string) => string;
	statusOk: string;
	statusNeedsConfirm: string;
};

function intentLabelForTool(
	tool: string,
	labels: CompanionRecentServerActionDisplayLabels
): string {
	const kind = tool.trim().toLowerCase();
	switch (kind) {
		case 'music_studio_open':
			return labels.musicStudioOpen;
		case 'app_open':
			return labels.appOpen;
		case 'theme_set':
			return labels.themeSet;
		case 'doc_create':
			return labels.docCreate;
		case 'doc_insert_file_into_editor':
			return labels.docInsert;
		case 'file_rename':
			return labels.fileRename;
		case 'file_delete':
			return labels.fileDelete;
		case 'plan_v1':
			return labels.planCreate;
		case 'plan_task_complete_v1':
			return labels.planTaskComplete;
		case 'operations_status':
			return labels.operationsStatus;
		case 'operation_cancel':
			return labels.operationCancel;
		default:
			return labels.generic(tool);
	}
}

/** User-facing line: prefer server summary; otherwise localized intent (no raw tool ids). */
export function formatCompanionRecentServerActionUserLine(
	entry: CompanionRecentServerActionDisplay,
	labels: CompanionRecentServerActionDisplayLabels
): string {
	const summary = entry.summary.trim();
	if (summary) return summary;
	const action = intentLabelForTool(entry.tool, labels);
	const status =
		entry.status === 'needs_confirm'
			? labels.statusNeedsConfirm
			: labels.statusOk;
	return `${action} — ${status}`;
}

/**
 * Returns recent server-tool outcomes for UI (oldest → newest), empty when absent or all malformed.
 */
export function extractRecentServerActionsForDisplay(
	learned: unknown
): CompanionRecentServerActionDisplay[] {
	const lp = normalizeLearnedPreferences(learned);
	let ringRaw: unknown = lp[EWA_COMPANION_RECENT_SERVER_ACTIONS_KEY];
	if (typeof ringRaw === 'string') {
		try {
			ringRaw = JSON.parse(ringRaw) as unknown;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_recent_server_actions_parse',
				'recent server actions ring JSON parse failed',
				err
			);
			return [];
		}
	}
	if (!Array.isArray(ringRaw) || ringRaw.length === 0) return [];
	const out: CompanionRecentServerActionDisplay[] = [];
	for (const raw of ringRaw) {
		const entry = coerceEntry(raw);
		if (entry) out.push(entry);
	}
	return out;
}

/**
 * Debug-oriented line (`tool · status · summary`). Prefer {@link formatCompanionRecentServerActionUserLine} in UI.
 */
export function formatCompanionRecentServerActionLine(
	entry: CompanionRecentServerActionDisplay
): string {
	const tail = entry.summary || '—';
	return `${entry.tool} · ${entry.status} · ${tail}`;
}
