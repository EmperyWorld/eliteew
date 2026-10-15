/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns foreground Music Player keyboard shortcuts, search focus, relative seek, and shortcuts modal Escape handling.
 *
 * Invariants:
 * - Transport shortcuts run only for the foreground Music Player window.
 * - Inputs, textareas, and content-editable targets are never intercepted.
 * - Opening the shortcuts modal suspends transport shortcuts.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/MusicPlayerDialogs.tsx
 */

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from 'react';
import type { MusicRepeatMode } from '../Desktop/context/MusicPlaybackDomainContext';
import type { NowPlayingTransportValue } from '../Desktop/context/NowPlayingContext';

export interface UseMusicPlayerPageShortcutsOptions {
	isForegroundWindow: boolean;
	transport: NowPlayingTransportValue;
	seekStepSeconds: 5 | 10 | 30;
	setRepeat: Dispatch<SetStateAction<MusicRepeatMode>>;
	setShuffle: Dispatch<SetStateAction<boolean>>;
}

export function useMusicPlayerPageShortcuts({
	isForegroundWindow,
	transport,
	seekStepSeconds,
	setRepeat,
	setShuffle,
}: UseMusicPlayerPageShortcutsOptions) {
	const searchInputRef = useRef<HTMLInputElement>(null);
	const transportRef = useRef(transport);
	transportRef.current = transport;
	const keyboardShortcutsTitleId = useId();
	const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

	const focusSearchInput = useCallback(() => {
		const input = searchInputRef.current;
		if (!input) return;
		input.focus();
		input.select();
	}, []);

	const seekRelative = useCallback((deltaSeconds: number) => {
		const currentTransport = transportRef.current;
		const current = currentTransport.getCurrentTime();
		if (!Number.isFinite(current)) return;
		const duration =
			Number.isFinite(currentTransport.duration) &&
			currentTransport.duration > 0
				? currentTransport.duration
				: null;
		const next = Math.max(0, current + deltaSeconds);
		currentTransport.seek(duration == null ? next : Math.min(duration, next));
	}, []);

	const openKeyboardShortcuts = useCallback(() => {
		setShowKeyboardShortcuts(true);
	}, []);

	const closeKeyboardShortcuts = useCallback(() => {
		setShowKeyboardShortcuts(false);
	}, []);

	useEffect(() => {
		if (!isForegroundWindow) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (showKeyboardShortcuts) return;
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.isContentEditable)
			) {
				return;
			}
			if (
				(event.key === 'f' || event.key === 'F') &&
				(event.ctrlKey || event.metaKey)
			) {
				event.preventDefault();
				focusSearchInput();
				return;
			}

			const currentTransport = transportRef.current;
			const currentTime = currentTransport.getCurrentTime();
			switch (event.key) {
				case ' ':
					if (currentTransport.isLoading) return;
					event.preventDefault();
					currentTransport.togglePlayPause();
					break;
				case 'ArrowLeft':
					event.preventDefault();
					if (!Number.isFinite(currentTime)) return;
					seekRelative(-seekStepSeconds);
					break;
				case 'ArrowRight':
					event.preventDefault();
					if (!Number.isFinite(currentTime)) return;
					seekRelative(seekStepSeconds);
					break;
				case 'ArrowUp':
					event.preventDefault();
					currentTransport.setVolume(
						Math.min(1, currentTransport.volume + 0.1)
					);
					break;
				case 'ArrowDown':
					event.preventDefault();
					currentTransport.setVolume(
						Math.max(0, currentTransport.volume - 0.1)
					);
					break;
				case 'r':
				case 'R':
					event.preventDefault();
					setRepeat((current) =>
						current === 'none' ? 'all' : current === 'all' ? 'one' : 'none'
					);
					break;
				case 's':
				case 'S':
					event.preventDefault();
					setShuffle((current) => !current);
					break;
				case '/':
				case '?':
					event.preventDefault();
					focusSearchInput();
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		focusSearchInput,
		isForegroundWindow,
		seekRelative,
		seekStepSeconds,
		setRepeat,
		setShuffle,
		showKeyboardShortcuts,
	]);

	useEffect(() => {
		if (!showKeyboardShortcuts || !isForegroundWindow) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			setShowKeyboardShortcuts(false);
		};
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [isForegroundWindow, showKeyboardShortcuts]);

	return {
		searchInputRef,
		keyboardShortcutsTitleId,
		showKeyboardShortcuts,
		openKeyboardShortcuts,
		closeKeyboardShortcuts,
		seekRelative,
	};
}
