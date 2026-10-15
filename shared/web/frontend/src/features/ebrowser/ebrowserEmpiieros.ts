/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS Seat Browser launcher. Opens the OS overlay through
 * `window.EmperyDesktopSeatBrowser`. Does not paint a page inside FoFline.
 *
 * Invariants:
 * - No Tauri `ebrowser_*` and no access, refresh, or cookie fields.
 * - `url` is sent only for `https:`. `http`, `file`, `fofline-spa`, and `blob`
 *   are a pack error and are not passed to the host.
 * - Missing host is `seat_browser_unavailable`, not an iframe and not Tauri.
 * - Bounds are optional CSS pixels. A host that ignores them is still success.
 *
 * Related:
 * - services/desktopClient/eliteewProductHost.ts
 * - pages/Desktop/utils/videoCallNativeMeetStage.ts
 * - features/ebrowser/ebrowserNative.ts
 */

export type SeatBrowserBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type SeatBrowserResult = {
	ok?: boolean;
	code?: string;
};

export type EmpiierosSeatBrowserHost = {
	openSeatBrowser?: (args: {
		url?: string;
		bounds?: SeatBrowserBounds;
	}) => Promise<SeatBrowserResult> | SeatBrowserResult;
	closeSeatBrowser?: () => Promise<SeatBrowserResult> | SeatBrowserResult;
};

const SEAT_BROWSER_UNAVAILABLE = 'seat_browser_unavailable';
const SEAT_BROWSER_SCHEME = 'seat_browser_scheme';

function readHost(): EmpiierosSeatBrowserHost | null {
	if (typeof window === 'undefined') return null;
	const host = (
		window as Window & { EmperyDesktopSeatBrowser?: EmpiierosSeatBrowserHost }
	).EmperyDesktopSeatBrowser;
	return host ?? null;
}

function asResult(raw: unknown): SeatBrowserResult {
	if (!raw || typeof raw !== 'object') return { ok: true };
	const o = raw as SeatBrowserResult;
	return { ok: o.ok !== false, code: o.code };
}

/**
 * Empty / `about:blank` omits `url` so the host keeps its own start page.
 * Anything that is not `https:` is refused before the host call.
 */
export function seatBrowserUrlForHost(
	raw: string | undefined
):
	| { send: true; url?: string }
	| { send: false; code: typeof SEAT_BROWSER_SCHEME } {
	const trimmed = (raw ?? '').trim();
	if (
		trimmed.length === 0 ||
		trimmed === 'about:blank' ||
		trimmed.startsWith('about:blank?')
	) {
		return { send: true };
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { send: false, code: SEAT_BROWSER_SCHEME };
	}
	if (parsed.protocol !== 'https:') {
		return { send: false, code: SEAT_BROWSER_SCHEME };
	}
	return { send: true, url: parsed.href };
}

function finiteBounds(
	bounds: SeatBrowserBounds | null | undefined
): SeatBrowserBounds | undefined {
	if (!bounds) return undefined;
	if (
		!Number.isFinite(bounds.x) ||
		!Number.isFinite(bounds.y) ||
		!Number.isFinite(bounds.width) ||
		!Number.isFinite(bounds.height)
	) {
		return undefined;
	}
	return {
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
	};
}

export async function openEmpiierosSeatBrowser(args: {
	url?: string;
	bounds?: SeatBrowserBounds | null;
}): Promise<SeatBrowserResult> {
	const urlPlan = seatBrowserUrlForHost(args.url);
	if (!urlPlan.send) return { ok: false, code: urlPlan.code };
	const host = readHost();
	if (!host?.openSeatBrowser) {
		return { ok: false, code: SEAT_BROWSER_UNAVAILABLE };
	}
	const payload: { url?: string; bounds?: SeatBrowserBounds } = {};
	if (urlPlan.url) payload.url = urlPlan.url;
	const bounds = finiteBounds(args.bounds);
	if (bounds) payload.bounds = bounds;
	try {
		return asResult(await host.openSeatBrowser(payload));
	} catch {
		return { ok: false, code: SEAT_BROWSER_UNAVAILABLE };
	}
}

export async function closeEmpiierosSeatBrowser(): Promise<SeatBrowserResult> {
	const host = readHost();
	if (!host?.closeSeatBrowser) {
		return { ok: false, code: SEAT_BROWSER_UNAVAILABLE };
	}
	try {
		return asResult(await host.closeSeatBrowser());
	} catch {
		return { ok: false, code: SEAT_BROWSER_UNAVAILABLE };
	}
}

/** EmpiierOS downloads stay on the seat. This CTA must not open a folder. */
export function ebrowserDownloadsOpenTarget(
	host: 'tauri' | 'empiieros'
): 'content_manager' | 'seat_local_notice' {
	return host === 'empiieros' ? 'seat_local_notice' : 'content_manager';
}
