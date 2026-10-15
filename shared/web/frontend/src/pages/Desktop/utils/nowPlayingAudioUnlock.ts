/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bridge user activation across an **async** gap before a new now-playing `src` is attached
 * (ticket/blob fetch). Not for sync resume / seek / in-place play on an already-loaded track.
 *
 * Invariants:
 * - Runs only while `navigator.userActivation.isActive` (sync click stack).
 * - Uses muted play/pause on the **current** src; deferred pause must not stop audible playback
 *   when callers keep the same src (resume) — those paths must not call this helper.
 * - Must not leave audible output muted if a newer session owns the element.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/useNowPlayingController.ts
 * - src/pages/Desktop/utils/notificationSound.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Autoplay unlock race
 */

function hasActiveUserActivation(): boolean {
	if (typeof navigator === 'undefined') return false;
	const activation = (
		navigator as Navigator & {
			userActivation?: { isActive?: boolean };
		}
	).userActivation;
	return activation?.isActive === true;
}

type UnlockOwner = {
	token: number;
	srcAtCapture: string;
	previousMuted: boolean;
};

const unlockOwnerByAudio = new WeakMap<HTMLAudioElement, UnlockOwner>();
let unlockTokenSeq = 0;

function restoreMutedIfStillOwner(
	audio: HTMLAudioElement,
	token: number,
	previousMuted: boolean
): void {
	const owner = unlockOwnerByAudio.get(audio);
	if (!owner || owner.token !== token) return;
	audio.muted = previousMuted;
	unlockOwnerByAudio.delete(audio);
}

/**
 * Unlock programmatic playback for a later `play()` after await/fetch.
 * Call only before tearing down / replacing `src` across an async boundary.
 *
 * Do **not** call before sync `audio.play()` on an already-loaded track: deferred
 * `pause()` sees unchanged `src` and stops audible resume (~ms of sound → Pause).
 *
 * Race: unlock `then(pause)` must not stop a real track that already replaced `src`,
 * and must not leave `muted=true` if a newer session owns the element.
 */
export function captureNowPlayingUserActivation(audio: HTMLAudioElement): void {
	if (!hasActiveUserActivation()) return;
	const token = ++unlockTokenSeq;
	const existing = unlockOwnerByAudio.get(audio);
	// Nested unlock while still muted from a prior capture must restore the
	// pre-unlock mute preference, not the temporary unlock mute.
	const previousMuted = existing?.previousMuted ?? audio.muted;
	const srcAtCapture = audio.getAttribute('src') ?? audio.src ?? '';
	unlockOwnerByAudio.set(audio, { token, srcAtCapture, previousMuted });
	audio.muted = true;
	const playPromise = audio.play();
	if (!playPromise) {
		restoreMutedIfStillOwner(audio, token, previousMuted);
		return;
	}
	playPromise
		.then(() => {
			const owner = unlockOwnerByAudio.get(audio);
			if (!owner || owner.token !== token) {
				return;
			}
			const srcNow = audio.getAttribute('src') ?? audio.src ?? '';
			// Real track attached after unlock — never pause; only clear our mute.
			if (srcNow !== srcAtCapture) {
				audio.muted = previousMuted;
				unlockOwnerByAudio.delete(audio);
				return;
			}
			audio.pause();
			audio.muted = previousMuted;
			unlockOwnerByAudio.delete(audio);
		})
		.catch(() => {
			restoreMutedIfStillOwner(audio, token, previousMuted);
		});
}
