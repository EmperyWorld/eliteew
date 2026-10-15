/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for global now-playing audio source resolution (cache, stream, blob fallback).
 *
 * Related:
 * - src/pages/MusicPlayer/nowPlayingTrackAudioSource.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setOidcRuntimeProfile } from '@/services/keycloakProfile';

const { resolveMusicPlayerTrackInlineStreamUrl } = vi.hoisted(() => ({
	resolveMusicPlayerTrackInlineStreamUrl: vi.fn(),
}));

vi.mock('../musicPlayerAudioDownload', () => ({
	resolveMusicPlayerTrackInlineStreamUrl: (...args: unknown[]) =>
		resolveMusicPlayerTrackInlineStreamUrl(...args),
}));

import { resolveNowPlayingTrackAudioSource } from '../nowPlayingTrackAudioSource';

const track = {
	id: '11111111-1111-1111-1111-111111111111',
	name: 'Test Track',
	version: 'rev-1',
};

describe('resolveNowPlayingTrackAudioSource', () => {
	beforeEach(() => {
		resolveMusicPlayerTrackInlineStreamUrl.mockReset();
	});

	it('returns cached blob without network when IDB has audio', async () => {
		const cached = new Blob(['cached'], { type: 'audio/mpeg' });
		const onCacheHit = vi.fn();
		const result = await resolveNowPlayingTrackAudioSource(track, {
			getCachedBlob: vi.fn().mockResolvedValue(cached),
			putCachedBlob: vi.fn(),
			fetchAudioBlob: vi.fn(),
			onCacheHit,
		});

		expect(result).toMatchObject({
			mode: 'blob',
			cacheSource: 'idb-cache',
			blob: cached,
		});
		expect(onCacheHit).toHaveBeenCalledWith(track.id);
		expect(resolveMusicPlayerTrackInlineStreamUrl).not.toHaveBeenCalled();
	});

	it('prefers inline stream URL when ticket resolution succeeds', async () => {
		resolveMusicPlayerTrackInlineStreamUrl.mockResolvedValueOnce(
			'https://app.example.test/download-by-ticket?ticket=t1'
		);
		const onStreamResolved = vi.fn();
		const fetchAudioBlob = vi.fn();

		const result = await resolveNowPlayingTrackAudioSource(track, {
			getCachedBlob: vi.fn().mockResolvedValue(null),
			putCachedBlob: vi.fn(),
			fetchAudioBlob,
			onStreamResolved,
		});

		expect(result).toMatchObject({
			mode: 'stream',
			cacheSource: 'inline-stream',
			streamUrl: 'https://app.example.test/download-by-ticket?ticket=t1',
		});
		expect(onStreamResolved).toHaveBeenCalledWith(track.id);
		expect(fetchAudioBlob).not.toHaveBeenCalled();
	});

	it('skips the ticket stream on foflineNative and fetches the blob', async () => {
		setOidcRuntimeProfile('foflineNative');
		const networkBlob = new Blob(['pcm'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);
		const result = await resolveNowPlayingTrackAudioSource(track, {
			getCachedBlob: vi.fn().mockResolvedValue(null),
			putCachedBlob: vi.fn(),
			fetchAudioBlob,
		});
		expect(resolveMusicPlayerTrackInlineStreamUrl).not.toHaveBeenCalled();
		expect(fetchAudioBlob).toHaveBeenCalled();
		expect(result.mode).toBe('blob');
		setOidcRuntimeProfile('web');
	});

	it('skips ticket stream when preferBlob is true (Tauri path)', async () => {
		const networkBlob = new Blob(['network'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);
		const onStreamFallback = vi.fn();
		const onStreamResolved = vi.fn();

		const result = await resolveNowPlayingTrackAudioSource(
			track,
			{
				getCachedBlob: vi.fn().mockResolvedValue(null),
				putCachedBlob: vi.fn(),
				fetchAudioBlob,
				onStreamFallback,
				onStreamResolved,
			},
			{ preferBlob: true }
		);

		expect(result).toMatchObject({
			mode: 'blob',
			cacheSource: 'network',
			blob: networkBlob,
		});
		expect(resolveMusicPlayerTrackInlineStreamUrl).not.toHaveBeenCalled();
		expect(onStreamResolved).not.toHaveBeenCalled();
		expect(onStreamFallback).toHaveBeenCalledWith(track.id);
		expect(fetchAudioBlob).toHaveBeenCalled();
	});

	it('prefers blob for music-generator surface (MusicForge auto-play)', async () => {
		const networkBlob = new Blob(['forge'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);

		const result = await resolveNowPlayingTrackAudioSource(
			{ ...track, source_surface: 'music-generator' },
			{
				getCachedBlob: vi.fn().mockResolvedValue(null),
				putCachedBlob: vi.fn(),
				fetchAudioBlob,
			}
		);

		expect(result.mode).toBe('blob');
		expect(resolveMusicPlayerTrackInlineStreamUrl).not.toHaveBeenCalled();
		expect(fetchAudioBlob).toHaveBeenCalled();
	});

	it('falls back to authenticated blob fetch when stream ticket fails', async () => {
		resolveMusicPlayerTrackInlineStreamUrl.mockRejectedValueOnce(
			new Error('TICKET_UNAVAILABLE')
		);
		const networkBlob = new Blob(['network'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);
		const putCachedBlob = vi.fn();
		const onStreamFallback = vi.fn();
		const onBlobFetch = vi.fn();

		const result = await resolveNowPlayingTrackAudioSource(track, {
			getCachedBlob: vi.fn().mockResolvedValue(null),
			putCachedBlob,
			fetchAudioBlob,
			onStreamFallback,
			onBlobFetch,
		});

		expect(result).toMatchObject({
			mode: 'blob',
			cacheSource: 'network',
			blob: networkBlob,
		});
		expect(onStreamFallback).toHaveBeenCalledWith(track.id);
		expect(onBlobFetch).toHaveBeenCalledWith(track.id);
		expect(putCachedBlob).toHaveBeenCalled();
		expect(fetchAudioBlob).toHaveBeenCalledWith({
			unifiedContentId: track.id,
			version: track.version,
		});
	});

	it('falls back to blob when inline stream URL is empty', async () => {
		resolveMusicPlayerTrackInlineStreamUrl.mockResolvedValueOnce('   ');
		const networkBlob = new Blob(['network'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);
		const onStreamFallback = vi.fn();
		const onStreamResolved = vi.fn();

		const result = await resolveNowPlayingTrackAudioSource(track, {
			getCachedBlob: vi.fn().mockResolvedValue(null),
			putCachedBlob: vi.fn(),
			fetchAudioBlob,
			onStreamFallback,
		});

		expect(result.mode).toBe('blob');
		expect(onStreamFallback).toHaveBeenCalledWith(track.id);
		expect(onStreamResolved).not.toHaveBeenCalled();
		expect(fetchAudioBlob).toHaveBeenCalled();
	});

	it('passes trimmed version to stream resolver and blob fetch', async () => {
		resolveMusicPlayerTrackInlineStreamUrl.mockRejectedValueOnce(
			new Error('TICKET_UNAVAILABLE')
		);
		const versionedTrack = {
			id: track.id,
			name: track.name,
			version: '  rev-2  ',
		};
		const networkBlob = new Blob(['network'], { type: 'audio/mpeg' });
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);

		await resolveNowPlayingTrackAudioSource(versionedTrack, {
			getCachedBlob: vi.fn().mockResolvedValue(null),
			putCachedBlob: vi.fn(),
			fetchAudioBlob,
		});

		expect(resolveMusicPlayerTrackInlineStreamUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				id: track.id,
				version: '  rev-2  ',
			}),
			expect.objectContaining({ signal: undefined })
		);
		expect(fetchAudioBlob).toHaveBeenCalledWith({
			unifiedContentId: track.id,
			version: 'rev-2',
		});
	});

	it('uses version-specific cache key before attempting stream', async () => {
		resolveMusicPlayerTrackInlineStreamUrl.mockResolvedValueOnce('');
		const networkBlob = new Blob(['network'], { type: 'audio/mpeg' });
		const getCachedBlob = vi.fn().mockResolvedValue(null);
		const fetchAudioBlob = vi.fn().mockResolvedValue(networkBlob);

		await resolveNowPlayingTrackAudioSource(
			{ id: track.id, name: track.name, version: 'rev-a' },
			{
				getCachedBlob,
				putCachedBlob: vi.fn(),
				fetchAudioBlob,
			}
		);

		expect(getCachedBlob).toHaveBeenCalledWith(`${track.id}:rev-a`);
	});
});
