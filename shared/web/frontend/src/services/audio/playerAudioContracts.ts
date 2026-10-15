/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared audio-player contracts for content identity normalization and authenticated
 * download URL derivation used across Music Player, EWA and preview surfaces.
 *
 * Invariants:
 * - Canonical content identity in player flows is `unifiedContentId`.
 * - Download URLs always point to `/api/v1/content/{id}/download` with query params encoded.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 */

export type AudioSourceSurface =
	| 'music-player'
	| 'music-generator'
	| 'music-evolution'
	| 'ugs-hub'
	| 'content-manager'
	| 'ewa-companion'
	| 'desktop-widget'
	| 'voice-message'
	| 'admin-preview'
	| 'marketing-preview'
	| 'unknown';

export interface AudioTrackIdentity {
	unifiedContentId: string;
	title: string;
	version: string | null;
	thumbnailUrl: string | null;
	mimeType: string | null;
	sourceSurface: AudioSourceSurface;
}

export interface PlayerAudioAsset {
	identity: AudioTrackIdentity;
	downloadUrl: string;
	cacheKey: string;
	previewOnly: boolean;
}

function readTrimmedString(
	record: Record<string, unknown>,
	keys: readonly string[]
): string {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim();
		}
	}
	return '';
}

/**
 * Read canonical unified-content id from payload variants.
 *
 * Accepts both snake_case and camelCase fields that backend/legacy clients may emit.
 */
export function normalizeUnifiedContentId(raw: unknown): string | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const id = readTrimmedString(record, [
		'unified_content_id',
		'unifiedContentId',
		'content_id',
		'contentId',
		'id',
	]);
	return id || null;
}

export type UnifiedContentAvailability = 'available' | 'missing';

/** Read server tombstone from companion task result payloads (A-09). */
export function unifiedContentAvailability(
	raw: unknown
): UnifiedContentAvailability | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}
	const value = (raw as Record<string, unknown>).unified_content_availability;
	if (value === 'missing') return 'missing';
	if (value === 'available') return 'available';
	return null;
}

export function isUnifiedContentReferenceMissing(raw: unknown): boolean {
	return unifiedContentAvailability(raw) === 'missing';
}

export function buildContentDownloadUrlWithDisposition(
	unifiedContentId: string,
	options?: {
		disposition?: 'inline' | 'attachment';
		version?: string | null;
	}
): string {
	const contentId = unifiedContentId.trim();
	const base = `/api/v1/content/${encodeURIComponent(contentId)}/download`;
	const params = new URLSearchParams();
	const disposition = options?.disposition ?? 'attachment';
	params.set('disposition', disposition);
	if (options?.version && options.version.trim().length > 0) {
		params.set('v', options.version.trim());
	}
	return `${base}?${params.toString()}`;
}

export function buildPlayerAudioAsset(
	identity: AudioTrackIdentity,
	options?: { previewOnly?: boolean }
): PlayerAudioAsset {
	const version = identity.version?.trim() || null;
	const cacheVersion = version ?? 'unversioned';
	return {
		identity,
		downloadUrl: buildContentDownloadUrlWithDisposition(
			identity.unifiedContentId,
			{
				disposition: 'inline',
				version,
			}
		),
		cacheKey: `${identity.unifiedContentId}:${cacheVersion}`,
		previewOnly: options?.previewOnly ?? false,
	};
}
