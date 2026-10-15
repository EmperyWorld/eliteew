/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for desktop now-playing context (P33 atomization).
 * Implementation lives in `./nowPlaying/*`.
 *
 * Invariants:
 * - Public imports remain on this path; zero consumer path changes.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - src/pages/Desktop/context/nowPlayingStateTransitions.ts
 */

export { NOW_PLAYING_LOAD_STALL_MS } from './nowPlaying/constants';
export type {
	NowPlayingContextValue,
	NowPlayingDiagnostics,
	NowPlayingTrack,
	NowPlayingTransportValue,
} from './nowPlaying/types';
export {
	useNowPlaying,
	useNowPlayingTime,
	useNowPlayingTransport,
} from './nowPlaying/contexts';
export { NowPlayingProvider } from './nowPlaying/NowPlayingProvider';
