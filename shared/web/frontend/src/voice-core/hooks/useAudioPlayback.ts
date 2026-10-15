/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Очередь воспроизведения голосовых ответов (URL → Audio) с ducking через `registerTtsPlaying`.
 *
 * Invariants:
 * - Inline `data:` URL подготавливаем через `resolveAudioUrlForPlayback`; при ошибке нормализации — снимаем TTS lock и пропускаем трек.
 *
 * Related:
 * - `resolveAudioUrlForPlayback.ts`, `micActive.ts`.
 */

import { useCallback, useRef, useState } from 'react';
import { registerTtsPlaying } from '../micActive';
import {
	foflineNowPlaying,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '@/services/audio/foflineDecodedPlayback';
import { resolveAudioUrlForPlayback } from '../utils/resolveAudioUrlForPlayback';

export interface UseAudioPlaybackReturn {
	isPlaying: boolean;
	currentUrl: string | null;
	play: (url: string) => Promise<void>;
	stop: () => void;
	replay: () => Promise<void>;
	/** Append URL to queue and start playing if idle. */
	enqueue: (url: string) => void;
	clearQueue: () => void;
}

export function useAudioPlayback(): UseAudioPlaybackReturn {
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentUrl, setCurrentUrl] = useState<string | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const queueRef = useRef<string[]>([]);
	const currentUrlRef = useRef<string | null>(null);
	const unregisterTtsRef = useRef<(() => void) | null>(null);
	const revokePlaybackRef = useRef<(() => void) | null>(null);

	const stop = useCallback((): void => {
		unregisterTtsRef.current?.();
		unregisterTtsRef.current = null;
		revokePlaybackRef.current?.();
		revokePlaybackRef.current = null;
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			releaseHtmlMediaElement(audioRef.current);
			audioRef.current = null;
		}
		if (isFoflineSpaWebAudioHost()) {
			foflineNowPlaying.stop();
		}
		queueRef.current = [];
		currentUrlRef.current = null;
		setCurrentUrl(null);
		setIsPlaying(false);
	}, []);

	const playNextInQueue = useCallback((): void => {
		const next = queueRef.current.shift();
		if (next) {
			void (async (): Promise<void> => {
				unregisterTtsRef.current?.();
				unregisterTtsRef.current = registerTtsPlaying();
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;

				let playUrl: string;
				let revoke: () => void;
				try {
					const resolved = await resolveAudioUrlForPlayback(next);
					playUrl = resolved.playUrl;
					revoke = resolved.revoke;
				} catch {
					unregisterTtsRef.current?.();
					unregisterTtsRef.current = null;
					if (queueRef.current.length > 0) playNextInQueue();
					else {
						setIsPlaying(false);
						setCurrentUrl(null);
						currentUrlRef.current = null;
					}
					return;
				}
				revokePlaybackRef.current = revoke;

				currentUrlRef.current = next;
				setCurrentUrl(next);
				setIsPlaying(true);
				if (isFoflineSpaWebAudioHost()) {
					try {
						const response = await fetch(playUrl);
						if (!response.ok) throw new Error('AUDIO_DECODE_ERROR');
						const bytes = await response.arrayBuffer();
						await foflineNowPlaying.loadBytes(bytes, 0);
						foflineNowPlaying.onNaturalEnd = () => {
							revokePlaybackRef.current?.();
							revokePlaybackRef.current = null;
							if (queueRef.current.length > 0) {
								playNextInQueue();
							} else {
								unregisterTtsRef.current?.();
								unregisterTtsRef.current = null;
								setIsPlaying(false);
								setCurrentUrl(null);
								currentUrlRef.current = null;
							}
						};
						await foflineNowPlaying.play();
					} catch {
						revokePlaybackRef.current?.();
						revokePlaybackRef.current = null;
						unregisterTtsRef.current?.();
						unregisterTtsRef.current = null;
						if (queueRef.current.length > 0) playNextInQueue();
						else {
							setIsPlaying(false);
							setCurrentUrl(null);
							currentUrlRef.current = null;
						}
					}
					return;
				}
				const audio = new Audio(playUrl);
				audioRef.current = audio;
				setIsPlaying(true);
				audio.onended = (): void => {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					audioRef.current = null;
					if (queueRef.current.length > 0) {
						playNextInQueue();
					} else {
						unregisterTtsRef.current?.();
						unregisterTtsRef.current = null;
						setIsPlaying(false);
						setCurrentUrl(null);
						currentUrlRef.current = null;
					}
				};
				audio.onerror = (): void => {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					audioRef.current = null;
					unregisterTtsRef.current?.();
					unregisterTtsRef.current = null;
					if (queueRef.current.length > 0) playNextInQueue();
					else {
						setIsPlaying(false);
						setCurrentUrl(null);
						currentUrlRef.current = null;
					}
				};
				try {
					await audio.play();
				} catch {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					unregisterTtsRef.current?.();
					unregisterTtsRef.current = null;
					audioRef.current = null;
					setIsPlaying(false);
					setCurrentUrl(null);
					currentUrlRef.current = null;
				}
			})();
		} else {
			setIsPlaying(false);
			setCurrentUrl(null);
			currentUrlRef.current = null;
		}
	}, []);

	const play = useCallback(
		async (url: string): Promise<void> => {
			stop();
			queueRef.current = [url];
			playNextInQueue();
		},
		[stop, playNextInQueue]
	);

	const replay = useCallback(async (): Promise<void> => {
		const url = currentUrlRef.current;
		if (url) await play(url);
	}, [play]);

	const enqueue = useCallback(
		(url: string): void => {
			queueRef.current.push(url);
			if (!audioRef.current && queueRef.current.length === 1) {
				playNextInQueue();
			}
		},
		[playNextInQueue]
	);

	const clearQueue = useCallback((): void => {
		queueRef.current = [];
		if (!audioRef.current) {
			setCurrentUrl(null);
			currentUrlRef.current = null;
			setIsPlaying(false);
		}
	}, []);

	return {
		isPlaying,
		currentUrl,
		play,
		stop,
		replay,
		enqueue,
		clearQueue,
	};
}
