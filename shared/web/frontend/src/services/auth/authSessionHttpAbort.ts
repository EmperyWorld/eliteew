/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AbortController registry + session epoch signal — abort every in-flight axios/fetch on auth teardown.
 *
 * Invariants:
 * - Each apiClient request registers an AbortController until the response settles.
 * - abortAllPendingHttpRequests() aborts registered controllers and the session epoch (no localStorage.clear()).
 *
 * Related:
 * - authSessionCoordinator.ts, services/api/client.ts
 */

const AUTH_SESSION_ABORT_REASON = 'auth_session_teardown';

let sessionAbortController =
	typeof AbortController !== 'undefined' ? new AbortController() : null;

const activeRequestControllers = new Set<AbortController>();

function combineAbortSignals(
	primary: AbortSignal,
	secondary: AbortSignal
): AbortSignal {
	if (primary.aborted) {
		return primary;
	}
	if (secondary.aborted) {
		return secondary;
	}
	if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
		return AbortSignal.any([primary, secondary]);
	}
	const merged = new AbortController();
	const abortMerged = () => {
		merged.abort(AUTH_SESSION_ABORT_REASON);
	};
	primary.addEventListener('abort', abortMerged, { once: true });
	secondary.addEventListener('abort', abortMerged, { once: true });
	return merged.signal;
}

/** Signal tied to the current auth session epoch; aborted on teardown. */
export function getAuthSessionAbortSignal(): AbortSignal | undefined {
	return sessionAbortController?.signal;
}

/** Merge caller signal with the session epoch signal (axios/fetch). */
export function mergeWithAuthSessionAbortSignal(
	existing?: AbortSignal | null
): AbortSignal | undefined {
	const sessionSignal = getAuthSessionAbortSignal();
	if (!sessionSignal) {
		return existing ?? undefined;
	}
	if (!existing) {
		return sessionSignal;
	}
	return combineAbortSignals(existing, sessionSignal);
}

export type ActiveRequestAbortRegistration = {
	signal: AbortSignal;
	release: () => void;
};

/**
 * Register a per-request AbortController (AbortControllerRegistry entry).
 * Caller must invoke release() when the HTTP exchange completes.
 */
export function registerActiveRequestAbortController(
	existing?: AbortSignal | null
): ActiveRequestAbortRegistration {
	const controller = new AbortController();
	activeRequestControllers.add(controller);
	let released = false;
	const release = () => {
		if (released) {
			return;
		}
		released = true;
		activeRequestControllers.delete(controller);
	};
	const requestSignal = existing
		? combineAbortSignals(controller.signal, existing)
		: controller.signal;
	const signal =
		mergeWithAuthSessionAbortSignal(requestSignal) ?? requestSignal;
	return { signal, release };
}

/** Count of in-flight registered requests (tests/diagnostics). */
export function getActiveRequestAbortControllerCount(): number {
	return activeRequestControllers.size;
}

/** Abort every registered request and the session epoch signal. */
export function abortAllPendingHttpRequests(): void {
	for (const controller of activeRequestControllers) {
		if (!controller.signal.aborted) {
			controller.abort(AUTH_SESSION_ABORT_REASON);
		}
	}
	activeRequestControllers.clear();
	if (sessionAbortController) {
		sessionAbortController.abort(AUTH_SESSION_ABORT_REASON);
	}
	if (typeof AbortController !== 'undefined') {
		sessionAbortController = new AbortController();
	}
}

/** Alias for coordinator kill-switch naming. */
export const abortAllRegisteredHttpRequests = abortAllPendingHttpRequests;

export function isHttpRequestAbortLikeError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	const candidate = error as {
		code?: string;
		name?: string;
		message?: string;
	};
	return (
		candidate.code === 'ERR_CANCELED' ||
		candidate.name === 'AbortError' ||
		candidate.name === 'CanceledError' ||
		candidate.message === 'canceled' ||
		candidate.message === 'auth_session_teardown_in_progress'
	);
}

export function resetAuthSessionHttpAbortForTests(): void {
	activeRequestControllers.clear();
	if (typeof AbortController !== 'undefined') {
		sessionAbortController = new AbortController();
	} else {
		sessionAbortController = null;
	}
}
