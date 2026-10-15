/**
 * Global registry for "duck music" – microphone in use and/or TTS playback.
 * When any consumer has mic active or is playing AI voice TTS, music is ducked.
 */

const MIC_ACTIVE_CHANGE = 'eliteew-mic-active-change';

let count = 0;
const listeners = new Set<(active: boolean) => void>();

function notify(): void {
	const active = count > 0;
	for (const cb of listeners) {
		cb(active);
	}
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent(MIC_ACTIVE_CHANGE, { detail: { active } })
		);
	}
}

function register(): () => void {
	count += 1;
	notify();
	return () => {
		count = Math.max(0, count - 1);
		notify();
	};
}

/** Call when starting to use the microphone. Returns cleanup to call when done. */
export function registerMicActive(): () => void {
	return register();
}

/** Call when starting TTS/voice playback (AI response). Returns cleanup to call when playback ends. */
export function registerTtsPlaying(): () => void {
	return register();
}

export function subscribeToMicActive(
	callback: (active: boolean) => void
): () => void {
	listeners.add(callback);
	callback(count > 0);
	return () => {
		listeners.delete(callback);
	};
}

export function getMicActive(): boolean {
	return count > 0;
}

export const MIC_ACTIVE_CHANGE_EVENT = MIC_ACTIVE_CHANGE;
