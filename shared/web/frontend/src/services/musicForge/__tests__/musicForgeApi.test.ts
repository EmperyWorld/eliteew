/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest contract checks for MusicForge API transport helpers.
 *
 * Invariants:
 * - SSE parsing accepts only backend run snapshots.
 * - Terminal status detection matches backend durable states.
 *
 * Related:
 * - src/services/musicForge/musicForgeApi.ts
 */

import { describe, expect, it, vi } from 'vitest';
import type { MusicForgeLanguageOption } from '../musicForgeOpenApi';
import {
	isMusicForgeRunTerminalStatus,
	MUSIC_FORGE_POLL_MS_MAX,
	MUSIC_FORGE_POLL_MS_MIN,
	nextMusicForgePollDelayMs,
	normalizeMusicForgeDownloadPath,
	parseMusicForgeRunFromSseLine,
	resolveMusicForgeResultAudioStreamUrl,
} from '../musicForgeApi';

vi.mock('@/pages/MusicPlayer/musicPlayerAudioDownload', () => ({
	fetchMusicDownloadPathBlobWithRanges: vi.fn(),
	parseUnifiedContentIdFromDownloadPath: vi.fn((path: string) => {
		const match = path.match(/\/content\/([^/]+)\/download/);
		return match?.[1]
			? { contentId: match[1], searchParams: new URLSearchParams() }
			: null;
	}),
	readMusicContentDownloadParamsFromPath: vi.fn(() => ({
		disposition: 'inline',
		version: null,
	})),
	resolveMusicContentInlineStreamUrl: vi.fn(
		async (contentId: string) =>
			`https://app.example.test/api/v1/content/${contentId}/download-by-ticket?ticket=t1`
	),
}));

describe('musicForgeApi helpers', () => {
	it('OpenAPI language option rows expose value and label_ru', () => {
		const row = {
			value: 'ru',
			label_ru: 'Русский',
		} satisfies MusicForgeLanguageOption;

		expect(row.value).toBe('ru');
		expect(row.label_ru).toBe('Русский');
	});

	it('parses backend run snapshots from SSE data lines', () => {
		const run = parseMusicForgeRunFromSseLine(
			JSON.stringify({
				id: '11111111-1111-1111-1111-111111111111',
				status: 'running',
				idea: 'Курага',
				steps: [],
			})
		);

		expect(run?.id).toBe('11111111-1111-1111-1111-111111111111');
		expect(run?.status).toBe('running');
	});

	it('rejects keep-alive or non-run payloads', () => {
		expect(parseMusicForgeRunFromSseLine('')).toBeNull();
		expect(parseMusicForgeRunFromSseLine('{"error":"nope"}')).toBeNull();
		expect(parseMusicForgeRunFromSseLine('not-json')).toBeNull();
	});

	it('matches backend terminal statuses', () => {
		expect(isMusicForgeRunTerminalStatus('completed')).toBe(true);
		expect(isMusicForgeRunTerminalStatus('failed')).toBe(true);
		expect(isMusicForgeRunTerminalStatus('cancelled')).toBe(true);
		expect(isMusicForgeRunTerminalStatus('running')).toBe(false);
		expect(isMusicForgeRunTerminalStatus(undefined)).toBe(false);
	});

	it('backs off GET poll delay without exceeding the max cadence', () => {
		expect(nextMusicForgePollDelayMs(MUSIC_FORGE_POLL_MS_MIN)).toBe(6_000);
		expect(nextMusicForgePollDelayMs(6_000)).toBe(9_000);
		expect(nextMusicForgePollDelayMs(12_000)).toBe(MUSIC_FORGE_POLL_MS_MAX);
		expect(nextMusicForgePollDelayMs(MUSIC_FORGE_POLL_MS_MAX)).toBe(
			MUSIC_FORGE_POLL_MS_MAX
		);
	});

	it('accepts only same-app API download paths for result audio blobs', () => {
		expect(
			normalizeMusicForgeDownloadPath(
				'/api/v1/content/11111111-1111-1111-1111-111111111111/download'
			)
		).toBe('/api/v1/content/11111111-1111-1111-1111-111111111111/download');
		expect(normalizeMusicForgeDownloadPath('/files/public.mp3')).toBe('');
		expect(
			normalizeMusicForgeDownloadPath('https://example.invalid/file.mp3')
		).toBe('');
	});

	it('resolves inline stream URLs for unified content download paths', async () => {
		await expect(
			resolveMusicForgeResultAudioStreamUrl(
				'/api/v1/content/11111111-1111-1111-1111-111111111111/download?disposition=inline'
			)
		).resolves.toContain('/download-by-ticket?ticket=t1');
	});
});
