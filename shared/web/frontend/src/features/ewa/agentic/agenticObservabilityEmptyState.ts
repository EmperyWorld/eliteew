/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map agentic session status + panel data to honest empty-state copy for tree/trace panels.
 *
 * Invariants:
 * - API errors always win over empty-data heuristics.
 *
 * Related:
 * - src/features/ewa/agentic/AgenticTaskTreePanel.tsx
 * - src/features/ewa/agentic/AgenticExecutionTrace.tsx
 */

export type AgenticObservabilityPanelKind = 'tree' | 'trace';

function isTerminalAgenticObservabilityStatus(status: string): boolean {
	return (
		status === 'completed' ||
		status === 'failed' ||
		status === 'cancelled' ||
		status === 'abandoned'
	);
}

export function resolveAgenticObservabilityEmptyMessage(
	kind: AgenticObservabilityPanelKind,
	sessionStatus: string,
	options: {
		hasSiblingData?: boolean;
	},
	t: (key: string, defaultValue: string) => string
): string {
	const status = sessionStatus.trim().toLowerCase();
	if (kind === 'tree') {
		if (status === 'planning' || status === 'replanning' || status === 'init') {
			return t(
				'ewaCompanion.agenticTreePlanning',
				'План ещё формируется — дерево появится после первого шага Think'
			);
		}
		if (options.hasSiblingData) {
			return t(
				'ewaCompanion.agenticTreeTraceOnly',
				'Шаги уже есть в трассе, но дерево задач пока пустое'
			);
		}
		if (status === 'executing' || status === 'awaiting_human') {
			return t(
				'ewaCompanion.agenticTreeExecutingEmpty',
				'Сессия выполняется — ждём первый шаг в дереве'
			);
		}
		if (isTerminalAgenticObservabilityStatus(status)) {
			return t(
				'ewaCompanion.agenticTreeTerminalEmpty',
				'Подробные шаги для этой миссии не сохранились — итог выше в результате'
			);
		}
		return t('ewaCompanion.agenticTreeEmpty', 'План ещё не построен');
	}

	if (status === 'planning' || status === 'replanning' || status === 'init') {
		return t(
			'ewaCompanion.agenticTracePlanning',
			'Трасса появится после первого checkpoint Think/Act'
		);
	}
	if (options.hasSiblingData) {
		return t(
			'ewaCompanion.agenticTraceTreeOnly',
			'Дерево уже есть, но checkpoint-лог пока пуст'
		);
	}
	if (status === 'executing') {
		return t(
			'ewaCompanion.agenticTraceExecutingEmpty',
			'Выполнение идёт — шаги появятся после первого Act'
		);
	}
	if (isTerminalAgenticObservabilityStatus(status)) {
		return t(
			'ewaCompanion.agenticTraceTerminalEmpty',
			'Журнал выполнения пуст — подробности шагов для этой миссии недоступны'
		);
	}
	return t('ewaCompanion.agenticTraceEmpty', 'Пока нет шагов');
}
