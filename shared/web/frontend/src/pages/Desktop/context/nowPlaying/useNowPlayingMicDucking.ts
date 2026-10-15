/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mic-active ducking subscription and smoothed volume ramp on the shared audio element.
 *
 * Invariants:
 * - Ducking adjusts runtime gain only; user volume preference is unchanged in state.
 *
 * Related:
 * - src/voice-core/micActive.ts
 */

import {
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type RefObject,
} from 'react';
import { subscribeToMicActive } from '../../../../voice-core/micActive';
import {
	foflineNowPlaying,
	isFoflineSpaWebAudioHost,
} from '../../../../services/audio/foflineDecodedPlayback';
import { DUCK_TRANSITION_MS, DUCK_VOLUME } from './constants';

export function useNowPlayingMicDucking(
	audioRef: RefObject<HTMLAudioElement | null>,
	volume: number
): {
	micDucking: boolean;
	lastVolumeTargetRef: MutableRefObject<number | null>;
} {
	const [micDucking, setMicDucking] = useState(false);
	const micActiveRef = useRef(false);
	const lastVolumeTargetRef = useRef<number | null>(null);

	useEffect(() => {
		return subscribeToMicActive((active) => {
			micActiveRef.current = active;
			setMicDucking(active);
		});
	}, []);

	useEffect(() => {
		const targetVolume = volume * (micDucking ? DUCK_VOLUME : 1);
		const audio = audioRef.current;
		if (!audio) return;

		const fromVolume =
			lastVolumeTargetRef.current ?? volume * (micDucking ? DUCK_VOLUME : 1);
		lastVolumeTargetRef.current = targetVolume;
		const startTime = performance.now();

		const tick = (): void => {
			const elapsed = performance.now() - startTime;
			const t = Math.min(1, elapsed / DUCK_TRANSITION_MS);
			const smooth = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
			audio.volume = fromVolume + (targetVolume - fromVolume) * smooth;
			if (isFoflineSpaWebAudioHost()) {
				foflineNowPlaying.setVolume(audio.volume);
			}
			if (t < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}, [audioRef, volume, micDucking]);

	return { micDucking, lastVolumeTargetRef };
}
