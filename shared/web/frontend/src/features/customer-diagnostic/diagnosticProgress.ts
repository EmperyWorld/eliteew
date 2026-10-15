import { DIAGNOSTIC_MODULE_ORDER, QUESTIONS } from './diagnosticDefinition';
import type {
	CustomerDiagnosticSessionState,
	DiagnosticModuleId,
} from './diagnosticTypes';

function countArchetypeAnswered(state: CustomerDiagnosticSessionState): number {
	const a = state.answers.archetype;
	if (!a) return 0;
	return Object.keys(a).filter((k) => /^\d+$/.test(k)).length;
}

function countValuesAnswered(state: CustomerDiagnosticSessionState): number {
	const a = state.answers.values;
	if (!a) return 0;
	return Object.keys(a).filter((k) => /^\d+$/.test(k)).length;
}

function countBusinessAnswered(state: CustomerDiagnosticSessionState): number {
	const a = state.answers.business;
	if (!a) return 0;
	return Object.keys(a).filter((k) => /^\d+$/.test(k)).length;
}

function countServiceAnswered(state: CustomerDiagnosticSessionState): number {
	const a = state.answers.service;
	if (!a) return 0;
	return Object.keys(a).filter((k) => /^\d+$/.test(k)).length;
}

function emotionsTotalSteps(selectedCount: number): number {
	if (selectedCount < 4) return 1;
	return 1 + selectedCount * 2;
}

function countEmotionsAnswered(state: CustomerDiagnosticSessionState): number {
	const em = state.answers.emotions;
	if (!em || typeof em !== 'object') return 0;
	const tp = em.selectedTouchpoints;
	if (!Array.isArray(tp)) return 0;
	if (tp.length < 4 || tp.length > 8) return 0;
	let n = 1;
	for (const id of tp) {
		if (typeof id !== 'string') continue;
		const emo = em[`touchpoint_${id}_emotions`];
		if (emo && typeof emo === 'object' && Object.keys(emo).length > 0) {
			n += 1;
		}
		const imp = em[`touchpoint_${id}_impact`];
		if (
			imp &&
			typeof imp === 'object' &&
			'importance' in imp &&
			'quality' in imp &&
			'influence' in imp
		) {
			n += 1;
		}
	}
	return n;
}

export function getModuleAnswerProgress(
	moduleId: DiagnosticModuleId,
	state: CustomerDiagnosticSessionState
): { answered: number; total: number; percent: number } {
	const { answered, total } = moduleAnsweredAndTotal(moduleId, state);
	const denom = Math.max(1, total);
	return {
		answered,
		total,
		percent: Math.min(100, Math.round((answered / denom) * 100)),
	};
}

function moduleAnsweredAndTotal(
	moduleId: DiagnosticModuleId,
	state: CustomerDiagnosticSessionState
): { answered: number; total: number } {
	switch (moduleId) {
		case 'archetype':
			return {
				answered: countArchetypeAnswered(state),
				total: QUESTIONS.archetype.length,
			};
		case 'values':
			return {
				answered: countValuesAnswered(state),
				total: QUESTIONS.values.length,
			};
		case 'business':
			return {
				answered: countBusinessAnswered(state),
				total: QUESTIONS.business.length,
			};
		case 'service':
			return {
				answered: countServiceAnswered(state),
				total: QUESTIONS.service.length,
			};
		case 'emotions': {
			const em = state.answers.emotions;
			const tp =
				em && typeof em === 'object' && Array.isArray(em.selectedTouchpoints)
					? (em.selectedTouchpoints as string[])
					: [];
			const total = emotionsTotalSteps(tp.length);
			return { answered: countEmotionsAnswered(state), total };
		}
		default:
			return { answered: 0, total: 1 };
	}
}

/** 0–100: взвешенная доля ответов по всем модулям. */
export function computeDiagnosticProgressPercent(
	state: CustomerDiagnosticSessionState
): number {
	let weighted = 0;
	let weightSum = 0;
	for (const m of DIAGNOSTIC_MODULE_ORDER) {
		const { answered, total } = moduleAnsweredAndTotal(m, state);
		const t = Math.max(1, total);
		weighted += (answered / t) * t;
		weightSum += t;
	}
	if (weightSum <= 0) return 0;
	return Math.min(100, Math.round((weighted / weightSum) * 100));
}

export function isModuleComplete(
	moduleId: DiagnosticModuleId,
	state: CustomerDiagnosticSessionState
): boolean {
	const { answered, total } = moduleAnsweredAndTotal(moduleId, state);
	return answered >= total && total > 0;
}

/**
 * Как celzrel: следующий модуль открыт только после завершения предыдущего
 * в `DIAGNOSTIC_MODULE_ORDER`. Первый модуль всегда доступен.
 */
export function getBlockingPreviousModule(
	moduleId: DiagnosticModuleId,
	state: CustomerDiagnosticSessionState
): DiagnosticModuleId | null {
	const idx = DIAGNOSTIC_MODULE_ORDER.indexOf(moduleId);
	if (idx <= 0) return null;
	const prev = DIAGNOSTIC_MODULE_ORDER[idx - 1];
	if (isModuleComplete(prev, state)) return null;
	return prev;
}

export function isModuleUnlocked(
	moduleId: DiagnosticModuleId,
	state: CustomerDiagnosticSessionState
): boolean {
	return getBlockingPreviousModule(moduleId, state) === null;
}

export function canShowCustomerDiagnosticTab(
	settingsEnabled: boolean | undefined
): boolean {
	return settingsEnabled === true;
}
