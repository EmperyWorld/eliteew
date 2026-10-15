/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Music Player track playback, context-menu, favorite feedback, and catalog deletion actions.
 *
 * Invariants:
 * - Catalog deletion clears current playback, queue, and every playlist reference.
 * - Favorite feedback remains non-modal and does not steal list focus.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/Desktop/context/MusicLibraryContext.tsx
 */

import { notify } from '@/notifications';
import type { TFunction } from 'i18next';
import {
	startTransition,
	type Dispatch,
	type MouseEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from 'react';
import type { Content } from '../../components/UnifiedContent/types';
import { contentApi } from '../../services/contentApi';
import { getApiErrorMessage } from '../../utils/apiError';
import type { MusicDomainTrack } from '../Desktop/context/MusicPlaybackDomainContext';
import type { NowPlayingTransportValue } from '../Desktop/context/NowPlayingContext';

export interface UseMusicPlayerTrackActionsOptions {
	transport: NowPlayingTransportValue;
	playTrackFromDomain: (track: MusicDomainTrack) => void;
	upsertTrack: (track: MusicDomainTrack) => void;
	favoriteIdsSet: Set<string>;
	toggleFavorite: (trackId: string) => void;
	removeFromQueue: (trackId: string) => void;
	removeTrackFromPlaylists: (trackId: string) => void;
	setTracks: Dispatch<SetStateAction<Content[]>>;
	setTotal: Dispatch<SetStateAction<number>>;
	t: TFunction<'desktopUi'>;
}

export function useMusicPlayerTrackActions({
	transport,
	playTrackFromDomain,
	upsertTrack,
	favoriteIdsSet,
	toggleFavorite,
	removeFromQueue,
	removeTrackFromPlaylists,
	setTracks,
	setTotal,
	t,
}: UseMusicPlayerTrackActionsOptions) {
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		track: Content;
	} | null>(null);
	const [deleteTrackConfirm, setDeleteTrackConfirm] = useState<Content | null>(
		null
	);
	const [favoriteFeedback, setFavoriteFeedback] = useState<string | null>(null);

	useEffect(() => {
		if (!favoriteFeedback) return;
		const timeout = window.setTimeout(() => {
			setFavoriteFeedback(null);
		}, 1600);
		return () => window.clearTimeout(timeout);
	}, [favoriteFeedback]);

	const dismissContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const handlePlayTrack = useCallback(
		(item: Content) => {
			const version = item.file_hash ?? item.updated_at;
			const track = {
				id: item.id,
				name: item.name,
				thumbnail_url: item.thumbnail_url ?? null,
				version,
			};
			upsertTrack(track);
			playTrackFromDomain(track);
		},
		[playTrackFromDomain, upsertTrack]
	);

	const handleTrackRowContextMenu = useCallback(
		(event: MouseEvent, item: Content) => {
			event.preventDefault();
			event.stopPropagation();
			setContextMenu({
				x: event.clientX,
				y: event.clientY,
				track: item,
			});
		},
		[]
	);

	const handleDeleteTrackFromLibrary = useCallback(
		(track: Content) => {
			setDeleteTrackConfirm(track);
			dismissContextMenu();
		},
		[dismissContextMenu]
	);

	const confirmDeleteTrackFromLibrary = useCallback(async () => {
		const track = deleteTrackConfirm;
		if (!track) return;
		try {
			await contentApi.deleteContent(track.id);
			if (transport.track?.id === track.id) {
				transport.setTrack(null);
			}
			setTracks((previous) => previous.filter((item) => item.id !== track.id));
			setTotal((total) => Math.max(0, total - 1));
			removeFromQueue(track.id);
			removeTrackFromPlaylists(track.id);
			notify.success(t('musicPlayer.notifications.trackDeleted'));
		} catch (error) {
			notify.error(
				t('musicPlayer.notifications.trackDeleteFailedTitle'),
				getApiErrorMessage(error)
			);
		} finally {
			setDeleteTrackConfirm(null);
		}
	}, [
		deleteTrackConfirm,
		removeFromQueue,
		removeTrackFromPlaylists,
		setTotal,
		setTracks,
		t,
		transport,
	]);

	const toggleFavoriteWithFeedback = useCallback(
		(trackId: string) => {
			const wasFavorite = favoriteIdsSet.has(trackId);
			startTransition(() => toggleFavorite(trackId));
			setFavoriteFeedback(
				wasFavorite
					? t('musicPlayer.notifications.favoriteRemoved')
					: t('musicPlayer.notifications.favoriteAdded')
			);
		},
		[favoriteIdsSet, t, toggleFavorite]
	);

	const handleToggleFavorite = useCallback(
		(event: MouseEvent, item: Content) => {
			event.preventDefault();
			event.stopPropagation();
			toggleFavoriteWithFeedback(item.id);
		},
		[toggleFavoriteWithFeedback]
	);

	const closeDeleteTrackConfirm = useCallback(() => {
		setDeleteTrackConfirm(null);
	}, []);

	return {
		contextMenu,
		deleteTrackConfirm,
		favoriteFeedback,
		dismissContextMenu,
		handlePlayTrack,
		handleTrackRowContextMenu,
		handleDeleteTrackFromLibrary,
		confirmDeleteTrackFromLibrary,
		toggleFavoriteWithFeedback,
		handleToggleFavorite,
		closeDeleteTrackConfirm,
	};
}
