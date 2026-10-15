/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS playback stays in memory. Media element src is not a download
 * ticket or a blob URL. Browser stream resolution is unchanged.
 *
 * Related:
 * - services/audio/foflineDecodedPlayback.ts
 * - pages/MusicPlayer/nowPlayingTrackAudioSource.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setOidcRuntimeProfile } from '@/services/keycloakProfile';
import { probeDirectDownloadUrl } from '@/services/content/contentDownloadResilience';
import {
	foflineNowPlaying,
	isForbiddenFoflineMediaSrc,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '@/services/audio/foflineDecodedPlayback';

class FakeBuffer {
	duration = 3;
}

class FakeSource {
	buffer: FakeBuffer | null = null;
	playbackRate = { value: 1 };
	onended: (() => void) | null = null;
	connect(): void {}
	start(): void {}
	stop(): void {}
	disconnect(): void {}
}

class FakeGain {
	gain = { value: 1 };
	connect(): void {}
}

class FakeContext {
	state = 'running';
	currentTime = 1;
	destination = {};
	decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => {
		if (bytes.byteLength === 0) throw new Error('empty');
		return new FakeBuffer();
	});
	createGain(): FakeGain {
		return new FakeGain();
	}
	createBufferSource(): FakeSource {
		return new FakeSource();
	}
	resume = vi.fn(async () => undefined);
	close = vi.fn(async () => {
		this.state = 'closed';
	});
}

describe('fofline decoded playback', () => {
	afterEach(() => {
		setOidcRuntimeProfile('web');
		delete (window as Window & { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__;
		foflineNowPlaying.stop();
		vi.unstubAllGlobals();
	});

	it('decodes a non-empty buffer and clears leftover media src on stop', async () => {
		setOidcRuntimeProfile('foflineNative');
		expect(isFoflineSpaWebAudioHost()).toBe(true);
		const decoded: ArrayBuffer[] = [];
		const closed = vi.fn(async function close(this: { state: string }) {
			this.state = 'closed';
		});
		class TestContext extends FakeContext {
			decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => {
				decoded.push(bytes);
				return new FakeBuffer();
			});
			close = closed;
		}
		vi.stubGlobal('AudioContext', TestContext);
		const audio = document.createElement('audio');
		audio.setAttribute(
			'src',
			'blob:fofline-spa://localhost/11111111-1111-1111-1111-111111111111'
		);
		const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
		await foflineNowPlaying.loadBytes(bytes, 0);
		await foflineNowPlaying.play();
		expect(decoded[0]?.byteLength).toBeGreaterThan(0);
		expect(audio.getAttribute('src')).toContain('blob:');
		releaseHtmlMediaElement(audio);
		foflineNowPlaying.stop();
		expect(audio.getAttribute('src')).toBeNull();
		expect(closed).toHaveBeenCalled();
	});

	it('does not treat download-by-ticket or blob urls as playable media src', () => {
		expect(
			isForbiddenFoflineMediaSrc(
				'fofline-spa://localhost/api/v1/content/abc/download-by-ticket?ticket=t'
			)
		).toBe(true);
		expect(isForbiddenFoflineMediaSrc('blob:fofline-spa://localhost/x')).toBe(
			true
		);
		expect(isForbiddenFoflineMediaSrc('https://app.eliteew.ru/guide.mp3')).toBe(
			false
		);
	});

	it('keeps the browser on the living host, not the Web Audio owner', () => {
		setOidcRuntimeProfile('web');
		expect(isFoflineSpaWebAudioHost()).toBe(false);
		setOidcRuntimeProfile('foflineNative');
		(
			window as Window & {
				__TAURI_INTERNALS__?: { invoke: () => Promise<unknown> };
			}
		).__TAURI_INTERNALS__ = { invoke: async () => ({}) };
		expect(isFoflineSpaWebAudioHost()).toBe(false);
	});

	it('does not probe Range bytes=0-0 on foflineNative', async () => {
		setOidcRuntimeProfile('foflineNative');
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		await probeDirectDownloadUrl(
			'https://app.eliteew.ru/api/v1/content/abc/download-by-ticket?ticket=t'
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
