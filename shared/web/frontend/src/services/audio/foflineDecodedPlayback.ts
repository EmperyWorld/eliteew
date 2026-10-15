/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS FoFline playback owner. Bytes are decoded in memory and played
 * with Web Audio. The product `<audio>` element never receives a
 * `fofline-spa:` download URL or a `blob:` from those bytes.
 *
 * Invariants:
 * - Host is `foflineNative` and/or `fofline-spa:` and not Tauri invoke.
 * - Browser and Tauri do not enter this path.
 * - Stop, pause, track change, and decode failure stop the source, close
 *   the context, and clear leftover media `src` so ALSA is released.
 * - A decode rejection is `AUDIO_DECODE_ERROR`. Do not fall back to a
 *   ticket media URL.
 *
 * Related:
 * - pages/Desktop/context/nowPlaying/useNowPlayingController.ts
 * - components/Audio/AuthenticatedAudioPreview.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */
import { hasTauriInvoke } from '@/services/desktopClient/eliteewProductHost';
import { getOidcRuntimeProfile } from '@/services/keycloakProfile';

export type FoflinePlaybackSnapshot = {
	currentTime: number;
	duration: number;
	playing: boolean;
};

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window & { webkitAudioContext?: AudioContextCtor };
	return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** EmpiierOS WebKit pack. Tauri keeps the living `<audio>` path. */
export function isFoflineSpaWebAudioHost(): boolean {
	if (typeof window === 'undefined') return false;
	if (hasTauriInvoke()) return false;
	if (getOidcRuntimeProfile() === 'foflineNative') return true;
	return window.location.protocol === 'fofline-spa:';
}

/**
 * Media URLs GStreamer cancels on this origin. Not a signal to retry them
 * as `HTMLMediaElement.src`.
 */
export function isForbiddenFoflineMediaSrc(src: string): boolean {
	const trimmed = src.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith('blob:')) return true;
	if (trimmed.includes('download-by-ticket')) return true;
	if (trimmed.includes('/content/') && trimmed.includes('/download')) {
		return true;
	}
	return trimmed.startsWith('fofline-spa:') && trimmed.includes('/download');
}

/** Drop a GStreamer pipeline. No URL and no JWT are written back. */
export function releaseHtmlMediaElement(
	audio: HTMLMediaElement | null | undefined
): void {
	if (!audio) return;
	try {
		audio.pause();
	} catch {
		/* element already gone */
	}
	audio.removeAttribute('src');
	const sources = audio.querySelectorAll('source');
	for (const source of sources) {
		source.removeAttribute('src');
	}
	try {
		audio.load();
	} catch {
		/* jsdom may not implement load */
	}
}

/**
 * One clock for the product WebProcess. A second context would fight the
 * exclusive analog device.
 */
export class FoflineDecodedPlayback {
	loadedTrackId: string | null = null;
	onTick: ((snapshot: FoflinePlaybackSnapshot) => void) | null = null;
	onNaturalEnd: (() => void) | null = null;

	private context: AudioContext | null = null;
	private gain: GainNode | null = null;
	private source: AudioBufferSourceNode | null = null;
	private buffer: AudioBuffer | null = null;
	private bytes: ArrayBuffer | null = null;
	private offsetSec = 0;
	private startedAt = 0;
	private rate = 1;
	private volume = 1;
	private playing = false;
	private ended = false;
	private intentionalStop = false;
	private tickTimer: number | null = null;

	get isPlaying(): boolean {
		return this.playing;
	}

	get hasEnded(): boolean {
		return this.ended;
	}

	get duration(): number {
		return this.buffer?.duration ?? 0;
	}

	currentTime(): number {
		if (!this.playing || !this.context) return this.offsetSec;
		const elapsed = (this.context.currentTime - this.startedAt) * this.rate;
		const next = this.offsetSec + Math.max(0, elapsed);
		const dur = this.duration;
		if (dur > 0 && next >= dur) return dur;
		return next;
	}

	setVolume(value: number): void {
		this.volume = Math.max(0, Math.min(1, value));
		if (this.gain) this.gain.gain.value = this.volume;
	}

	setRate(value: number): void {
		const next = Number.isFinite(value) && value > 0 ? value : 1;
		const wasPlaying = this.playing;
		this.offsetSec = this.currentTime();
		this.rate = next;
		if (wasPlaying && this.buffer) {
			this.stopSource();
			this.startSource(this.offsetSec);
		}
	}

	async loadBytes(bytes: ArrayBuffer, startAt = 0): Promise<number> {
		if (bytes.byteLength === 0) {
			throw new Error('EMPTY_AUDIO_BLOB');
		}
		this.stopSource();
		this.bytes = bytes.slice(0);
		this.ended = false;
		this.buffer = await this.decode(this.bytes);
		const dur = this.buffer.duration;
		this.offsetSec =
			dur > 0 ? Math.min(Math.max(0, startAt), dur) : Math.max(0, startAt);
		return dur;
	}

	async play(): Promise<void> {
		if (!this.bytes && !this.buffer) return;
		if (this.ended) {
			this.offsetSec = 0;
			this.ended = false;
		}
		if (!this.buffer || !this.context || this.context.state === 'closed') {
			if (!this.bytes) return;
			this.buffer = await this.decode(this.bytes);
		}
		this.startSource(this.offsetSec);
	}

	pause(): void {
		this.offsetSec = this.currentTime();
		this.playing = false;
		this.stopSource();
		this.releaseContext();
		this.emit();
	}

	seek(time: number, resume: boolean): void {
		const dur = this.duration;
		const safe = Number.isFinite(time) ? Math.max(0, time) : 0;
		this.offsetSec = dur > 0 ? Math.min(safe, dur) : safe;
		this.ended = dur > 0 && this.offsetSec >= dur - 0.01;
		this.stopSource();
		this.playing = false;
		if (resume && !this.ended) {
			void this.play();
			return;
		}
		this.releaseContext();
		this.emit();
	}

	stop(): void {
		this.playing = false;
		this.ended = false;
		this.offsetSec = 0;
		this.buffer = null;
		this.bytes = null;
		this.loadedTrackId = null;
		this.onTick = null;
		this.onNaturalEnd = null;
		this.stopSource();
		this.releaseContext();
	}

	private async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
		const ctx = this.ensureContext();
		if (ctx.state === 'suspended') {
			await ctx.resume();
		}
		try {
			const copy = bytes.slice(0);
			const decoded = await ctx.decodeAudioData(copy);
			if (
				!decoded ||
				decoded.duration <= 0 ||
				!Number.isFinite(decoded.duration)
			) {
				throw new Error('AUDIO_DECODE_ERROR');
			}
			return decoded;
		} catch (error: unknown) {
			this.releaseContext();
			this.buffer = null;
			if (
				error instanceof Error &&
				(error.message === 'EMPTY_AUDIO_BLOB' ||
					error.message === 'AUDIO_DECODE_ERROR')
			) {
				throw error;
			}
			throw new Error('AUDIO_DECODE_ERROR');
		}
	}

	private ensureContext(): AudioContext {
		if (this.context && this.context.state !== 'closed') return this.context;
		const Ctor = audioContextCtor();
		if (!Ctor) {
			throw new Error('AUDIO_DECODE_ERROR');
		}
		this.context = new Ctor();
		this.gain = this.context.createGain();
		this.gain.gain.value = this.volume;
		this.gain.connect(this.context.destination);
		return this.context;
	}

	private startSource(offset: number): void {
		if (!this.buffer || !this.gain) return;
		const ctx = this.ensureContext();
		void ctx.resume();
		this.stopSource();
		const source = ctx.createBufferSource();
		source.buffer = this.buffer;
		source.playbackRate.value = this.rate;
		source.connect(this.gain);
		this.intentionalStop = false;
		source.onended = () => {
			if (this.intentionalStop) return;
			this.playing = false;
			this.ended = true;
			this.offsetSec = this.duration;
			this.stopTick();
			this.releaseContext();
			this.emit();
			this.onNaturalEnd?.();
		};
		const startOffset = Math.min(Math.max(0, offset), this.buffer.duration);
		source.start(0, startOffset);
		this.source = source;
		this.startedAt = ctx.currentTime;
		this.offsetSec = startOffset;
		this.playing = true;
		this.ended = false;
		this.startTick();
		this.emit();
	}

	private stopSource(): void {
		this.intentionalStop = true;
		const source = this.source;
		this.source = null;
		this.stopTick();
		if (!source) return;
		try {
			source.onended = null;
			source.stop();
		} catch {
			/* already stopped */
		}
		try {
			source.disconnect();
		} catch {
			/* already disconnected */
		}
	}

	private releaseContext(): void {
		const ctx = this.context;
		this.context = null;
		this.gain = null;
		this.buffer = null;
		if (ctx && ctx.state !== 'closed') {
			void ctx.close();
		}
	}

	private startTick(): void {
		this.stopTick();
		this.tickTimer = window.setInterval(() => this.emit(), 250);
	}

	private stopTick(): void {
		if (this.tickTimer != null) {
			window.clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private emit(): void {
		this.onTick?.({
			currentTime: this.currentTime(),
			duration: this.duration,
			playing: this.playing,
		});
	}
}

export const foflineNowPlaying = new FoflineDecodedPlayback();
