const SESSION_PREFIX = 'mc-dashboard-preset-history';
const LOCAL_PREFIX = 'mc-dashboard-preset-history-local';
const MAX_NAMES = 10;

function sessionKey(projectId: string): string {
	return `${SESSION_PREFIX}:${projectId}`;
}

function localKey(projectId: string): string {
	return `${LOCAL_PREFIX}:${projectId}`;
}

function readSession(projectId: string): string[] {
	try {
		return JSON.parse(
			sessionStorage.getItem(sessionKey(projectId)) || '[]'
		) as string[];
	} catch {
		return [];
	}
}

function readLocal(projectId: string): string[] {
	try {
		return JSON.parse(
			localStorage.getItem(localKey(projectId)) || '[]'
		) as string[];
	} catch {
		return [];
	}
}

function writeLocal(projectId: string, names: string[]): void {
	try {
		localStorage.setItem(
			localKey(projectId),
			JSON.stringify(names.slice(0, MAX_NAMES))
		);
	} catch {
		// quota / private mode
	}
}

export function pushDashboardPresetHistory(
	projectId: string,
	presetName: string
): void {
	if (!presetName) {
		return;
	}
	try {
		const prevS = readSession(projectId);
		const next = [presetName, ...prevS.filter((x) => x !== presetName)].slice(
			0,
			MAX_NAMES
		);
		sessionStorage.setItem(sessionKey(projectId), JSON.stringify(next));

		const prevL = readLocal(projectId);
		const merged = [presetName, ...next, ...prevL]
			.filter((x, i, a) => Boolean(x) && a.indexOf(x) === i)
			.slice(0, MAX_NAMES);
		writeLocal(projectId, merged);
	} catch {
		// ignore
	}
}

/** Последние уникальные имена пресетов (не более `limit`), от новых к старым. */
export function listRecentDashboardPresetNames(
	projectId: string,
	limit = 3
): string[] {
	try {
		let loc = readLocal(projectId);
		if (loc.length === 0) {
			const sess = readSession(projectId);
			if (sess.length > 0) {
				writeLocal(projectId, sess);
				loc = sess;
			}
		}
		const n = Math.max(0, Math.min(MAX_NAMES, Math.trunc(limit)));
		return loc.slice(0, n);
	} catch {
		return [];
	}
}

export function lastDashboardPresetFromHistory(
	projectId: string
): string | null {
	const one = listRecentDashboardPresetNames(projectId, 1);
	return one[0] ?? null;
}
