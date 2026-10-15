/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side license mode IA (#011/#015) — offline / cloud / both without raw profile ids.
 *
 * Invariants:
 * - Labels never expose client-offline-ai / connected machine ids to users.
 * - Offline is the default product mode when ambiguous.
 *
 * Related:
 * - api/services/desktop_client/license_modes.py
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md §desktop-client-015
 */

export type SeatMode = 'offline' | 'cloud' | 'both';

export const DEFAULT_SEAT_MODE: SeatMode = 'offline';

const OFFLINE_PROFILE_ID = 'client-offline-ai';
const OFFLINE_EDITION = 'client';
const CLOUD_EDITION = 'connected';

const MODE_LABEL_RU: Record<SeatMode, string> = {
	offline: 'Офлайн-режим',
	cloud: 'Облачный режим',
	both: 'Офлайн и облако',
};

const MODE_HINT_RU: Record<SeatMode, string> = {
	offline:
		'Приложения на устройстве без постоянного канала. Главный режим для работы без сети.',
	cloud:
		'Защищённый канал и облачный рабочий стол EliteEW — когда нужен полный стол в сети.',
	both: 'Офлайн-приложения на устройстве и облачный стол под одной лицензией.',
};

export function normalizeSeatMode(raw: string | null | undefined): SeatMode {
	const m = (raw || DEFAULT_SEAT_MODE).trim().toLowerCase();
	if (
		m === 'both' ||
		m === 'offline+online' ||
		m === 'offline_online' ||
		m === 'hybrid'
	) {
		return 'both';
	}
	if (
		m === 'offline' ||
		m === 'client' ||
		m === 'client-offline' ||
		m === 'client-offline-ai'
	) {
		return 'offline';
	}
	if (m === 'cloud' || m === 'connected' || m === 'online') {
		return 'cloud';
	}
	return DEFAULT_SEAT_MODE;
}

export function flagsForMode(mode: SeatMode): {
	allowOffline: boolean;
	allowOnline: boolean;
} {
	if (mode === 'offline') return { allowOffline: true, allowOnline: false };
	if (mode === 'cloud') return { allowOffline: false, allowOnline: true };
	return { allowOffline: true, allowOnline: true };
}

export function seatModeFromEdition(
	edition: string | null | undefined,
	profileId?: string | null,
	flags?: { allowOffline?: boolean | null; allowOnline?: boolean | null }
): SeatMode {
	if (
		typeof flags?.allowOffline === 'boolean' &&
		typeof flags?.allowOnline === 'boolean' &&
		(flags.allowOffline || flags.allowOnline)
	) {
		if (flags.allowOffline && flags.allowOnline) return 'both';
		if (flags.allowOffline) return 'offline';
		return 'cloud';
	}
	const ed = (edition || '').trim();
	const profile = (profileId || '').trim();
	if (ed === OFFLINE_EDITION || profile === OFFLINE_PROFILE_ID) {
		return 'offline';
	}
	if (ed === CLOUD_EDITION) {
		return 'cloud';
	}
	return DEFAULT_SEAT_MODE;
}

export function modeLabelRu(mode: SeatMode): string {
	return MODE_LABEL_RU[mode];
}

export function modeHintRu(mode: SeatMode): string {
	return MODE_HINT_RU[mode];
}

/** Prefer package.mode, else flags/edition/profile. */
export function resolveSeatModeLabelRu(input: {
	mode?: string | null;
	edition?: string | null;
	profileId?: string | null;
	modeLabelRu?: string | null;
	allowOffline?: boolean | null;
	allowOnline?: boolean | null;
}): string {
	const packaged = (input.modeLabelRu || '').trim();
	if (packaged) return packaged;
	if (input.mode) {
		return modeLabelRu(normalizeSeatMode(input.mode));
	}
	return modeLabelRu(
		seatModeFromEdition(input.edition, input.profileId, {
			allowOffline: input.allowOffline,
			allowOnline: input.allowOnline,
		})
	);
}
