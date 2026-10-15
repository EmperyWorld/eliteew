/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React contexts and consumer hooks for now-playing transport vs time tick split.
 *
 * Invariants:
 * - Transport context excludes `currentTime` to reduce list/header rerenders.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/NowPlayingProvider.tsx
 */

import { createContext, useContext, useMemo } from 'react';
import {
	defaultTransportValue,
	type NowPlayingContextValue,
	type NowPlayingTransportValue,
} from './types';

export const NowPlayingTransportContext =
	createContext<NowPlayingTransportValue>(defaultTransportValue);
export const NowPlayingTimeContext = createContext<number>(0);

/** Полное значение (включая `currentTime` на каждом тике). Для списков/шапки предпочтительнее {@link useNowPlayingTransport}. */
export function useNowPlaying(): NowPlayingContextValue {
	const transport = useContext(NowPlayingTransportContext);
	const currentTime = useContext(NowPlayingTimeContext);
	return useMemo(() => {
		const { getCurrentTime: _get, ...rest } = transport;
		return { ...rest, currentTime };
	}, [transport, currentTime]);
}

export function useNowPlayingTransport(): NowPlayingTransportValue {
	return useContext(NowPlayingTransportContext);
}

export function useNowPlayingTime(): number {
	return useContext(NowPlayingTimeContext);
}
