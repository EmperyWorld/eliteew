/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared preflight for product Start when W-transport is the packaged tunnel.
 *
 * Invariants:
 * - Retail requires SOCKS up; never accept system wg-quick as substitute.
 * - Missing/disabled W-transport is fail-closed (ops-system-wg is a separate build).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
 */

import {
	wTransportRecoverFromKeyring,
	wTransportStatus,
} from "../tauri-bridge/commands";

export type ChannelPreflight = { ok: true } | { ok: false; detail: string };

export const PRODUCT_CHANNEL_DOWN_RU =
	"Защищённый канал не подключён. Импортируйте файл доступа на экране активации и дождитесь подтверждения канала, затем повторите.";

export const PRODUCT_CHANNEL_CHECK_FAIL_RU =
	"Не удалось проверить защищённый канал. Проверьте интернет и повторите импорт файла доступа.";

/**
 * Fail-closed channel check before product_open (FoFline or Connected cloud Start).
 */
async function readProductChannelUp(): Promise<ChannelPreflight> {
	try {
		const wTransport = await wTransportStatus().catch(() => null);
		if (!wTransport?.enabled) {
			return { ok: false, detail: PRODUCT_CHANNEL_DOWN_RU };
		}
		const up = Boolean(wTransport.socks_listening && wTransport.proxy_url);
		if (!up) {
			return { ok: false, detail: PRODUCT_CHANNEL_DOWN_RU };
		}
		return { ok: true };
	} catch {
		return { ok: false, detail: PRODUCT_CHANNEL_CHECK_FAIL_RU };
	}
}

export async function assertProductChannelReady(): Promise<ChannelPreflight> {
	return readProductChannelUp();
}

/**
 * One-shot keyring recover when SOCKS is down but W-transport is enabled.
 * Used before license preflight and OTA so the product self-heals without shell tips.
 */
export async function assertProductChannelReadyWithRecover(): Promise<ChannelPreflight> {
	const first = await readProductChannelUp();
	if (first.ok) {
		return first;
	}
	try {
		const wTransport = await wTransportStatus().catch(() => null);
		if (!wTransport?.enabled) {
			return first;
		}
		await wTransportRecoverFromKeyring();
	} catch {
		return first;
	}
	return readProductChannelUp();
}

export function humanizeProductOpenFailure(
	code: string,
	message?: string | null,
): string {
	if (code === "w_transport_proxy_required") {
		return (
			message?.trim() ||
			"Сначала подключите защищённый канал, затем повторите запуск."
		);
	}
	if (code === "auth_policy_denied") {
		const t = message?.trim() || "";
		const lower = t.toLowerCase();
		const opaque =
			!t ||
			lower === "authentication could not be completed" ||
			lower === "sign-in was cancelled or timed out" ||
			lower.includes("auth_policy_denied");
		return opaque
			? "Не удалось завершить вход на рабочем столе. Повторите попытку."
			: t;
	}
	return `Не удалось открыть: ${code}`;
}
