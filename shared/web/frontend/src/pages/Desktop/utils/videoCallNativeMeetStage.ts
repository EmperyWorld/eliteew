/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Meet stage adapters. Tauri and EmpiierOS open a sibling WebView clipped to
 * the VideoCall stage. The browser keeps the in-page iframe. EmpiierOS must
 * not mount that iframe: nested Meet SIGSEGV takes the product WebProcess.
 *
 * Invariants:
 * - Tauri stage requires `hasTauriInvoke()`, not merely `foflineNative`.
 * - EmpiierOS `openMeetStage` always receives CSS-pixel bounds. URL-only is
 *   `meet_stage_bounds_required` and is not sent to the host.
 * - `join_url` is passed through on open. Close and bounds send no URL and no JWT.
 * - Never rewrite `meet.eliteew.ru` to `app.eliteew.ru`.
 * - Do not request fullscreen for Meet.
 * - OS Meet death is `empiieros-meet-stage-lost`. The pack must `/end`.
 *
 * Related:
 * - services/desktopClient/eliteewProductHost.ts
 * - documentation/product/INTERNAL-VIDEO-CALLS.md
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
 */
import { hasTauriInvoke } from '@/services/desktopClient/eliteewProductHost';
import { getOidcRuntimeProfile } from '@/services/keycloakProfile';

export type MeetStageBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type TauriInternals = {
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

type MeetStageResult = {
	ok?: boolean;
	code?: string;
	message?: string;
};

/**
 * EmpiierOS sibling Meet WebView. Not an in-page iframe and not a FILL overlay.
 * `openMeetStage` requires bounds. Width/height under 48 is still sent; the OS hides.
 */
export type EmpiierosMeetStageHost = {
	openMeetStage?: (
		joinUrl: string,
		bounds: MeetStageBounds
	) => Promise<unknown> | unknown;
	setMeetStageBounds?: (bounds: MeetStageBounds) => Promise<unknown> | unknown;
	closeMeetStage?: () => Promise<unknown> | unknown;
};

function tauriInternals(): TauriInternals | null {
	if (!hasTauriInvoke() || typeof window === 'undefined') return null;
	const w = window as Window & { __TAURI_INTERNALS__?: TauriInternals };
	return w.__TAURI_INTERNALS__ ?? null;
}

/** True when SPA can open the Tauri top-level Meet WebviewWindow. */
export function isEliteewNativeDesktopProductShell(): boolean {
	const profile = getOidcRuntimeProfile();
	if (profile !== 'desktopNative' && profile !== 'foflineNative') {
		return false;
	}
	return hasTauriInvoke();
}

export function meetStageBoundsFromElement(
	el: Element | null
): MeetStageBounds | null {
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	if (
		!Number.isFinite(rect.x) ||
		!Number.isFinite(rect.y) ||
		!Number.isFinite(rect.width) ||
		!Number.isFinite(rect.height)
	) {
		return null;
	}
	return {
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height,
	};
}

function asResult(raw: unknown): MeetStageResult {
	if (!raw || typeof raw !== 'object')
		return { ok: false, code: 'invalid_result' };
	return raw as MeetStageResult;
}

export async function openNativeMeetStage(
	joinUrl: string,
	bounds: MeetStageBounds
): Promise<MeetStageResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) {
		return { ok: false, code: 'tauri_unavailable' };
	}
	try {
		return asResult(
			await internals.invoke('video_call_meet_stage_open', {
				joinUrl,
				bounds,
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function setNativeMeetStageBounds(
	bounds: MeetStageBounds
): Promise<MeetStageResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) {
		return { ok: false, code: 'tauri_unavailable' };
	}
	try {
		return asResult(
			await internals.invoke('video_call_meet_stage_set_bounds', { bounds })
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function closeNativeMeetStage(): Promise<MeetStageResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) {
		return { ok: false, code: 'tauri_unavailable' };
	}
	try {
		return asResult(await internals.invoke('video_call_meet_stage_close'));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

function readEmpiierosMeetStageHost(): EmpiierosMeetStageHost | null {
	if (typeof window === 'undefined') return null;
	const host = (
		window as Window & { EmperyDesktopMeetStage?: EmpiierosMeetStageHost }
	).EmperyDesktopMeetStage;
	return host ?? null;
}

function isFiniteMeetStageBounds(
	bounds: MeetStageBounds | null | undefined
): bounds is MeetStageBounds {
	if (!bounds) return false;
	return (
		Number.isFinite(bounds.x) &&
		Number.isFinite(bounds.y) &&
		Number.isFinite(bounds.width) &&
		Number.isFinite(bounds.height)
	);
}

/**
 * Open the clipped sibling. A missing bounds object is not sent to the OS.
 * `joinUrl` is not rewritten.
 */
export async function openEmpiierosMeetStage(
	joinUrl: string,
	bounds?: MeetStageBounds | null
): Promise<MeetStageResult> {
	if (!isFiniteMeetStageBounds(bounds)) {
		return { ok: false, code: 'meet_stage_bounds_required' };
	}
	const host = readEmpiierosMeetStageHost();
	if (!host?.openMeetStage) {
		return { ok: false, code: 'meet_stage_unavailable' };
	}
	try {
		const raw = await host.openMeetStage(joinUrl, bounds);
		if (raw && typeof raw === 'object' && 'ok' in raw) {
			return asResult(raw);
		}
		return { ok: true };
	} catch {
		return { ok: false, code: 'meet_stage_failed' };
	}
}

/** Re-clip the sibling to the VideoCall stage. No URL and no JWT. */
export async function setEmpiierosMeetStageBounds(
	bounds: MeetStageBounds | null
): Promise<MeetStageResult> {
	if (!isFiniteMeetStageBounds(bounds)) {
		return { ok: false, code: 'meet_stage_bounds_invalid' };
	}
	const host = readEmpiierosMeetStageHost();
	if (!host?.setMeetStageBounds) {
		return { ok: false, code: 'meet_stage_unavailable' };
	}
	try {
		const raw = await host.setMeetStageBounds(bounds);
		if (raw && typeof raw === 'object' && 'ok' in raw) {
			return asResult(raw);
		}
		return { ok: true };
	} catch {
		return { ok: false, code: 'meet_stage_failed' };
	}
}

/** Product WebView event when the sibling Meet WebProcess dies. */
export const EMPIIEROS_MEET_STAGE_LOST_EVENT = 'empiieros-meet-stage-lost';

export type MeetStageLostDetail = {
	code?: string;
};

/** Machine code from the OS event, or null if the event is not a lost signal. */
export function meetStageLostCode(event: Event): string | null {
	const detail = (event as CustomEvent<MeetStageLostDetail>).detail;
	const code = detail?.code?.trim();
	return code ? code : null;
}

/**
 * Hide the OS Meet surface. No `join_url` and no JWT are sent to the host.
 * Missing hook is `meet_stage_unavailable`, not a silent success.
 */
export async function closeEmpiierosMeetStage(): Promise<MeetStageResult> {
	const host = readEmpiierosMeetStageHost();
	if (!host?.closeMeetStage) {
		return { ok: false, code: 'meet_stage_unavailable' };
	}
	try {
		const raw = await host.closeMeetStage();
		if (raw && typeof raw === 'object' && 'ok' in raw) {
			return asResult(raw);
		}
		return { ok: true };
	} catch {
		return { ok: false, code: 'meet_stage_failed' };
	}
}
