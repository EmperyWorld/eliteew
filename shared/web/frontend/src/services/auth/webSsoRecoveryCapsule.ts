/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W3 recovery-capsule client envelope + registry of flushers
 * (intended route, drafts, slim shell snapshot). Never includes tokens.
 *
 * Invariants:
 * - Flush is best-effort with a hard deadline; failure must not block teardown UX.
 * - Soft checkpoint uses reason soft_checkpoint; terminal uses classifier kind.
 *
 * Related:
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W3
 * - `GET/PUT /api/v1/auth/sso/recovery-capsule`
 */

import { getToken } from '../keycloakAuthOidcFacade';
import { log } from '../../utils/logger';
import { INTENDED_PAGE_SESSION_KEY } from '../../constants/storageKeys';

const LOG = 'WebSsoRecoveryCapsule';
const FLUSH_DEADLINE_MS = 2_000;
const API_PATH = '/api/v1/auth/sso/recovery-capsule';

export type WebSsoRecoveryCapsulePayload = {
	schema_version: 1;
	intended_route: string;
	drafts: Record<string, unknown>;
	shell?: Record<string, unknown>;
	preserved_at: string;
};

export type RecoveryCapsuleFlusher = () =>
	| Partial<{
			intended_route: string;
			drafts: Record<string, unknown>;
			shell: Record<string, unknown>;
	  }>
	| Promise<
			Partial<{
				intended_route: string;
				drafts: Record<string, unknown>;
				shell: Record<string, unknown>;
			}>
	  >;

const flushers = new Set<RecoveryCapsuleFlusher>();

export function registerRecoveryCapsuleFlusher(
	flusher: RecoveryCapsuleFlusher
): () => void {
	flushers.add(flusher);
	return () => {
		flushers.delete(flusher);
	};
}

function readIntendedRoute(): string {
	if (typeof sessionStorage === 'undefined') return 'desktop';
	try {
		return sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY) || 'desktop';
	} catch {
		return 'desktop';
	}
}

export async function buildRecoveryCapsulePayload(): Promise<WebSsoRecoveryCapsulePayload> {
	const drafts: Record<string, unknown> = {};
	let intended = readIntendedRoute();
	let shell: Record<string, unknown> | undefined;
	for (const flusher of [...flushers]) {
		try {
			const part = await flusher();
			if (part.intended_route) intended = part.intended_route;
			if (part.drafts) Object.assign(drafts, part.drafts);
			if (part.shell) shell = { ...(shell ?? {}), ...part.shell };
		} catch (error) {
			log.warn(LOG, 'flusher failed', error);
		}
	}
	return {
		schema_version: 1,
		intended_route: intended,
		drafts,
		...(shell ? { shell } : {}),
		preserved_at: new Date().toISOString(),
	};
}

function apiBase(): string {
	if (typeof window === 'undefined') return '';
	return '';
}

async function putCapsule(
	terminalReason: string,
	payload: WebSsoRecoveryCapsulePayload
): Promise<{ ok: true; expiresAt?: string } | { ok: false; reason: string }> {
	const token = getToken();
	if (!token) {
		return { ok: false, reason: 'no_access_token' };
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FLUSH_DEADLINE_MS);
	try {
		const response = await fetch(`${apiBase()}${API_PATH}`, {
			method: 'PUT',
			credentials: 'include',
			signal: controller.signal,
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				terminal_reason: terminalReason,
				payload,
			}),
		});
		if (!response.ok) {
			return { ok: false, reason: `http_${response.status}` };
		}
		const body = (await response.json()) as { expires_at?: string };
		return { ok: true, expiresAt: body.expires_at };
	} catch (error) {
		const reason =
			error instanceof DOMException && error.name === 'AbortError'
				? 'deadline'
				: 'network';
		return { ok: false, reason };
	} finally {
		clearTimeout(timer);
	}
}

export async function flushWebSsoRecoveryCapsule(
	terminalReason: string
): Promise<{ preserved: boolean; reason?: string; expiresAt?: string }> {
	const payload = await buildRecoveryCapsulePayload();
	const result = await putCapsule(terminalReason, payload);
	if (result.ok) {
		log.info(LOG, `capsule flushed reason=${terminalReason}`);
		return { preserved: true, expiresAt: result.expiresAt };
	}
	log.warn(LOG, `capsule flush skipped (${result.reason})`);
	return { preserved: false, reason: result.reason };
}

export async function consumeWebSsoRecoveryCapsule(): Promise<{
	found: boolean;
	payload?: WebSsoRecoveryCapsulePayload;
	terminalReason?: string;
}> {
	const token = getToken();
	if (!token) return { found: false };
	try {
		const response = await fetch(`${apiBase()}${API_PATH}`, {
			method: 'GET',
			credentials: 'include',
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${token}`,
			},
		});
		if (!response.ok) return { found: false };
		const body = (await response.json()) as {
			found?: boolean;
			payload?: WebSsoRecoveryCapsulePayload;
			terminal_reason?: string;
		};
		if (!body.found || !body.payload) return { found: false };
		return {
			found: true,
			payload: body.payload,
			terminalReason: body.terminal_reason,
		};
	} catch {
		return { found: false };
	}
}

export type RecoveryCapsuleRestorer = (
	payload: WebSsoRecoveryCapsulePayload
) => void | Promise<void>;

const restorers = new Set<RecoveryCapsuleRestorer>();

export function registerRecoveryCapsuleRestorer(
	restorer: RecoveryCapsuleRestorer
): () => void {
	restorers.add(restorer);
	return () => {
		restorers.delete(restorer);
	};
}

export async function applyConsumedRecoveryCapsule(
	payload: WebSsoRecoveryCapsulePayload
): Promise<void> {
	if (payload.intended_route && typeof sessionStorage !== 'undefined') {
		try {
			sessionStorage.setItem(INTENDED_PAGE_SESSION_KEY, payload.intended_route);
		} catch {
			/* ignore */
		}
	}
	for (const restorer of [...restorers]) {
		try {
			await restorer(payload);
		} catch (error) {
			log.warn(LOG, 'restorer failed', error);
		}
	}
}
