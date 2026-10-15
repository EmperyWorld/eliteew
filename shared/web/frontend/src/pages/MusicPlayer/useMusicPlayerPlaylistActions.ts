/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Music Player playlist create, rename, duplicate, delete, import, export, and dialog validation flows.
 *
 * Invariants:
 * - The built-in favorites playlist can only be cleared, never renamed or removed.
 * - Reserved and duplicate playlist names are rejected before persistence.
 * - Imported playlists are normalized by the existing shell-state parser.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerPlaylistsSync.ts
 */

import { notify } from '@/notifications';
import type { TFunction } from 'i18next';
import {
	startTransition,
	type ChangeEvent,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { Content } from '../../components/UnifiedContent/types';
import {
	isReservedMusicPlayerPlaylistName,
	normalizeMusicPlayerCompareText,
	playlistNamesEquivalent,
} from './musicPlayerLocale';
import { nextDuplicatePlaylistName } from './musicPlayerPlaylistNaming';
import {
	buildMusicPlaylistsExportEnvelope,
	parseMusicPlaylistsImportPayload,
} from './musicPlayerPlaylistsSync';
import { FAVORITES_PLAYLIST_ID, type SavedPlaylist } from './musicPlayerTypes';

export interface UseMusicPlayerPlaylistActionsOptions {
	playlists: SavedPlaylist[];
	persistPlaylists: (playlists: SavedPlaylist[]) => void;
	currentPlaylistId: string | null;
	setCurrentPlaylistId: Dispatch<SetStateAction<string | null>>;
	currentPlaylistEntry: SavedPlaylist | null;
	filteredTracks: Content[];
	musicPlayerLocale: string;
	t: TFunction<'desktopUi'>;
}

export function useMusicPlayerPlaylistActions({
	playlists,
	persistPlaylists,
	currentPlaylistId,
	setCurrentPlaylistId,
	currentPlaylistEntry,
	filteredTracks,
	musicPlayerLocale,
	t,
}: UseMusicPlayerPlaylistActionsOptions) {
	const playlistDialogTitleId = useId();
	const playlistImportInputRef = useRef<HTMLInputElement>(null);
	const [showPlaylistNameDialog, setShowPlaylistNameDialog] = useState(false);
	const [playlistNameDialogMode, setPlaylistNameDialogMode] = useState<
		'create' | 'rename'
	>('create');
	const [playlistNameDraft, setPlaylistNameDraft] = useState('');

	const deleteCurrentPlaylist = useCallback(() => {
		startTransition(() => {
			if (!currentPlaylistId) return;
			if (currentPlaylistId === FAVORITES_PLAYLIST_ID) {
				persistPlaylists(
					playlists.map((playlist) =>
						playlist.id === FAVORITES_PLAYLIST_ID
							? { ...playlist, trackIds: [] }
							: playlist
					)
				);
				return;
			}
			persistPlaylists(
				playlists.filter((playlist) => playlist.id !== currentPlaylistId)
			);
			setCurrentPlaylistId(null);
		});
	}, [currentPlaylistId, persistPlaylists, playlists, setCurrentPlaylistId]);

	const duplicateCurrentPlaylist = useCallback(() => {
		if (!currentPlaylistId) return;
		const selectedPlaylist =
			playlists.find((playlist) => playlist.id === currentPlaylistId) ?? null;
		if (!selectedPlaylist) return;
		const existingNamesLower = new Set(
			playlists.map((playlist) =>
				normalizeMusicPlayerCompareText(playlist.name, musicPlayerLocale)
			)
		);
		const duplicateName = nextDuplicatePlaylistName(
			selectedPlaylist.name,
			existingNamesLower,
			{
				fallbackBase: t('musicPlayer.playlistNaming.fallbackBase'),
				formatPrimary: (base) =>
					t('musicPlayer.playlistNaming.copyPrimary', { base }),
				formatIndexed: (base, index) =>
					t('musicPlayer.playlistNaming.copyIndexed', { base, index }),
			},
			musicPlayerLocale
		);
		const duplicated: SavedPlaylist = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			name: duplicateName,
			trackIds: [...selectedPlaylist.trackIds],
		};
		persistPlaylists([...playlists, duplicated]);
		setCurrentPlaylistId(duplicated.id);
	}, [
		currentPlaylistId,
		musicPlayerLocale,
		persistPlaylists,
		playlists,
		setCurrentPlaylistId,
		t,
	]);

	const exportPlaylists = useCallback(() => {
		const envelope = buildMusicPlaylistsExportEnvelope(playlists);
		const blob = new Blob([JSON.stringify(envelope, null, 2)], {
			type: 'application/json',
		});
		const objectUrl = URL.createObjectURL(blob);
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const link = document.createElement('a');
		link.href = objectUrl;
		link.download = `eliteew-music-playlists-${stamp}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(objectUrl);
		notify.success(t('musicPlayer.notifications.exportPlaylistsSuccess'));
	}, [playlists, t]);

	const triggerImportPlaylists = useCallback(() => {
		playlistImportInputRef.current?.click();
	}, []);

	const handleImportPlaylists = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0] ?? null;
			event.currentTarget.value = '';
			if (!file) return;
			try {
				const raw = await file.text();
				const imported = parseMusicPlaylistsImportPayload(raw);
				if (!imported) {
					notify.error(
						t('musicPlayer.notifications.importPlaylistsTitle'),
						t('musicPlayer.notifications.importPlaylistsInvalidJson')
					);
					return;
				}
				persistPlaylists(imported);
				if (
					currentPlaylistId &&
					!imported.some((playlist) => playlist.id === currentPlaylistId)
				) {
					setCurrentPlaylistId(null);
				}
				notify.success(t('musicPlayer.notifications.importPlaylistsSuccess'));
			} catch {
				notify.error(
					t('musicPlayer.notifications.importPlaylistsTitle'),
					t('musicPlayer.notifications.importPlaylistsReadFailed')
				);
			}
		},
		[currentPlaylistId, persistPlaylists, setCurrentPlaylistId, t]
	);

	const openCreatePlaylistDialog = useCallback(() => {
		setPlaylistNameDialogMode('create');
		setPlaylistNameDraft(t('musicPlayer.playlistDialog.newPlaylistDefault'));
		setShowPlaylistNameDialog(true);
	}, [t]);

	const openRenamePlaylistDialog = useCallback(() => {
		if (!currentPlaylistEntry) return;
		if (currentPlaylistEntry.id === FAVORITES_PLAYLIST_ID) return;
		setPlaylistNameDialogMode('rename');
		setPlaylistNameDraft(currentPlaylistEntry.name);
		setShowPlaylistNameDialog(true);
	}, [currentPlaylistEntry]);

	const playlistNameValidationMessage = useMemo(() => {
		const name = playlistNameDraft.trim();
		if (!name) {
			return t('musicPlayer.playlistDialog.validation.emptyName');
		}
		if (isReservedMusicPlayerPlaylistName(name)) {
			return t('musicPlayer.playlistDialog.validation.reservedFavorites');
		}
		const duplicateName = playlists.some((playlist) => {
			if (
				playlistNameDialogMode === 'rename' &&
				playlist.id === currentPlaylistEntry?.id
			) {
				return false;
			}
			return playlistNamesEquivalent(playlist.name, name, musicPlayerLocale);
		});
		if (duplicateName) {
			return t('musicPlayer.playlistDialog.validation.duplicateName');
		}
		if (playlistNameDialogMode === 'create') {
			if (filteredTracks.length === 0) {
				return t('musicPlayer.playlistDialog.validation.noTracksToSave');
			}
			return null;
		}
		if (!currentPlaylistEntry) {
			return t('musicPlayer.playlistDialog.validation.selectPlaylistToRename');
		}
		if (currentPlaylistEntry.id === FAVORITES_PLAYLIST_ID) {
			return t('musicPlayer.playlistDialog.validation.favoritesNotRenamable');
		}
		if (currentPlaylistEntry.name.trim() === name) {
			return t('musicPlayer.playlistDialog.validation.enterNewName');
		}
		return null;
	}, [
		currentPlaylistEntry,
		filteredTracks.length,
		musicPlayerLocale,
		playlistNameDialogMode,
		playlistNameDraft,
		playlists,
		t,
	]);

	const canConfirmPlaylistName = playlistNameValidationMessage === null;

	const confirmPlaylistNameDialog = useCallback(() => {
		const name = playlistNameDraft.trim();
		if (!name || playlistNameValidationMessage) return;
		if (playlistNameDialogMode === 'create') {
			const next: SavedPlaylist = {
				id: `${Date.now()}`,
				name,
				trackIds: filteredTracks.map((track) => track.id),
			};
			persistPlaylists([...playlists, next]);
			setCurrentPlaylistId(next.id);
			setShowPlaylistNameDialog(false);
			return;
		}
		if (!currentPlaylistEntry) return;
		persistPlaylists(
			playlists.map((playlist) =>
				playlist.id === currentPlaylistEntry.id
					? { ...playlist, name }
					: playlist
			)
		);
		setShowPlaylistNameDialog(false);
	}, [
		currentPlaylistEntry,
		filteredTracks,
		persistPlaylists,
		playlistNameDialogMode,
		playlistNameDraft,
		playlistNameValidationMessage,
		playlists,
		setCurrentPlaylistId,
	]);

	const closePlaylistNameDialog = useCallback(() => {
		setShowPlaylistNameDialog(false);
	}, []);

	return {
		playlistDialogTitleId,
		playlistImportInputRef,
		showPlaylistNameDialog,
		playlistNameDialogMode,
		playlistNameDraft,
		setPlaylistNameDraft,
		playlistNameValidationMessage,
		canConfirmPlaylistName,
		deleteCurrentPlaylist,
		duplicateCurrentPlaylist,
		exportPlaylists,
		triggerImportPlaylists,
		handleImportPlaylists,
		openCreatePlaylistDialog,
		openRenamePlaylistDialog,
		confirmPlaylistNameDialog,
		closePlaylistNameDialog,
	};
}
