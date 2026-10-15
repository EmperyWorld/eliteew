import type { CustomerDiagnosticSession } from '@/pages/MarketingCabinet/marketingCabinetApi';

import { DIAGNOSTIC_MODULE_ORDER } from './diagnosticDefinition';
import { isModuleComplete } from './diagnosticProgress';
import type { CustomerDiagnosticSessionState } from './diagnosticTypes';

export function reconcileCompletedModules(
	state: CustomerDiagnosticSessionState
): CustomerDiagnosticSessionState['completedModules'] {
	const next = new Set(state.completedModules);
	for (const m of DIAGNOSTIC_MODULE_ORDER) {
		if (isModuleComplete(m, state)) next.add(m);
	}
	return Array.from(next);
}

export function answersLookNonEmpty(
	answers: CustomerDiagnosticSessionState['answers']
): boolean {
	if (!answers || typeof answers !== 'object') return false;
	return JSON.stringify(answers) !== '{}';
}

/** После загрузки с сервера: не оставлять welcome при уже начатой работе; при полном прохождении — экран итогов. */
export function applyDiagnosticLoadHints(
	state: CustomerDiagnosticSessionState,
	session: CustomerDiagnosticSession
): CustomerDiagnosticSessionState {
	const completed = reconcileCompletedModules(state);
	const next: CustomerDiagnosticSessionState = {
		...state,
		completedModules: completed,
	};
	const allDone = DIAGNOSTIC_MODULE_ORDER.every((m) => completed.includes(m));
	let { uiPhase } = next;
	if (
		allDone ||
		(session.completed_at != null && session.progress_percent >= 100)
	) {
		uiPhase = 'complete';
	} else if (
		uiPhase === 'welcome' &&
		(completed.length > 0 || answersLookNonEmpty(next.answers))
	) {
		uiPhase = 'hub';
	}
	return { ...next, uiPhase };
}
