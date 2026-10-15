/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Force-disconnect all authenticated Socket.IO clients on auth session termination.
 *
 * Invariants:
 * - Clears hook-registered sockets and the Services.socket singleton; no token logging.
 *
 * Related:
 * - authSessionCoordinator.ts, hooks/useSocketConnection.tsx, EmperyworldSocketService.ts
 */

type SocketTeardownFn = () => void;

const hookTeardownFns = new Set<SocketTeardownFn>();

let mainSocketTeardownPromise: Promise<void> | null = null;

/** Register a React-hook socket disconnect (useSocketConnection). */
export function registerAuthSessionSocketTeardown(
	fn: SocketTeardownFn
): () => void {
	hookTeardownFns.add(fn);
	return () => {
		hookTeardownFns.delete(fn);
	};
}

function runHookSocketTeardowns(): void {
	for (const fn of [...hookTeardownFns]) {
		try {
			fn();
		} catch {
			/* best-effort */
		}
	}
}

async function disconnectMainSocketService(): Promise<void> {
	try {
		const { Services } = await import('@/services');
		Services.socket.disconnect();
	} catch {
		/* ignore — offline/tests */
	}
}

/** Disconnect hook sockets and the canonical EmperyworldSocketService instance. */
export function terminateAllAuthenticatedSockets(): void {
	runHookSocketTeardowns();
	if (!mainSocketTeardownPromise) {
		mainSocketTeardownPromise = disconnectMainSocketService().finally(() => {
			mainSocketTeardownPromise = null;
		});
	}
}

export function resetAuthSessionSocketTeardownForTests(): void {
	hookTeardownFns.clear();
	mainSocketTeardownPromise = null;
}
