/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global desktop now-playing provider mounting the shared `<audio>` element and contexts.
 *
 * Invariants:
 * - Single transport context + time context split to limit rerenders.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 */

import { useRef, type ReactNode } from 'react';
import { NowPlayingTimeContext, NowPlayingTransportContext } from './contexts';
import { useNowPlayingController } from './useNowPlayingController';

interface NowPlayingProviderProps {
	children: ReactNode;
}

export function NowPlayingProvider({ children }: NowPlayingProviderProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const { state, transportValue } = useNowPlayingController(audioRef);

	return (
		<NowPlayingTransportContext.Provider value={transportValue}>
			<NowPlayingTimeContext.Provider value={state.currentTime}>
				<audio ref={audioRef} preload="metadata">
					<track kind="captions" />
				</audio>
				{children}
			</NowPlayingTimeContext.Provider>
		</NowPlayingTransportContext.Provider>
	);
}
