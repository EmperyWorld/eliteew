/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Singleton ImperorG runner: SSE stream survives React unmount and persists progress across tabs/reloads.
 *
 * Invariants:
 * - Lost streams must resolve to `interrupted`/`error`, never remain permanently `running`.
 * - Only the leader tab owns the fetch reader; followers consume localStorage snapshots.
 * - Built-in recovery/error copy is stored as i18n keys; raw strings are fallback/server messages only.
 *
 * Related:
 * - features/site-studio/desktop/api-imperorg.ts
 * - components/ImperorG/ImperorGPanel.tsx
 */
import {
	launchImperorG,
	type ImperorGConfig,
	type ImperorGPhase,
	type ImperorGStepStatus,
} from '../../api-imperorg';

const STORAGE_KEY = 'eliteew.imperorg.snapshot.v1';
const ACTIVE_KEY = 'eliteew.imperorg.streamActive.v1';
const STALE_MS = 12_000;
const INTERRUPT_AFTER_MS = 1800_000; // 30 min — assume server stream long gone

export type ImperorGPipelineStatus =
	| 'idle'
	| 'running'
	| 'complete'
	| 'error'
	| 'interrupted';

export type ImperorGPipelineMessageKey =
	| 'autofill.error.otherTabRunning'
	| 'autofill.recovery.lostConnection'
	| 'autofill.recovery.staleProgress'
	| 'autofill.recovery.streamInterrupted';

export interface ImperorGPipelineSnapshot {
	status: ImperorGPipelineStatus;
	phases: ImperorGPhase[];
	currentPhaseIndex: number;
	errorMessage: string | null;
	errorMessageKey: ImperorGPipelineMessageKey | null;
	pipelineSummary: Record<string, unknown> | null;
	pipelineId: string | null;
	updatedAt: number;
	/** True when this tab owns the fetch reader */
	isLeader: boolean;
	/** Set when we detect reload / lost stream while storage still said running */
	recoveryHint: string | null;
	recoveryHintKey: ImperorGPipelineMessageKey | null;
}

const TAB_ID =
	typeof sessionStorage !== 'undefined'
		? sessionStorage.getItem('eliteew.tabId') ||
			(() => {
				const id = crypto.randomUUID();
				sessionStorage.setItem('eliteew.tabId', id);
				return id;
			})()
		: 'unknown';

function emptySnapshot(): ImperorGPipelineSnapshot {
	return {
		status: 'idle',
		phases: [],
		currentPhaseIndex: -1,
		errorMessage: null,
		errorMessageKey: null,
		pipelineSummary: null,
		pipelineId: null,
		updatedAt: Date.now(),
		isLeader: false,
		recoveryHint: null,
		recoveryHintKey: null,
	};
}

let snapshot: ImperorGPipelineSnapshot = emptySnapshot();
const listeners = new Set<() => void>();
let abortRef: AbortController | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let onCompleteRef: (() => void) | null = null;

function notify(): void {
	for (const fn of listeners) {
		fn();
	}
}

function persist(): void {
	try {
		const serializable = {
			status: snapshot.status,
			phases: snapshot.phases,
			currentPhaseIndex: snapshot.currentPhaseIndex,
			errorMessage: snapshot.errorMessage,
			errorMessageKey: snapshot.errorMessageKey,
			pipelineSummary: snapshot.pipelineSummary,
			pipelineId: snapshot.pipelineId,
			updatedAt: snapshot.updatedAt,
			recoveryHint: snapshot.recoveryHint,
			recoveryHintKey: snapshot.recoveryHintKey,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
	} catch {
		// quota / private mode
	}
}

function clearHeartbeat(): void {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
	try {
		const raw = localStorage.getItem(ACTIVE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { tabId?: string };
			if (parsed.tabId === TAB_ID) {
				localStorage.removeItem(ACTIVE_KEY);
			}
		}
	} catch {
		localStorage.removeItem(ACTIVE_KEY);
	}
}

function startHeartbeat(): void {
	clearHeartbeat();
	const tick = (): void => {
		try {
			localStorage.setItem(
				ACTIVE_KEY,
				JSON.stringify({ tabId: TAB_ID, t: Date.now() })
			);
		} catch {
			/* ignore */
		}
	};
	tick();
	heartbeatTimer = setInterval(tick, 2500);
}

function readStoredSnapshot(): Partial<ImperorGPipelineSnapshot> | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as Partial<ImperorGPipelineSnapshot>;
	} catch {
		return null;
	}
}

function isOtherTabStreamActive(): boolean {
	try {
		const raw = localStorage.getItem(ACTIVE_KEY);
		if (!raw) return false;
		const { tabId, t } = JSON.parse(raw) as { tabId?: string; t?: number };
		if (!t || tabId === TAB_ID) return false;
		return Date.now() - t < STALE_MS;
	} catch {
		return false;
	}
}

/** Call once on module load (before React) to recover or mark interrupted */
function bootstrapFromStorage(): void {
	const stored = readStoredSnapshot();
	if (!stored?.status) return;

	if (stored.status === 'running') {
		if (isOtherTabStreamActive()) {
			snapshot = {
				...emptySnapshot(),
				status: 'running',
				phases: stored.phases ?? [],
				currentPhaseIndex: stored.currentPhaseIndex ?? -1,
				errorMessage: null,
				errorMessageKey: null,
				pipelineSummary: null,
				pipelineId: stored.pipelineId ?? null,
				updatedAt: stored.updatedAt ?? Date.now(),
				isLeader: false,
				recoveryHint: null,
				recoveryHintKey: null,
			};
			notify();
			return;
		}
		const age = Date.now() - (stored.updatedAt ?? 0);
		if (age > INTERRUPT_AFTER_MS) {
			snapshot = {
				...emptySnapshot(),
				status: 'interrupted',
				recoveryHintKey: 'autofill.recovery.staleProgress',
				phases: stored.phases ?? [],
				currentPhaseIndex: stored.currentPhaseIndex ?? -1,
				pipelineId: stored.pipelineId ?? null,
				updatedAt: Date.now(),
			};
			persist();
			notify();
			return;
		}
		snapshot = {
			...emptySnapshot(),
			status: 'interrupted',
			recoveryHintKey: 'autofill.recovery.lostConnection',
			phases: stored.phases ?? [],
			currentPhaseIndex: stored.currentPhaseIndex ?? -1,
			pipelineId: stored.pipelineId ?? null,
			updatedAt: Date.now(),
		};
		persist();
		notify();
		return;
	}

	if (stored.status === 'complete' || stored.status === 'error') {
		snapshot = {
			...emptySnapshot(),
			status: stored.status,
			phases: stored.phases ?? [],
			currentPhaseIndex: stored.currentPhaseIndex ?? -1,
			errorMessage: stored.errorMessage ?? null,
			errorMessageKey: stored.errorMessageKey ?? null,
			pipelineSummary: stored.pipelineSummary ?? null,
			pipelineId: stored.pipelineId ?? null,
			updatedAt: stored.updatedAt ?? Date.now(),
			isLeader: false,
			recoveryHint: stored.recoveryHint ?? null,
			recoveryHintKey: stored.recoveryHintKey ?? null,
		};
		notify();
	}
}

if (typeof window !== 'undefined') {
	bootstrapFromStorage();
	window.addEventListener('storage', (e: StorageEvent) => {
		if (e.key !== STORAGE_KEY || !e.newValue) return;
		try {
			const parsed = JSON.parse(
				e.newValue
			) as Partial<ImperorGPipelineSnapshot>;
			if (snapshot.isLeader) return;
			snapshot = {
				...snapshot,
				status: (parsed.status as ImperorGPipelineStatus) ?? snapshot.status,
				phases: parsed.phases ?? snapshot.phases,
				currentPhaseIndex:
					parsed.currentPhaseIndex ?? snapshot.currentPhaseIndex,
				errorMessage: parsed.errorMessage ?? null,
				errorMessageKey: parsed.errorMessageKey ?? null,
				pipelineSummary: parsed.pipelineSummary ?? null,
				pipelineId: parsed.pipelineId ?? snapshot.pipelineId,
				updatedAt: parsed.updatedAt ?? Date.now(),
				isLeader: false,
				recoveryHint: parsed.recoveryHint ?? null,
				recoveryHintKey: parsed.recoveryHintKey ?? null,
			};
			notify();
		} catch {
			/* ignore */
		}
	});
}

export function subscribeImperorGPipeline(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

export function getImperorGPipelineSnapshot(): ImperorGPipelineSnapshot {
	return snapshot;
}

export function getServerImperorGSnapshot(): ImperorGPipelineSnapshot {
	return emptySnapshot();
}

export function runImperorGPipeline(
	config: ImperorGConfig,
	onComplete?: () => void
): void {
	if (isOtherTabStreamActive()) {
		snapshot = {
			...snapshot,
			status: 'error',
			errorMessage: null,
			errorMessageKey: 'autofill.error.otherTabRunning',
			updatedAt: Date.now(),
			isLeader: false,
		};
		persist();
		notify();
		return;
	}

	if (abortRef) {
		abortRef.abort();
	}
	const controller = new AbortController();
	abortRef = controller;
	onCompleteRef = onComplete ?? null;

	snapshot = {
		...emptySnapshot(),
		status: 'running',
		phases: [],
		currentPhaseIndex: -1,
		errorMessage: null,
		errorMessageKey: null,
		pipelineSummary: null,
		pipelineId: null,
		updatedAt: Date.now(),
		isLeader: true,
		recoveryHint: null,
		recoveryHintKey: null,
	};
	startHeartbeat();
	persist();
	notify();

	launchImperorG(
		config,
		{
			onPipelineStart(phaseDefs, pipelineId) {
				const initial: ImperorGPhase[] = phaseDefs.map((p) => ({
					id: p.id,
					label: p.label,
					icon: p.icon,
					status: 'pending' as const,
					steps: [],
				}));
				snapshot = {
					...snapshot,
					phases: initial,
					pipelineId: pipelineId || null,
					updatedAt: Date.now(),
				};
				persist();
				notify();
			},
			onPhaseStart(phaseId, phaseIndex) {
				snapshot = {
					...snapshot,
					currentPhaseIndex: phaseIndex,
					phases: snapshot.phases.map((p) =>
						p.id === phaseId ? { ...p, status: 'running' as const } : p
					),
					updatedAt: Date.now(),
				};
				persist();
				notify();
			},
			onPhaseStep(phaseId, stepId, label, stepStatus, summary) {
				snapshot = {
					...snapshot,
					phases: snapshot.phases.map((p) => {
						if (p.id !== phaseId) return p;
						const existing = p.steps.findIndex((s) => s.stepId === stepId);
						const step = {
							stepId,
							label,
							status: stepStatus as ImperorGStepStatus,
							summary,
						};
						const nextSteps =
							existing >= 0
								? p.steps.map((s, i) => (i === existing ? step : s))
								: [...p.steps, step];
						return { ...p, steps: nextSteps };
					}),
					updatedAt: Date.now(),
				};
				persist();
				notify();
			},
			onPhaseComplete(phaseId) {
				snapshot = {
					...snapshot,
					phases: snapshot.phases.map((p) =>
						p.id === phaseId ? { ...p, status: 'done' as const } : p
					),
					updatedAt: Date.now(),
				};
				persist();
				notify();
			},
			onPipelineComplete(data) {
				clearHeartbeat();
				abortRef = null;
				snapshot = {
					...snapshot,
					status: 'complete',
					pipelineSummary: data,
					isLeader: false,
					updatedAt: Date.now(),
				};
				persist();
				notify();
				try {
					onCompleteRef?.();
				} finally {
					onCompleteRef = null;
				}
			},
			onPipelineError(error) {
				clearHeartbeat();
				abortRef = null;
				snapshot = {
					...snapshot,
					status: 'error',
					errorMessage: error,
					errorMessageKey: null,
					isLeader: false,
					updatedAt: Date.now(),
				};
				persist();
				notify();
				onCompleteRef = null;
			},
		},
		controller.signal
	).catch((err: unknown) => {
		if (controller.signal.aborted) {
			clearHeartbeat();
			abortRef = null;
			snapshot = {
				...snapshot,
				status: 'idle',
				isLeader: false,
				updatedAt: Date.now(),
			};
			persist();
			notify();
			onCompleteRef = null;
			return;
		}
		clearHeartbeat();
		abortRef = null;
		const errorMessage = err instanceof Error ? err.message : String(err);
		const interrupted = /stream ended before completion|interrupted/i.test(
			errorMessage
		);
		snapshot = {
			...snapshot,
			status: interrupted ? 'interrupted' : 'error',
			errorMessage: interrupted ? null : errorMessage,
			errorMessageKey: null,
			isLeader: false,
			recoveryHint: interrupted ? null : snapshot.recoveryHint,
			recoveryHintKey: interrupted
				? 'autofill.recovery.streamInterrupted'
				: snapshot.recoveryHintKey,
			updatedAt: Date.now(),
		};
		persist();
		notify();
		onCompleteRef = null;
	});
}

export function cancelImperorGPipeline(): void {
	if (snapshot.status === 'running' && !snapshot.isLeader) {
		return;
	}
	if (abortRef) {
		abortRef.abort();
		abortRef = null;
	}
	clearHeartbeat();
	snapshot = {
		...emptySnapshot(),
		updatedAt: Date.now(),
	};
	persist();
	notify();
	onCompleteRef = null;
}

export function dismissImperorGInterrupted(): void {
	snapshot = {
		...emptySnapshot(),
		updatedAt: Date.now(),
	};
	persist();
	notify();
}
