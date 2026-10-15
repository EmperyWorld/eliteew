/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Procedural Web Audio ambient bus for Empery Nexus Chronicle (no binary assets).
 *
 * Invariants:
 * - Mute persisted in localStorage; reduced-motion ⇒ no auto audio.
 * - start() may require a user gesture; callers handle unlock.
 *
 * Related:
 * - EmperyNexusChroniclePage.tsx
 */

export const AMBIENT_MUTE_KEY = 'eliteew.emperyNexus.ambientMuted.v1';

export type AmbientMode = 'off' | 'coldOpen' | 'atlas' | 'pulse';

function readMuted(): boolean {
	try {
		return localStorage.getItem(AMBIENT_MUTE_KEY) === '1';
	} catch {
		return false;
	}
}

function writeMuted(muted: boolean): void {
	try {
		localStorage.setItem(AMBIENT_MUTE_KEY, muted ? '1' : '0');
	} catch {
		/* ignore */
	}
}

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class ChronicleAmbientBus {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private oscA: OscillatorNode | null = null;
	private oscB: OscillatorNode | null = null;
	private noise: AudioBufferSourceNode | null = null;
	private filter: BiquadFilterNode | null = null;
	private muted = readMuted();
	private mode: AmbientMode = 'off';
	private started = false;

	isMuted(): boolean {
		return this.muted;
	}

	/** True when bed may play but browser still blocks until a user gesture. */
	needsGesture(): boolean {
		if (this.muted || prefersReducedMotion()) return false;
		if (!this.ctx) return true;
		return this.ctx.state === 'suspended' || !this.started;
	}

	isRunning(): boolean {
		return (
			!this.muted &&
			!prefersReducedMotion() &&
			this.started &&
			this.ctx?.state === 'running'
		);
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		writeMuted(muted);
		this.applyGain();
		if (muted) {
			this.stopSources();
			this.started = false;
		}
	}

	toggleMute(): boolean {
		this.setMuted(!this.muted);
		return this.muted;
	}

	async unlock(): Promise<void> {
		if (this.muted || prefersReducedMotion()) return;
		const ctx = this.ensureCtx();
		if (ctx.state === 'suspended') {
			await ctx.resume();
		}
		if (this.mode !== 'off') {
			void this.ensurePlaying();
		}
	}

	setMode(mode: AmbientMode): void {
		this.mode = mode;
		if (this.muted || prefersReducedMotion()) {
			this.stopSources();
			return;
		}
		if (mode === 'off') {
			this.stopSources();
			this.started = false;
			return;
		}
		void this.ensurePlaying();
		this.applyModeParams();
	}

	pulseHit(): void {
		this.oneShot(110, 0.14, 0.55);
	}

	rebirthHit(): void {
		this.oneShot(55, 0.2, 1.1);
		window.setTimeout(() => this.oneShot(165, 0.1, 0.7), 180);
	}

	private oneShot(freq: number, peak: number, duration: number): void {
		if (this.muted || prefersReducedMotion() || !this.ctx || !this.master) {
			return;
		}
		const ctx = this.ctx;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = freq;
		g.gain.value = 0.0001;
		osc.connect(g);
		g.connect(this.master);
		const now = ctx.currentTime;
		g.gain.exponentialRampToValueAtTime(peak, now + 0.03);
		g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		osc.start(now);
		osc.stop(now + duration + 0.05);
	}

	dispose(): void {
		this.stopSources();
		void this.ctx?.close();
		this.ctx = null;
		this.master = null;
		this.started = false;
	}

	private ensureCtx(): AudioContext {
		if (!this.ctx) {
			const Ctx =
				window.AudioContext ||
				(
					window as unknown as {
						webkitAudioContext: typeof AudioContext;
					}
				).webkitAudioContext;
			this.ctx = new Ctx();
			this.master = this.ctx.createGain();
			this.master.connect(this.ctx.destination);
			this.applyGain();
		}
		return this.ctx;
	}

	private applyGain(): void {
		if (!this.master || !this.ctx) return;
		const target = this.muted ? 0.0001 : 0.32;
		this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
	}

	private async ensurePlaying(): Promise<void> {
		if (this.started || this.muted || prefersReducedMotion()) return;
		const ctx = this.ensureCtx();
		if (ctx.state === 'suspended') {
			try {
				await ctx.resume();
			} catch {
				return;
			}
		}
		if (this.started) return;

		this.filter = ctx.createBiquadFilter();
		this.filter.type = 'lowpass';
		this.filter.frequency.value = 420;
		this.filter.connect(this.master as GainNode);

		this.oscA = ctx.createOscillator();
		this.oscA.type = 'sine';
		this.oscA.frequency.value = 55;
		const gA = ctx.createGain();
		gA.gain.value = 0.08;
		this.oscA.connect(gA);
		gA.connect(this.filter);

		this.oscB = ctx.createOscillator();
		this.oscB.type = 'triangle';
		this.oscB.frequency.value = 82.5;
		const gB = ctx.createGain();
		gB.gain.value = 0.045;
		this.oscB.connect(gB);
		gB.connect(this.filter);

		const bufferSize = ctx.sampleRate * 2;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * 0.22;
		}
		this.noise = ctx.createBufferSource();
		this.noise.buffer = buffer;
		this.noise.loop = true;
		const gN = ctx.createGain();
		gN.gain.value = 0.028;
		this.noise.connect(gN);
		gN.connect(this.filter);

		this.oscA.start();
		this.oscB.start();
		this.noise.start();
		this.started = true;
		this.applyModeParams();
	}

	private applyModeParams(): void {
		if (!this.filter || !this.ctx || !this.oscA || !this.oscB) return;
		const now = this.ctx.currentTime;
		if (this.mode === 'coldOpen') {
			this.filter.frequency.setTargetAtTime(520, now, 0.4);
			this.oscA.frequency.setTargetAtTime(49, now, 0.4);
			this.oscB.frequency.setTargetAtTime(73.5, now, 0.4);
		} else if (this.mode === 'atlas') {
			this.filter.frequency.setTargetAtTime(380, now, 0.5);
			this.oscA.frequency.setTargetAtTime(55, now, 0.5);
			this.oscB.frequency.setTargetAtTime(82.5, now, 0.5);
		}
	}

	private stopSources(): void {
		try {
			this.oscA?.stop();
			this.oscB?.stop();
			this.noise?.stop();
		} catch {
			/* already stopped */
		}
		this.oscA = null;
		this.oscB = null;
		this.noise = null;
		this.filter = null;
		this.started = false;
	}
}

export const chronicleAmbientBus = new ChronicleAmbientBus();
