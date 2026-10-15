export type DiagnosticModuleId =
	| 'archetype'
	| 'values'
	| 'business'
	| 'service'
	| 'emotions';

export type CustomerDiagnosticUiPhase =
	| 'welcome'
	| 'hub'
	| 'module'
	| 'complete';

/** Persisted in API session `state` JSONB */
export type CustomerDiagnosticSessionState = {
	version: 1;
	uiPhase: CustomerDiagnosticUiPhase;
	activeModuleId: DiagnosticModuleId | null;
	/** Index of the current question within the active module (0-based). */
	step: number;
	completedModules: DiagnosticModuleId[];
	answers: DiagnosticAnswersByModule;
};

export type DiagnosticAnswersByModule = {
	archetype?: Record<string, number>;
	values?: Record<string, ValuesQuestionAnswer>;
	business?: Record<string, number>;
	service?: Record<string, number | ServiceExpectationRealityAnswer>;
	emotions?: Record<string, unknown>;
};

export type ValuesQuestionAnswer =
	| { type: 'scale'; values: Record<string, number> }
	| { type: 'choice'; value: string }
	| { type: 'ranking'; values: Record<string, number> };

export type ServiceExpectationRealityAnswer = {
	expectation: number;
	reality: number;
	gap: number;
};

export type EmotionWheelEntry = {
	name: string;
	color: string;
	valence: number;
	description: string;
};

export type JourneyStage = {
	id: string;
	name: string;
	description: string;
	icon: string;
};

export function defaultCustomerDiagnosticState(): CustomerDiagnosticSessionState {
	return {
		version: 1,
		uiPhase: 'welcome',
		activeModuleId: null,
		step: 0,
		completedModules: [],
		answers: {},
	};
}

export function normalizeSessionState(
	raw: Record<string, unknown> | null | undefined
): CustomerDiagnosticSessionState {
	const base = defaultCustomerDiagnosticState();
	if (!raw || typeof raw !== 'object') return base;
	const version = raw.version;
	if (version !== 1) return base;

	const uiPhase = raw.uiPhase;
	const activeModuleId = raw.activeModuleId;
	const step = raw.step;
	const completedModules = raw.completedModules;
	const answers = raw.answers;

	return {
		version: 1,
		uiPhase:
			uiPhase === 'welcome' ||
			uiPhase === 'hub' ||
			uiPhase === 'module' ||
			uiPhase === 'complete'
				? uiPhase
				: 'welcome',
		activeModuleId:
			activeModuleId === 'archetype' ||
			activeModuleId === 'values' ||
			activeModuleId === 'business' ||
			activeModuleId === 'service' ||
			activeModuleId === 'emotions'
				? activeModuleId
				: null,
		step: typeof step === 'number' && step >= 0 ? Math.floor(step) : 0,
		completedModules: Array.isArray(completedModules)
			? (completedModules.filter((m) =>
					['archetype', 'values', 'business', 'service', 'emotions'].includes(
						m as string
					)
				) as DiagnosticModuleId[])
			: [],
		answers:
			answers && typeof answers === 'object'
				? (answers as DiagnosticAnswersByModule)
				: {},
	};
}
