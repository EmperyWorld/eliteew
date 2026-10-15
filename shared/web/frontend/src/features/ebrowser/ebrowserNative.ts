/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tauri product WebView bridge for EBrowser stage (parent/bounds) + media toggles.
 *
 * Invariants:
 * - Only desktopNative / foflineNative with `__TAURI_INTERNALS__.invoke`.
 * - Rust fetches nav policy from API (SPA bearer is credential only; never SoT).
 * - Force refresh on timer pushes SoT to Rust (admin tighten).
 * - Bounds are CSS pixels from getBoundingClientRect (product viewport).
 * - Chrome sync prefers `ebrowser-chrome` events + batched snapshot; poll is fallback.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 * - pack-organization/connection-agent ebrowser_stage.rs
 * - pages/Desktop/utils/videoCallNativeMeetStage.ts (Meet pattern)
 */

import { getToken } from '@/services/keycloakAuthOidcFacade';
import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import type { EBrowserPolicyApi } from './ebrowserOpenApi';
import type { EBrowserNavPolicy } from './navPolicy';

export type { EBrowserPolicyApi } from './ebrowserOpenApi';

export const EBROWSER_CHROME_EVENT = 'ebrowser-chrome';

type TauriInternals = {
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
	transformCallback?: (
		callback: (event: unknown) => void,
		once?: boolean
	) => number;
};

type EBrowserResult = {
	ok?: boolean;
	code?: string;
	message?: string;
};

export type EBrowserStageBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type EBrowserMediaToggles = {
	camera: boolean;
	microphone: boolean;
	audio_out: boolean;
};

function tauriInternals(): TauriInternals | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window & { __TAURI_INTERNALS__?: TauriInternals };
	return w.__TAURI_INTERNALS__ ?? null;
}

export function isEliteewNativeDesktopProductShell(): boolean {
	const profile = getOidcRuntimeProfile();
	if (profile !== 'desktopNative' && profile !== 'foflineNative') {
		return false;
	}
	return Boolean(tauriInternals()?.invoke);
}

export function ebrowserStageBoundsFromElement(
	el: Element | null
): EBrowserStageBounds | null {
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

function asResult(raw: unknown): EBrowserResult {
	if (!raw || typeof raw !== 'object')
		return { ok: false, code: 'invalid_result' };
	return raw as EBrowserResult;
}

/**
 * Map API policy to a nav snapshot.
 * `fetchedAtMs` is **client receive time** (`Date.now()`), not `Date.parse(api.fetched_at)`.
 * Comparing server UTC stamps to a skewed seat clock falsely expires a fresh policy.
 * Server `fetched_at` / `expires_at` remain audit metadata on the wire.
 */
export function policyApiToSnapshot(
	api: EBrowserPolicyApi,
	receivedAtMs: number = Date.now()
): EBrowserNavPolicy & { fetchedAtMs: number } {
	return {
		mode: api.mode,
		allow: api.allow ?? [],
		deny: api.deny ?? [],
		fetchedAtMs: receivedAtMs,
		ttlSeconds: api.ttl_seconds,
	};
}

function rustAccessTokenArg(): string | null {
	const token = (getToken() ?? '').trim();
	return token.length > 0 ? token : null;
}

export async function openNativeEBrowser(
	url: string,
	bounds: EBrowserStageBounds
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_open', {
				navHref: url,
				bounds,
				accessToken: rustAccessTokenArg(),
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function navigateNativeEBrowser(
	url: string
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_navigate', {
				navHref: url,
				accessToken: rustAccessTokenArg(),
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

/** Force Rust to re-GET policy (admin tighten / 60s timer). */
export async function refreshNativeEBrowserPolicy(): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_refresh_policy', {
				accessToken: rustAccessTokenArg(),
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export type EBrowserLocation = {
	ok: boolean;
	url: string;
	pageTitle: string;
	canGoBack: boolean;
	canGoForward: boolean;
};

export async function getNativeEBrowserLocation(): Promise<EBrowserLocation | null> {
	const internals = tauriInternals();
	if (!internals?.invoke) return null;
	try {
		const raw = await internals.invoke('ebrowser_get_location');
		return parseLocationFromRaw(raw);
	} catch {
		return null;
	}
}

export async function nativeEBrowserReload(): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(await internals.invoke('ebrowser_reload'));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function nativeEBrowserHistoryBack(): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(await internals.invoke('ebrowser_history_back'));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function nativeEBrowserHistoryForward(): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(await internals.invoke('ebrowser_history_forward'));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function setNativeEBrowserBounds(
	bounds: EBrowserStageBounds
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(await internals.invoke('ebrowser_set_bounds', { bounds }));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function closeNativeEBrowser(): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(await internals.invoke('ebrowser_close'));
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function setNativeEBrowserMediaToggles(
	toggles: EBrowserMediaToggles
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_set_media_toggles', { toggles })
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function getNativeEBrowserMediaToggles(): Promise<EBrowserMediaToggles | null> {
	const internals = tauriInternals();
	if (!internals?.invoke) return null;
	try {
		const raw = await internals.invoke('ebrowser_get_media_toggles');
		if (!raw || typeof raw !== 'object') return null;
		const o = raw as Record<string, unknown>;
		return {
			camera: Boolean(o.camera),
			microphone: Boolean(o.microphone),
			audio_out: o.audio_out !== false,
		};
	} catch {
		return null;
	}
}

export type EBrowserDownloadItem = {
	id: number;
	name: string;
	phase: string;
	progress: number;
	bytesReceived: number;
	contentId?: string;
};

function parseDownloadItems(rawItems: unknown): EBrowserDownloadItem[] {
	const items = Array.isArray(rawItems) ? rawItems : [];
	return items
		.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
		.map((x) => ({
			id: typeof x.id === 'number' ? x.id : Number(x.id) || 0,
			name: typeof x.name === 'string' ? x.name : 'download',
			phase: typeof x.phase === 'string' ? x.phase : 'unknown',
			progress: typeof x.progress === 'number' ? x.progress : 0,
			bytesReceived:
				typeof x.bytes_received === 'number' ? x.bytes_received : 0,
			contentId:
				typeof x.content_id === 'string' && x.content_id.trim()
					? x.content_id.trim()
					: undefined,
		}));
}

export type EBrowserTabView = {
	id: number;
	active: boolean;
	href: string;
};

function parseTabViews(rawTabs: unknown): EBrowserTabView[] {
	const tabsRaw = Array.isArray(rawTabs) ? rawTabs : [];
	return tabsRaw
		.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
		.map((x) => ({
			id: typeof x.id === 'number' ? x.id : Number(x.id) || 0,
			active: Boolean(x.active),
			href: typeof x.href === 'string' ? x.href : '',
		}));
}

function parseLocationFromRaw(raw: unknown): EBrowserLocation | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	return {
		ok: Boolean(o.ok),
		url: typeof o.href === 'string' ? o.href : '',
		pageTitle: typeof o.page_title === 'string' ? o.page_title : '',
		canGoBack: Boolean(o.can_go_back),
		canGoForward: Boolean(o.can_go_forward),
	};
}

export type EBrowserChromeSnapshot = {
	ok: boolean;
	location: EBrowserLocation | null;
	tabs: EBrowserTabView[];
	maxTabs: number;
	downloads: EBrowserDownloadItem[];
};

export function parseEBrowserChromeSnapshot(
	raw: unknown
): EBrowserChromeSnapshot | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	return {
		ok: o.ok !== false,
		location: parseLocationFromRaw(o.location),
		tabs: parseTabViews(o.tabs),
		maxTabs: typeof o.max_tabs === 'number' && o.max_tabs > 0 ? o.max_tabs : 3,
		downloads: parseDownloadItems(o.downloads),
	};
}

export async function getNativeEBrowserChromeSnapshot(): Promise<EBrowserChromeSnapshot | null> {
	const internals = tauriInternals();
	if (!internals?.invoke) return null;
	try {
		const raw = await internals.invoke('ebrowser_get_chrome_snapshot');
		return parseEBrowserChromeSnapshot(raw);
	} catch {
		return null;
	}
}

type TauriEventEnvelope = {
	payload?: unknown;
};

/**
 * Listen for Rust `ebrowser-chrome` without `@tauri-apps/api`
 * (product SPA uses `__TAURI_INTERNALS__` only).
 */
export async function listenNativeEBrowserChrome(
	handler: (snap: EBrowserChromeSnapshot) => void
): Promise<() => void> {
	const internals = tauriInternals();
	if (!internals?.invoke || typeof internals.transformCallback !== 'function') {
		return () => undefined;
	}
	const transformCallback = internals.transformCallback;
	try {
		const eventId = (await internals.invoke('plugin:event|listen', {
			event: EBROWSER_CHROME_EVENT,
			target: { kind: 'Any' },
			handler: transformCallback((event: unknown) => {
				const payload =
					event && typeof event === 'object'
						? (event as TauriEventEnvelope).payload
						: undefined;
				const snap = parseEBrowserChromeSnapshot(payload);
				if (snap) handler(snap);
			}),
		})) as number;
		return () => {
			const w = window as Window & {
				__TAURI_EVENT_PLUGIN_INTERNALS__?: {
					unregisterListener?: (event: string, id: number) => void;
				};
			};
			try {
				w.__TAURI_EVENT_PLUGIN_INTERNALS__?.unregisterListener?.(
					EBROWSER_CHROME_EVENT,
					eventId
				);
			} catch {
				/* ignore */
			}
			void internals.invoke('plugin:event|unlisten', {
				event: EBROWSER_CHROME_EVENT,
				eventId,
			});
		};
	} catch {
		return () => undefined;
	}
}

export async function getNativeEBrowserDownloads(): Promise<
	EBrowserDownloadItem[]
> {
	const internals = tauriInternals();
	if (!internals?.invoke) return [];
	try {
		const raw = await internals.invoke('ebrowser_get_downloads');
		if (!raw || typeof raw !== 'object') return [];
		const o = raw as Record<string, unknown>;
		return parseDownloadItems(o.items);
	} catch {
		return [];
	}
}

export function ebrowserDownloadStatusCopy(item: EBrowserDownloadItem): string {
	switch (item.phase) {
		case 'progress':
		case 'started':
			return `Загрузка ${item.name}…`;
		case 'ingesting':
			return `Сохраняем в «Загрузки»: ${item.name}…`;
		case 'library':
			return `В «Загрузках» аккаунта: ${item.name}`;
		case 'done':
			return `Сохранено: ${item.name}`;
		case 'library_auth_failed':
			return `Не удалось сохранить в «Загрузки» (нет сессии): ${item.name}`;
		case 'library_failed':
			return `Не удалось сохранить в «Загрузки»: ${item.name}`;
		case 'denied':
			return `Загрузка запрещена политикой: ${item.name}`;
		case 'busy':
			return 'Слишком много загрузок одновременно';
		case 'too_large':
			return `Файл слишком большой: ${item.name}`;
		case 'failed':
			return `Не удалось загрузить: ${item.name}`;
		case 'cancelled':
			return `Загрузка отменена: ${item.name}`;
		default:
			return `${item.name}: ${item.phase}`;
	}
}

export async function listNativeEBrowserTabs(): Promise<{
	tabs: EBrowserTabView[];
	maxTabs: number;
}> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { tabs: [], maxTabs: 3 };
	try {
		const raw = await internals.invoke('ebrowser_tabs_list');
		if (!raw || typeof raw !== 'object') return { tabs: [], maxTabs: 3 };
		const o = raw as Record<string, unknown>;
		const tabs = parseTabViews(o.tabs);
		const maxTabs =
			typeof o.max_tabs === 'number' && o.max_tabs > 0 ? o.max_tabs : 3;
		return { tabs, maxTabs };
	} catch {
		return { tabs: [], maxTabs: 3 };
	}
}

export async function createNativeEBrowserTab(
	bounds: EBrowserStageBounds,
	navHref = 'about:blank'
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_tab_create', {
				arg: {
					nav_href: navHref,
					bounds,
					access_token: rustAccessTokenArg(),
				},
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function activateNativeEBrowserTab(
	tabId: number
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_tab_activate', {
				arg: { tab_id: tabId },
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function closeNativeEBrowserTab(
	tabId: number
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_tab_close', {
				arg: { tab_id: tabId },
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export type EBrowserFindAction = 'start' | 'next' | 'previous' | 'finish';

export async function nativeEBrowserFind(
	action: EBrowserFindAction,
	query?: string
): Promise<EBrowserResult> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, code: 'not_native' };
	try {
		return asResult(
			await internals.invoke('ebrowser_find', {
				arg: {
					action,
					query: query ?? '',
					case_insensitive: true,
				},
			})
		);
	} catch {
		return { ok: false, code: 'invoke_failed' };
	}
}

export async function nativeEBrowserSetZoom(
	level: number
): Promise<{ ok: boolean; level: number; code?: string }> {
	const internals = tauriInternals();
	if (!internals?.invoke) return { ok: false, level: 1, code: 'not_native' };
	try {
		const raw = await internals.invoke('ebrowser_set_zoom', {
			arg: { level },
		});
		if (!raw || typeof raw !== 'object') {
			return { ok: false, level: 1, code: 'invalid_result' };
		}
		const o = raw as Record<string, unknown>;
		return {
			ok: Boolean(o.ok),
			level: typeof o.level === 'number' ? o.level : 1,
			code: typeof o.code === 'string' ? o.code : undefined,
		};
	} catch {
		return { ok: false, level: 1, code: 'invoke_failed' };
	}
}

export async function nativeEBrowserGetZoom(): Promise<number> {
	const internals = tauriInternals();
	if (!internals?.invoke) return 1;
	try {
		const raw = await internals.invoke('ebrowser_get_zoom');
		if (!raw || typeof raw !== 'object') return 1;
		const o = raw as Record<string, unknown>;
		return typeof o.level === 'number' && Number.isFinite(o.level)
			? o.level
			: 1;
	} catch {
		return 1;
	}
}
