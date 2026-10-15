/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-principal icon overrides for user quick presets (U2.4) — localStorage only.
 *
 * Invariants:
 * - Keys scoped by ``principalId``; invalid JSON → empty map.
 * - Only user preset ids (not built-in ``__ewa_builtin__`` chips).
 *
 * Related:
 * - src/features/ewa/companionQuickPresetIcons.ts
 */

import type { CompanionQuickPresetVisual } from '@/features/ewa/companionQuickPresetIcons';
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import type { EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

const KEY_PREFIX = 'eliteew.companion.myPhraseIcons.v1:';

export type MyPhraseIconOverride = CompanionQuickPresetVisual;

type StoredRow = {
	icon?: unknown;
	tone?: unknown;
};

function coerceOverride(raw: unknown): MyPhraseIconOverride | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const row = raw as StoredRow;
	const icon = typeof row.icon === 'string' ? row.icon.trim() : '';
	const tone = typeof row.tone === 'string' ? row.tone.trim() : '';
	if (!icon) return null;
	return {
		icon: icon as EwaIconId,
		tone: (tone || 'muted') as EwaIconTone,
	};
}

export function readMyPhraseIconOverrides(
	principalId: string
): ReadonlyMap<string, MyPhraseIconOverride> {
	const map = new Map<string, MyPhraseIconOverride>();
	if (typeof window === 'undefined' || !principalId.trim()) return map;
	try {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${principalId}`);
		if (!raw) return map;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return map;
		}
		for (const [presetId, value] of Object.entries(parsed)) {
			const override = coerceOverride(value);
			if (override && presetId.trim()) {
				map.set(presetId, override);
			}
		}
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_my_phrase_icons_read',
			'my phrase icon overrides parse failed',
			err
		);
	}
	return map;
}

export function writeMyPhraseIconOverride(
	principalId: string,
	presetId: string,
	visual: MyPhraseIconOverride
): ReadonlyMap<string, MyPhraseIconOverride> {
	const current = new Map(readMyPhraseIconOverrides(principalId));
	const id = presetId.trim();
	if (!id || typeof window === 'undefined' || !principalId.trim()) {
		return current;
	}
	current.set(id, visual);
	try {
		const payload: Record<string, MyPhraseIconOverride> = {};
		for (const [key, value] of current) {
			payload[key] = value;
		}
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify(payload)
		);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_my_phrase_icons_write',
			'my phrase icon override persist failed',
			err
		);
	}
	return current;
}

/** Curated palette for user phrase icons (U2.4). */
export const COMPANION_MY_PHRASE_ICON_OPTIONS: readonly MyPhraseIconOverride[] =
	[
		{ icon: 'icon-pulse', tone: 'brand' },
		{ icon: 'icon-bookmark', tone: 'aura' },
		{ icon: 'icon-star-filled', tone: 'aura' },
		{ icon: 'icon-ewa-dashboard', tone: 'brand' },
		{ icon: 'icon-success', tone: 'success' },
		{ icon: 'icon-high-contrast', tone: 'aura' },
		{ icon: 'icon-ewa-plugins', tone: 'brand' },
		{ icon: 'icon-ewa-analytics', tone: 'aura' },
		{ icon: 'icon-ewa-perplexity', tone: 'brand' },
		{ icon: 'icon-focus-indicator', tone: 'muted' },
		{ icon: 'icon-search-default', tone: 'brand' },
		{ icon: 'icon-ewa-brain', tone: 'aura' },
	] as const;
