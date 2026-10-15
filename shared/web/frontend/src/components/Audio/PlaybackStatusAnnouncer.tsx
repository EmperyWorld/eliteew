/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Screen-reader live announcements for playback status transitions.
 *
 * Invariants:
 * - Announces only meaningful state transitions to avoid repetitive noise.
 * - Uses polite aria-live so it does not interrupt higher-priority speech.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerNowPlayingBar.tsx
 * - src/components/Audio/AuthenticatedAudioPreview.tsx
 */

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type PlaybackStatusMessages = {
	loading: string;
	playing: string;
	paused: string;
	errorPrefix: string;
};

const DEFAULT_MESSAGES: PlaybackStatusMessages = {
	loading: 'Загрузка аудио',
	playing: 'Воспроизведение',
	paused: 'Пауза',
	errorPrefix: 'Ошибка воспроизведения',
};

interface PlaybackStatusAnnouncerProps {
	playing: boolean;
	isLoading?: boolean;
	error?: string | null;
	trackName?: string | null;
	messages?: Partial<PlaybackStatusMessages>;
}

export function PlaybackStatusAnnouncer({
	playing,
	isLoading = false,
	error = null,
	trackName = null,
	messages,
}: PlaybackStatusAnnouncerProps): React.JSX.Element {
	const [announcement, setAnnouncement] = useState('');
	const previousRef = useRef({
		playing,
		isLoading,
		error,
	});
	const finalMessages = useMemo(
		() => ({
			...DEFAULT_MESSAGES,
			...messages,
		}),
		[messages]
	);

	useEffect(() => {
		const previous = previousRef.current;
		const normalizedError = error?.trim() ?? null;
		const normalizedTrackName = trackName?.trim() ?? '';

		if (normalizedError && normalizedError !== previous.error) {
			setAnnouncement(`${finalMessages.errorPrefix}: ${normalizedError}`);
		} else if (isLoading && !previous.isLoading) {
			setAnnouncement(
				normalizedTrackName
					? `${finalMessages.loading}: ${normalizedTrackName}`
					: finalMessages.loading
			);
		} else if (!normalizedError && !isLoading && playing !== previous.playing) {
			setAnnouncement(
				playing
					? normalizedTrackName
						? `${finalMessages.playing}: ${normalizedTrackName}`
						: finalMessages.playing
					: finalMessages.paused
			);
		}

		previousRef.current = {
			playing,
			isLoading,
			error: normalizedError,
		};
	}, [error, finalMessages, isLoading, playing, trackName]);

	return (
		<span aria-live="polite" aria-atomic="true" className="sr-only">
			{announcement}
		</span>
	);
}
