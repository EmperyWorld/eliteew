/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for media workbench labels, album property matching, and
 * idempotency keys — no React or network I/O.
 *
 * Invariants:
 * - Album UUID compare is case/hyphen insensitive; empty ids never match.
 * - Unknown i18n keys fall back to humanized raw values (no raw codes as primary UI).
 *
 * Related:
 * - mediaBatchMapper.ts
 * - professionalWorlds.json (`mediaWorkbench.*`)
 */

import { APIError } from '@/services/api/client';
import type { TFunction } from 'i18next';
import type { ProfessionalBatchItemProgressRow } from '../mediaBatchMapper';
import type { MediaWorkbenchBrandDraft } from './types';

export function humanizeMediaValue(value: string): string {
	return value
		.replace(/^phase:/, '')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function translateMediaValue(
	t: TFunction,
	scope: 'jobStatuses' | 'reviewDecisions' | 'progressSignals',
	value: string | null | undefined
): string {
	const normalized = value?.trim() || 'unknown';
	return t(`mediaWorkbench.${scope}.${normalized}`, {
		defaultValue: humanizeMediaValue(normalized),
	});
}

export function latestProgressSignal(
	row: ProfessionalBatchItemProgressRow | undefined
): string | null {
	const latest = row?.phases.at(-1);
	return latest ? humanizeMediaValue(latest) : null;
}

/** Loose UUID equality for Postgres/JSON payloads that may stringify differently. */
export function albumBelongsToProperty(
	albumPropertyId: string | null | undefined,
	listingId: string
): boolean {
	if (albumPropertyId == null || String(albumPropertyId).trim() === '') {
		return false;
	}
	const a = String(albumPropertyId).replace(/-/g, '').toLowerCase();
	const b = String(listingId).replace(/-/g, '').toLowerCase();
	return a === b && a.length > 0;
}

export function createIdempotencyKey(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseBrandKitDraftFromApi(
	kit: Record<string, unknown>
): MediaWorkbenchBrandDraft {
	const wm = String(kit.watermark_corner ?? 'none');
	const corner: MediaWorkbenchBrandDraft['watermark_corner'] =
		wm === 'tr' || wm === 'tl' || wm === 'br' || wm === 'bl' || wm === 'none'
			? wm
			: 'none';
	return {
		primary_hex: String(kit.primary_hex ?? ''),
		accent_hex: String(kit.accent_hex ?? ''),
		typography_note: String(kit.typography_note ?? ''),
		logo_asset_hint: String(kit.logo_asset_hint ?? ''),
		watermark_corner: corner,
		watermark_padding_px:
			typeof kit.watermark_padding_px === 'number'
				? kit.watermark_padding_px
				: '',
	};
}

export function albumsApiFailureReason(caught: unknown): string {
	const err = caught instanceof APIError ? caught : null;
	const body = err?.details;
	if (body && typeof body === 'object' && 'reason' in body) {
		return String((body as { reason?: unknown }).reason);
	}
	return '';
}

export function isAlbumsSchemaMigrationError(caught: unknown): boolean {
	const err = caught instanceof APIError ? caught : null;
	return (
		err?.statusCode === 503 &&
		albumsApiFailureReason(caught) === 'db_schema_migration'
	);
}
