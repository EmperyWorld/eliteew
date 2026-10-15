/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Applies Music Player A–B loop boundaries while subscribing only to playback time ticks.
 *
 * Invariants:
 * - Invalid or incomplete loop bounds never seek.
 * - The page orchestrator stays unsubscribed from `currentTime` updates.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 */

import { useEffect } from 'react';
import {
	useNowPlayingTime,
	useNowPlayingTransport,
} from '../Desktop/context/NowPlayingContext';

export interface MusicPlayerAbLoopEffectProps {
	loopStart: number | null;
	loopEnd: number | null;
}

export function MusicPlayerAbLoopEffect({
	loopStart,
	loopEnd,
}: MusicPlayerAbLoopEffectProps) {
	const currentTime = useNowPlayingTime();
	const { playing, seek } = useNowPlayingTransport();

	useEffect(() => {
		if (
			loopStart == null ||
			loopEnd == null ||
			!playing ||
			!Number.isFinite(currentTime)
		) {
			return;
		}
		if (currentTime > loopEnd && loopEnd > loopStart) {
			seek(loopStart);
		}
	}, [loopStart, loopEnd, playing, currentTime, seek]);

	return null;
}
