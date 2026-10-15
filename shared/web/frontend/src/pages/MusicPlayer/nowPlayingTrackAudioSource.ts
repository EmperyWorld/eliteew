/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve global now-playing audio from IDB cache, ticketed inline stream (browser),
 * or authenticated blob (Tauri prefer / stream fallback).
 *
 * Invariants:
 * - Browser: inline stream before full blob; blob path preserves retry/cache.
 * - Tauri/WebView and EmpiierOS FoFline skip the ticket stream. EmpiierOS
 *   then decodes the blob in memory and must not assign it to `<audio src>`.
 * - Stream URLs are short-lived tickets; IDB cache remains blob-only for offline replay.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/MusicPlayer/musicPlayerAudioDownload.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import type { FetchAuthenticatedAudioBlobArgs } from '@/hooks/audio/useAuthenticatedAudioBlob';
import { isFoflineSpaWebAudioHost } from '@/services/audio/foflineDecodedPlayback';
import {
	buildPlayerAudioAsset,
	type AudioTrackIdentity,
} from '@/services/audio/playerAudioContracts';

import { resolveMusicPlayerTrackInlineStreamUrl } from './musicPlayerAudioDownload';

export type NowPlayingTrackAudioIdentity = {
	id: string;
	name: string;
	thumbnail_url?: string | null;
	version?: string | null;
	mime_type?: string | null;
	source_surface?: AudioTrackIdentity['sourceSurface'];
};

export type NowPlayingTrackAudioCacheSource =
	| 'idb-cache'
	| 'inline-stream'
	| 'network';

export type NowPlayingTrackAudioSource =
	| {
			mode: 'blob';
			blob: Blob;
			cacheSource: 'idb-cache' | 'network';
			asset: ReturnType<typeof buildPlayerAudioAsset>;
	  }
	| {
			mode: 'stream';
			streamUrl: string;
			cacheSource: 'inline-stream';
			asset: ReturnType<typeof buildPlayerAudioAsset>;
	  };

export type ResolveNowPlayingTrackAudioSourceDeps = {
	getCachedBlob: (cacheKey: string) => Promise<Blob | null | undefined>;
	putCachedBlob: (cacheKey: string, blob: Blob) => Promise<unknown>;
	fetchAudioBlob: (args: FetchAuthenticatedAudioBlobArgs) => Promise<Blob>;
	onCacheHit?: (trackId: string) => void;
	onStreamResolved?: (trackId: string) => void;
	onBlobFetch?: (trackId: string) => void;
	onStreamFallback?: (trackId: string) => void;
};

export type ResolveNowPlayingTrackAudioSourceOptions = {
	signal?: AbortSignal;
	/** Force authenticated blob (skip ticket stream). Default: auto in Tauri. */
	preferBlob?: boolean;
};

function toTrackIdentity(
	track: NowPlayingTrackAudioIdentity
): AudioTrackIdentity {
	return {
		unifiedContentId: track.id,
		title: track.name,
		version:
			typeof track.version === 'string' && track.version.trim().length > 0
				? track.version.trim()
				: null,
		thumbnailUrl: track.thumbnail_url ?? null,
		mimeType: track.mime_type ?? null,
		sourceSurface: track.source_surface ?? 'unknown',
	};
}

/** Tauri/WebView: ticket progressive streams often fail decode; prefer typed blob. */
export function shouldPreferNowPlayingBlobOverTicketStream(
	preferBlob?: boolean
): boolean {
	if (preferBlob === true) return true;
	if (preferBlob === false) return false;
	if (typeof window === 'undefined') return false;
	const w = window as Window & {
		__TAURI__?: unknown;
		__TAURI_INTERNALS__?: unknown;
	};
	return (
		window.location.protocol === 'tauri:' ||
		w.__TAURI__ !== undefined ||
		w.__TAURI_INTERNALS__ !== undefined ||
		isFoflineSpaWebAudioHost()
	);
}

export async function resolveNowPlayingTrackAudioSource(
	track: NowPlayingTrackAudioIdentity,
	deps: ResolveNowPlayingTrackAudioSourceDeps,
	options?: ResolveNowPlayingTrackAudioSourceOptions
): Promise<NowPlayingTrackAudioSource> {
	const asset = buildPlayerAudioAsset(toTrackIdentity(track), {
		previewOnly: false,
	});
	const cached = await deps.getCachedBlob(asset.cacheKey);
	if (cached instanceof Blob && cached.size > 0) {
		deps.onCacheHit?.(track.id);
		return { mode: 'blob', blob: cached, cacheSource: 'idb-cache', asset };
	}

	const preferBlob = shouldPreferNowPlayingBlobOverTicketStream(
		options?.preferBlob === true || track.source_surface === 'music-generator'
			? true
			: options?.preferBlob
	);
	let streamFallback = preferBlob;
	if (!preferBlob) {
		try {
			const streamUrl = await resolveMusicPlayerTrackInlineStreamUrl(
				{
					id: track.id,
					updated_at: '',
					file_size: 0,
					version: track.version ?? null,
				},
				{ signal: options?.signal }
			);
			if (streamUrl.trim().length > 0) {
				deps.onStreamResolved?.(track.id);
				return {
					mode: 'stream',
					streamUrl,
					cacheSource: 'inline-stream',
					asset,
				};
			}
			streamFallback = true;
		} catch {
			streamFallback = true;
		}
	}
	if (streamFallback) {
		deps.onStreamFallback?.(track.id);
	}

	deps.onBlobFetch?.(track.id);
	const blob = await deps.fetchAudioBlob({
		unifiedContentId: asset.identity.unifiedContentId,
		version: asset.identity.version,
	});
	if (!blob || blob.size === 0) {
		throw new Error('EMPTY_AUDIO_BLOB');
	}
	void deps.putCachedBlob(asset.cacheKey, blob);
	return { mode: 'blob', blob, cacheSource: 'network', asset };
}
