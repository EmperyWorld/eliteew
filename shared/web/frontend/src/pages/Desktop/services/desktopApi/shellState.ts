/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell state GET/PATCH, in-memory dedupe cache, keepalive unload PATCH, and logout teardown.
 *
 * Invariants:
 * - **`seedDesktopShellStateFromBootstrap`** — cold path from shell-bootstrap (etag + field etags).
 * - **`getDesktopShellState`** / **`patchDesktopShellState`** — single HTTP round-trip each; etag/retry/reload belongs in mutation pipeline.
 * - **`patchDesktopShellStateMerged`** updates module shell-state cache; leader success broadcasts `shell-state-invalidated`.
 * - **`patchDesktopShellStateKeepalive`** — best-effort PATCH on `pagehide` (fetch keepalive + `If-Match`); leader tab only.
 * - **`clearDesktopShellStateCache`** clears shell journal, workspace local cache, widget outbox, music IDB blobs (logout).
 *
 * Related:
 * - `hooks/useDesktopShellWindowPersistence.ts`
 * - `utils/desktopShellStateMutationPipeline.ts`
 */

import { authSession } from '@/services/authSession';
import { resolveAbsoluteApiBaseURL } from '@/services/api/config';
import { getBrowserTabLeaderRole } from '@/utils/browserTabLeaderState';
import { APIError, apiClient } from '../../../../services/api/client';
import { readAxiosResponseEtag } from '../../../../services/api/conditionalJsonGet';
import { logCacheInvalidation } from '../../../../services/api/cacheInvalidationLogger';
import { clearDesktopPersistPatchQueue } from '../../utils/desktopPersistPatchQueue';
import { clearDesktopWidgetOutbox } from '../../utils/desktopWidgetOutboxQueue';
import { clearShellCommandJournal } from '../../utils/desktopShellCommandJournal';
import { clearDesktopWorkspaceLocalCache } from '../../utils/desktopWorkspaceLocalCache';
import { resetCoalescedDesktopShellStateWriter } from '../../utils/desktopShellStateWriteCoordinator';
import { resetGafChatSoundShellCache } from '../../utils/gafChatShellSound';
import { clearCachedAudioBlobs } from '../../utils/musicAudioBlobCache';
import {
	getDesktopConditionalCacheEtag,
	invalidateDesktopConditionalCache,
	updateDesktopConditionalCache,
} from '../desktopConditionalGet';
import {
	API_PATH,
	DESKTOP_API_OPTIONS,
	DESKTOP_API_V1_BASE,
	DESKTOP_REALTIME_BC,
	SHELL_STATE_CONFLICT_MESSAGE,
	SHELL_STATE_FIELD_ETAGS_HEADER,
	SHELL_STATE_IF_MATCH_FIELDS_HEADER,
} from './constants';
import { DesktopShellStateConflictError } from './conflict';
import type {
	DesktopShellState,
	DesktopShellStateHttpResult,
	DesktopShellStatePatch,
	PatchDesktopShellStateOptions,
} from './types';

/** Follower tabs invalidate RAM shell_state on this message after leader PATCH success. */
export const SHELL_STATE_INVALIDATED_BC = 'shell-state-invalidated';

function extractShellStateConflictDetail(
	error: APIError
): Record<string, unknown> | null {
	const body =
		error.details && typeof error.details === 'object'
			? (error.details as Record<string, unknown>)
			: null;
	const detail =
		body?.detail && typeof body.detail === 'object'
			? (body.detail as Record<string, unknown>)
			: body;
	return detail && typeof detail === 'object' ? detail : null;
}

function raiseDesktopShellStateConflictError(error: APIError): never {
	const detail = extractShellStateConflictDetail(error);
	const currentEtag =
		typeof detail?.current_etag === 'string' ? detail.current_etag : null;
	logCacheInvalidation('shell_state 412 conflict', {
		currentEtag,
		code:
			typeof detail?.code === 'string'
				? detail.code
				: 'desktop_shell_state_conflict',
	});
	throw new DesktopShellStateConflictError(
		typeof detail?.message === 'string'
			? detail.message
			: SHELL_STATE_CONFLICT_MESSAGE,
		currentEtag,
		detail
	);
}

function readShellStateFieldEtags(
	headers: Record<string, unknown> | undefined
): Record<string, string> | null {
	const raw =
		headers?.[SHELL_STATE_FIELD_ETAGS_HEADER] ??
		headers?.['X-Shell-State-Field-ETags'];
	if (typeof raw !== 'string' || !raw.trim()) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return null;
		}
		const out: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === 'string' && key.trim()) {
				out[key] = value;
			}
		}
		return Object.keys(out).length > 0 ? out : null;
	} catch {
		return null;
	}
}

let shellStateCache: DesktopShellState | null = null;
let shellStateInflight: Promise<DesktopShellState> | null = null;
let shellStateFieldEtags: Record<string, string> | null = null;

function buildShellStateIfMatchFieldsHeader(
	patch: DesktopShellStatePatch
): string | null {
	if (!shellStateFieldEtags) return null;
	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(patch)) {
		if (value == null) continue;
		const fieldEtag = shellStateFieldEtags[key];
		if (fieldEtag) {
			fields[key] = fieldEtag;
		}
	}
	return Object.keys(fields).length > 0 ? JSON.stringify(fields) : null;
}

function notifyFollowersShellStateInvalidated(): void {
	if (typeof BroadcastChannel === 'undefined') {
		return;
	}
	try {
		const ch = new BroadcastChannel(DESKTOP_REALTIME_BC);
		ch.postMessage({ type: SHELL_STATE_INVALIDATED_BC });
		ch.close();
	} catch {
		/* private mode / quota */
	}
}

/** Single GET — returns body + ETag; no retry or module cache updates. */
export async function getDesktopShellState(): Promise<DesktopShellStateHttpResult> {
	const response = await apiClient.get<DesktopShellState>(
		`${API_PATH}/shell-state`,
		DESKTOP_API_OPTIONS
	);
	return {
		state: response.data,
		etag: readAxiosResponseEtag(response.headers),
		fieldEtags: readShellStateFieldEtags(response.headers),
	};
}

/** Apply server `current_etag` from a 412 before reload/retry (best-effort). */
export function applyDesktopShellStateConflictEtag(
	error: DesktopShellStateConflictError
): void {
	const etag = error.currentEtag?.trim();
	if (!etag) return;
	const detailFieldEtags = readShellStateFieldEtags({
		[SHELL_STATE_FIELD_ETAGS_HEADER]: JSON.stringify(
			error.serverDetail?.current_field_etags ?? null
		),
	});
	if (detailFieldEtags) {
		shellStateFieldEtags = detailFieldEtags;
	}
	const cached = shellStateCache ?? ({} as DesktopShellState);
	updateDesktopConditionalCache('shell-state', cached, etag);
}

/** Drop follower RAM shell_state without logout teardown (leader PATCH cross-tab sync). */
export function invalidateDesktopShellStateRamCache(): void {
	logCacheInvalidation('invalidateDesktopShellStateRamCache');
	shellStateCache = null;
	shellStateInflight = null;
	shellStateFieldEtags = null;
	invalidateDesktopConditionalCache('shell-state');
}

/** Drop in-memory shell-state cache and refetch GET (fresh ETag for conflict recovery). */
export async function reloadDesktopShellStateForce(): Promise<DesktopShellState> {
	shellStateCache = null;
	shellStateInflight = null;
	invalidateDesktopConditionalCache('shell-state');
	const { state, etag, fieldEtags } = await getDesktopShellState();
	updateDesktopConditionalCache('shell-state', state, etag);
	shellStateCache = state;
	shellStateFieldEtags = fieldEtags;
	return state;
}

/** Single PATCH with optional `If-Match`; on **412** throws {@link DesktopShellStateConflictError} (no retry). */
export async function patchDesktopShellState(
	patch: DesktopShellStatePatch,
	options?: PatchDesktopShellStateOptions
): Promise<DesktopShellStateHttpResult> {
	const ifMatch = options?.ifMatch;
	const idempotencyKey = options?.idempotencyKey?.trim() || null;
	try {
		const ifMatchFields = buildShellStateIfMatchFieldsHeader(patch);
		const response = await apiClient.patch<DesktopShellState>(
			`${API_PATH}/shell-state`,
			patch,
			{
				...DESKTOP_API_OPTIONS,
				headers: {
					...(ifMatch ? { 'If-Match': ifMatch } : {}),
					...(ifMatchFields
						? { [SHELL_STATE_IF_MATCH_FIELDS_HEADER]: ifMatchFields }
						: {}),
					...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
				},
			}
		);
		return {
			state: response.data,
			etag: readAxiosResponseEtag(response.headers),
			fieldEtags: readShellStateFieldEtags(response.headers),
		};
	} catch (error) {
		if (error instanceof APIError && error.statusCode === 412) {
			raiseDesktopShellStateConflictError(error);
		}
		throw error;
	}
}

/** Read-through of the last shell-state from GET or merged PATCH (no network). For merge-only PATCH builders. */
export function peekDesktopShellStateCache(): DesktopShellState | null {
	return shellStateCache;
}

/**
 * Seed RAM shell-state (+ conditional ETag) from GET /desktop/shell-bootstrap.
 * Callers of fetchDesktopShellStateDeduplicated skip the dedicated GET when warm.
 */
export function seedDesktopShellStateFromBootstrap(
	state: DesktopShellState,
	etag: string | null,
	fieldEtags: Record<string, string> | null
): void {
	shellStateCache = state;
	shellStateFieldEtags = fieldEtags;
	updateDesktopConditionalCache('shell-state', state, etag);
}

/** One in-flight GET per page load; invalidated on merged PATCH response. */
export async function fetchDesktopShellStateDeduplicated(options?: {
	force?: boolean;
}): Promise<DesktopShellState> {
	if (options?.force) {
		return reloadDesktopShellStateForce();
	}
	if (shellStateCache) {
		return shellStateCache;
	}
	if (!shellStateInflight) {
		shellStateInflight = getDesktopShellState()
			.then(({ state, etag, fieldEtags }) => {
				updateDesktopConditionalCache('shell-state', state, etag);
				shellStateFieldEtags = fieldEtags;
				shellStateCache = state;
				return state;
			})
			.finally(() => {
				shellStateInflight = null;
			});
	}
	return shellStateInflight;
}

export async function patchDesktopShellStateMerged(
	patch: DesktopShellStatePatch,
	options?: { idempotencyKey?: string | null }
): Promise<DesktopShellState> {
	if (!getDesktopConditionalCacheEtag('shell-state')) {
		await fetchDesktopShellStateDeduplicated();
	}
	const ifMatch = getDesktopConditionalCacheEtag('shell-state');
	const { state, etag, fieldEtags } = await patchDesktopShellState(patch, {
		ifMatch,
		idempotencyKey: options?.idempotencyKey,
	});
	updateDesktopConditionalCache('shell-state', state, etag);
	shellStateFieldEtags = fieldEtags;
	shellStateCache = state;
	if (getBrowserTabLeaderRole() === 'leader') {
		notifyFollowersShellStateInvalidated();
	}
	return state;
}

/**
 * Best-effort shell_state PATCH during tab unload (`pagehide` / `beforeunload`).
 * Uses fetch `keepalive` — intentional exception to axios client (same as icon PUT flush).
 */
export function patchDesktopShellStateKeepalive(
	patch: DesktopShellStatePatch
): void {
	if (typeof window === 'undefined') return;
	if (getBrowserTabLeaderRole() !== 'leader') return;
	const token = authSession.token;
	if (!token) return;
	if (Object.keys(patch).length === 0) return;

	const ifMatch = getDesktopConditionalCacheEtag('shell-state');
	const url = `${resolveAbsoluteApiBaseURL(DESKTOP_API_V1_BASE)}${API_PATH}/shell-state`;
	void fetch(url, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...(ifMatch ? { 'If-Match': ifMatch } : {}),
		},
		body: JSON.stringify(patch),
		keepalive: true,
	}).catch(() => {
		/* ignore — unload path */
	});
	// keepalive response is not readable; drop stale etag/body before the next PATCH.
	shellStateCache = null;
	shellStateFieldEtags = null;
	invalidateDesktopConditionalCache('shell-state');
}

/** Call on logout / user switch so the next session refetches. */
export function clearDesktopShellStateCache(): void {
	logCacheInvalidation('clearDesktopShellStateCache');
	clearDesktopPersistPatchQueue();
	clearDesktopWidgetOutbox();
	void clearShellCommandJournal();
	clearDesktopWorkspaceLocalCache();
	resetCoalescedDesktopShellStateWriter();
	shellStateCache = null;
	shellStateInflight = null;
	shellStateFieldEtags = null;
	invalidateDesktopConditionalCache('all');
	resetGafChatSoundShellCache();
	void clearCachedAudioBlobs();
}
