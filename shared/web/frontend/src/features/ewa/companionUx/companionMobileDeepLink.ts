/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse mobile companion hash deep links for operations, tools, phrases, workflows.
 *
 * Invariants:
 * - `operation` / `run` take priority over surface open keys.
 * - Consumed keys are stripped via `history.replaceState` so refresh does not re-trigger.
 *
 * Related:
 * - src/utils/mobileEmbeddedSpaRoute.ts, EwaCompanionChatPanel.tsx
 */

export type CompanionMobileDeepLinkIntent =
	| { kind: 'operation'; runId: string }
	| { kind: 'tools' }
	| { kind: 'phrases' }
	| { kind: 'workflows' };

function hashQueryString(): string | null {
	if (typeof window === 'undefined') return null;
	const hash = window.location.hash;
	const qIndex = hash.indexOf('?');
	if (qIndex < 0) return null;
	return hash.slice(qIndex + 1);
}

function hashQueryParams(): URLSearchParams | null {
	const query = hashQueryString();
	return query ? new URLSearchParams(query) : null;
}

function stripHashQueryKeys(keys: string[]): void {
	if (typeof window === 'undefined') return;
	try {
		const hash = window.location.hash;
		const qIndex = hash.indexOf('?');
		const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
		const params = new URLSearchParams(
			qIndex >= 0 ? hash.slice(qIndex + 1) : ''
		);
		for (const key of keys) {
			params.delete(key);
		}
		const nextQuery = params.toString();
		const nextHash = nextQuery ? `${path}?${nextQuery}` : path;
		window.history.replaceState(
			null,
			'',
			`${window.location.pathname}${window.location.search}${nextHash}`
		);
	} catch {
		// Hash cleanup is best-effort.
	}
}

function resolveSurfaceOpenTarget(
	params: URLSearchParams
): 'tools' | 'phrases' | 'workflows' | null {
	if (params.get('tools') === '1') return 'tools';
	if (params.get('phrases') === '1') return 'phrases';
	if (params.get('workflows') === '1') return 'workflows';
	const open = (params.get('open') || '').trim().toLowerCase();
	if (open === 'tools' || open === 'phrases' || open === 'workflows') {
		return open;
	}
	return null;
}

export function resolveCompanionMobileOperationRunIdFromHash(): string | null {
	const params = hashQueryParams();
	if (!params) return null;
	const raw = params.get('operation') ?? params.get('run');
	const trimmed = raw?.trim();
	return trimmed || null;
}

/** Read and strip `operation` / `run` from the hash so refresh does not re-open the sheet. */
export function consumeCompanionMobileOperationRunIdFromHash(): string | null {
	const runId = resolveCompanionMobileOperationRunIdFromHash();
	if (!runId || typeof window === 'undefined') return null;
	stripHashQueryKeys(['operation', 'run']);
	return runId;
}

export function resolveCompanionMobileToolsOpenFromHash(): boolean {
	const params = hashQueryParams();
	if (!params) return false;
	return resolveSurfaceOpenTarget(params) === 'tools';
}

export function resolveCompanionMobilePhrasesOpenFromHash(): boolean {
	const params = hashQueryParams();
	if (!params) return false;
	return resolveSurfaceOpenTarget(params) === 'phrases';
}

export function resolveCompanionMobileWorkflowsOpenFromHash(): boolean {
	const params = hashQueryParams();
	if (!params) return false;
	return resolveSurfaceOpenTarget(params) === 'workflows';
}

/** Read and strip tools deep-link keys so refresh does not re-open the catalog. */
export function consumeCompanionMobileToolsOpenFromHash(): boolean {
	const shouldOpen = resolveCompanionMobileToolsOpenFromHash();
	if (!shouldOpen || typeof window === 'undefined') return false;
	stripHashQueryKeys(['tools', 'open']);
	return true;
}

/** Single consumer for mobile companion entry intents (priority: operation → tools → phrases → workflows). */
export function consumeCompanionMobileDeepLinkIntent(): CompanionMobileDeepLinkIntent | null {
	const runId = resolveCompanionMobileOperationRunIdFromHash();
	if (runId) {
		stripHashQueryKeys(['operation', 'run']);
		return { kind: 'operation', runId };
	}
	const params = hashQueryParams();
	if (!params) return null;
	const target = resolveSurfaceOpenTarget(params);
	if (!target) return null;
	if (target === 'tools') {
		stripHashQueryKeys(['tools', 'open']);
		return { kind: 'tools' };
	}
	if (target === 'phrases') {
		stripHashQueryKeys(['phrases', 'open']);
		return { kind: 'phrases' };
	}
	stripHashQueryKeys(['workflows', 'open']);
	return { kind: 'workflows' };
}
