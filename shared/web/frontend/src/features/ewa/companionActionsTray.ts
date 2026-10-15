/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for the EWA companion **actions tray** (collapsible undo cards above the composer) —
 * visibility filtering, i18n key for the collapsed summary label, and outcome badge helpers (wave 4).
 *
 * Invariants:
 * - Tray renders only when the composer is visible and at least one action is not `closed`.
 * - Collapsed label always uses `ewaCompanion.actionsTrayCollapsed` with `{ count }`.
 * - Outcome badges render only for `blocked` and `failed` — `ok` is implicit success.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionActionsTray.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
export const COMPANION_ACTIONS_TRAY_COLLAPSED_I18N_KEY =
	'ewaCompanion.actionsTrayCollapsed' as const;

export type CompanionActionTrayKind =
	| 'open'
	| 'close'
	| 'focus'
	| 'minimize'
	| 'web_search'
	| 'notice';

export const COMPANION_ACTIONS_TRAY_GROUP_ORDER: readonly CompanionActionTrayKind[] =
	['open', 'close', 'focus', 'minimize', 'web_search', 'notice'];

export type CompanionActionsTrayGroup<
	T extends { kind: CompanionActionTrayKind },
> = {
	kind: CompanionActionTrayKind;
	rows: T[];
};

export type CompanionActionOutcome = 'ok' | 'blocked' | 'failed';

export type CompanionActionTrayFilterable = {
	closed: boolean;
};

export type CompanionActionTaskRunLinkable = {
	task_run_id?: string;
};

/** Read durable operation id stamped on a companion SPA action (Phase 5.2). */
export function readCompanionActionTaskRunId(
	action: CompanionActionTaskRunLinkable
): string | undefined {
	const id = action.task_run_id?.trim();
	return id || undefined;
}

/** Client fallback when SSE ``final`` carries ``task_run`` but per-action ids were omitted. */
export function stampCompanionActionsWithTaskRunId<
	T extends CompanionActionTaskRunLinkable,
>(actions: readonly T[], taskRun: { id?: string } | null | undefined): T[] {
	const runId = taskRun?.id?.trim();
	if (!runId) return [...actions];
	return actions.map((action) => {
		if (readCompanionActionTaskRunId(action)) return action;
		return { ...action, task_run_id: runId };
	});
}

/** Rows shown in the tray — excludes user-dismissed (`closed`) undo cards. */
export function filterVisibleCompanionActions<
	T extends CompanionActionTrayFilterable,
>(records: readonly T[]): T[] {
	return records.filter((row) => !row.closed);
}

/** Whether the collapsible actions tray section should mount. */
export function shouldShowActionsTray(
	composerVisible: boolean,
	visibleCount: number
): boolean {
	return composerVisible && visibleCount > 0;
}

/** i18n contract for the collapsed tray toggle label. */
export function buildActionsTrayCollapsedLabelArgs(visibleCount: number): {
	key: typeof COMPANION_ACTIONS_TRAY_COLLAPSED_I18N_KEY;
	options: { count: number };
} {
	return {
		key: COMPANION_ACTIONS_TRAY_COLLAPSED_I18N_KEY,
		options: { count: visibleCount },
	};
}

/** i18n key for a tray row outcome badge (`blocked` / `failed`). */
export function actionTrayOutcomeI18nKey(
	outcome: CompanionActionOutcome
): 'ewaCompanion.actionOutcomeBlocked' | 'ewaCompanion.actionOutcomeFailed' {
	return outcome === 'blocked'
		? 'ewaCompanion.actionOutcomeBlocked'
		: 'ewaCompanion.actionOutcomeFailed';
}

/** Whether the expanded tray row should show a subtle outcome badge. */
export function shouldShowOutcomeBadge(
	outcome: CompanionActionOutcome | undefined
): outcome is 'blocked' | 'failed' {
	return outcome === 'blocked' || outcome === 'failed';
}

/** Stable section order for expanded actions tray (U6.9). */
export function groupCompanionActionsTrayRows<
	T extends { kind: CompanionActionTrayKind },
>(rows: readonly T[]): CompanionActionsTrayGroup<T>[] {
	const buckets = new Map<CompanionActionTrayKind, T[]>();
	for (const kind of COMPANION_ACTIONS_TRAY_GROUP_ORDER) {
		buckets.set(kind, []);
	}
	for (const row of rows) {
		const bucket = buckets.get(row.kind);
		if (bucket) bucket.push(row);
	}
	return COMPANION_ACTIONS_TRAY_GROUP_ORDER.map((kind) => ({
		kind,
		rows: buckets.get(kind) ?? [],
	}));
}

/** Section headers only when multiple non-empty groups exist (avoid noise). */
export function shouldShowActionsTrayGroupHeaders(
	groups: readonly { rows: readonly unknown[] }[]
): boolean {
	const nonEmpty = groups.filter((group) => group.rows.length > 0);
	return nonEmpty.length > 1;
}

/** i18n key for a tray group section label. */
export function actionsTrayGroupSectionI18nKey(
	kind: CompanionActionTrayKind
):
	| 'ewaCompanion.actionsTrayGroupOpened'
	| 'ewaCompanion.actionsTrayGroupClosed'
	| 'ewaCompanion.actionsTrayGroupFocused'
	| 'ewaCompanion.actionsTrayGroupMinimized'
	| 'ewaCompanion.actionsTrayGroupWebSearch'
	| 'ewaCompanion.actionsTrayGroupNotices' {
	switch (kind) {
		case 'open':
			return 'ewaCompanion.actionsTrayGroupOpened';
		case 'close':
			return 'ewaCompanion.actionsTrayGroupClosed';
		case 'focus':
			return 'ewaCompanion.actionsTrayGroupFocused';
		case 'minimize':
			return 'ewaCompanion.actionsTrayGroupMinimized';
		case 'web_search':
			return 'ewaCompanion.actionsTrayGroupWebSearch';
		default:
			return 'ewaCompanion.actionsTrayGroupNotices';
	}
}
