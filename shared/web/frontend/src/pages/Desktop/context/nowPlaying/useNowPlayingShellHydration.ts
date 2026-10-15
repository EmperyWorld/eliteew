/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-state hydration and legacy localStorage migration for now-playing on mount.
 *
 * Invariants:
 * - `shellHydratedRef` flips true only after fetch/migration attempt completes.
 *
 * Related:
 * - src/pages/Desktop/services/desktopApi.ts
 */

import {
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
} from '../../utils/desktopShellStateMutationPipeline';
import { writeNowPlayingPositionSession } from '../../utils/nowPlayingPositionSession';
import {
	fetchDesktopShellStateDeduplicated,
	type DesktopNowPlayingShellState,
} from '../../services/desktopApi';
import { LEGACY_LOCAL_STORAGE_KEY } from './constants';
import {
	buildNowPlayingShellPatch,
	loadLegacyLocalStorage,
	parseShellNowPlaying,
	resolveHydratedCurrentTime,
} from './persistHelpers';
import type { NowPlayingState } from './types';

export function useNowPlayingShellHydration(
	setState: Dispatch<SetStateAction<NowPlayingState>>,
	shellHydratedRef: MutableRefObject<boolean>
): void {
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const s = await fetchDesktopShellStateDeduplicated();
				if (cancelled) return;
				const np = s.now_playing;
				if (np != null && typeof np === 'object') {
					const parsed = parseShellNowPlaying(
						np as unknown as DesktopNowPlayingShellState
					);
					if (parsed) {
						const hydratedTime = resolveHydratedCurrentTime(
							parsed.track,
							parsed.legacyCurrentTime
						);
						setState((prev) => ({
							...prev,
							track: parsed.track,
							currentTime: hydratedTime,
							volume: parsed.volume,
							playing: false,
							duration: 0,
							isLoading: false,
							isLoadingStalled: false,
							error: null,
							errorTrackId: null,
							diagnostics: {
								trackId: parsed.track?.id ?? null,
								sourceSurface: parsed.track?.source_surface ?? 'unknown',
								cacheSource: null,
								loadingStage: 'idle',
								errorCategory: null,
							},
						}));
					}
				} else {
					const leg = loadLegacyLocalStorage();
					if (leg?.track) {
						if (leg.currentTime > 0) {
							writeNowPlayingPositionSession(leg.track.id, leg.currentTime);
						}
						scheduleShellStateMutation({
							source: 'nowPlaying',
							merge: () =>
								buildNowPlayingShellPatch(leg.track, leg.volume) as Record<
									string,
									unknown
								>,
							immediate: true,
						});
						await flushShellStatePipelineNow('nowPlaying').catch(() => {});
					}
				}
				try {
					localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
				} catch {
					/* ignore */
				}
			} catch {
				/* offline: keep initializer from legacy storage */
			} finally {
				if (!cancelled) {
					shellHydratedRef.current = true;
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [setState, shellHydratedRef]);
}
