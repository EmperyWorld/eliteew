/**
 * Звуки интерфейса GAF Chat (Web Audio, без файлов).
 * Один общий AudioContext — см. сброс в {@link GAFChatProvider} при выходе.
 */
import { getGafChatSoundEnabledForBeep } from './gafChatShellSound';
import {
	hasDesktopAudioUserGesture,
	shouldPlayNotificationSound,
} from './notificationSound';

let audioContextRef: AudioContext | null = null;

function getAudioContextCtor(): typeof AudioContext | undefined {
	if (typeof window === 'undefined') return undefined;
	const win = window as Window & { webkitAudioContext?: typeof AudioContext };
	return (window.AudioContext || win.webkitAudioContext) as
		| typeof AudioContext
		| undefined;
}

async function ensureRunningContext(options?: {
	/** Urgent call ringing should not depend on the normal GAF message sound toggle. */
	force?: boolean;
}): Promise<AudioContext | null> {
	if (
		!options?.force &&
		(!getGafChatSoundEnabledForBeep() || !shouldPlayNotificationSound())
	) {
		return null;
	}
	const Ctor = getAudioContextCtor();
	if (!Ctor) return null;
	let ctx = audioContextRef;
	if (!ctx || ctx.state === 'closed') {
		if (!options?.force && !hasDesktopAudioUserGesture()) {
			return null;
		}
		ctx = new Ctor();
		audioContextRef = ctx;
	}
	if (ctx.state === 'suspended') {
		if (!options?.force && !hasDesktopAudioUserGesture()) {
			return null;
		}
		await ctx.resume().catch(() => {});
	}
	if (ctx.state !== 'running') return null;
	return ctx;
}

/** Закрыть контекст (logout / смена сессии). */
export function closeGafChatUiSoundsAudioContext(): void {
	const ctx = audioContextRef;
	audioContextRef = null;
	void ctx?.close().catch(() => {});
}

function beep(
	ctx: AudioContext,
	freq: number,
	start: number,
	duration: number,
	gainPeak: number
): void {
	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();
	oscillator.type = 'sine';
	oscillator.frequency.value = freq;
	const t0 = ctx.currentTime + start;
	gainNode.gain.setValueAtTime(0.0001, t0);
	gainNode.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
	gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);
	oscillator.start(t0);
	oscillator.stop(t0 + duration + 0.02);
	oscillator.onended = () => {
		try {
			oscillator.disconnect();
			gainNode.disconnect();
		} catch {
			/* ignore */
		}
	};
}

/** Фоновый входящий (как раньше в провайдере): короткий 880 Hz. */
export async function playGafStandardIncomingBeepNow(): Promise<void> {
	const ctx = await ensureRunningContext();
	if (!ctx) return;
	beep(ctx, 880, 0, 0.15, 0.2);
}

/** Входящее, пока открыт этот чат: два более низких тона. */
export async function playGafReceiveOpenThreadSoundNow(): Promise<void> {
	const ctx = await ensureRunningContext();
	if (!ctx) return;
	beep(ctx, 523, 0, 0.1, 0.16);
	beep(ctx, 659, 0.11, 0.12, 0.14);
}

/** Входящий видеозвонок: мягкий двухтактный рингтон (Web Audio, без файлов). */
export async function playGafVideoCallRingNow(options?: {
	force?: boolean;
}): Promise<void> {
	const ctx = await ensureRunningContext(options);
	if (!ctx) return;
	// Soft descending pair, then a gentle answer tone — less piercing than 740/988 square beeps.
	beep(ctx, 523.25, 0, 0.22, 0.12);
	beep(ctx, 659.25, 0.14, 0.26, 0.11);
	beep(ctx, 587.33, 0.52, 0.2, 0.1);
	beep(ctx, 783.99, 0.68, 0.28, 0.09);
}

/** Успешная отправка сообщения: короткий «щелчок» вверх. */
export async function playGafSendSoundNow(): Promise<void> {
	const ctx = await ensureRunningContext();
	if (!ctx) return;
	beep(ctx, 1040, 0, 0.06, 0.12);
	beep(ctx, 1320, 0.05, 0.07, 0.1);
}
