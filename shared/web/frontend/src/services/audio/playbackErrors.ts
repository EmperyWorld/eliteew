/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed playback error classification for global player and authenticated previews.
 *
 * Invariants:
 * - Categories are stable across UI surfaces and analytics events.
 * - Aborted requests / seek-interrupted `play()` must not become sticky user-visible hard errors.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/Desktop/context/nowPlaying/attachLoadedAudioSource.ts
 * - src/services/contentDownloadWithRetry.ts
 */

import type { TFunction } from 'i18next';

export type PlaybackErrorCategory =
	| 'permission'
	| 'not_found'
	| 'storage_pending'
	| 'decode'
	| 'empty_blob'
	| 'aborted'
	| 'unknown';

export interface PlaybackErrorInfo {
	category: PlaybackErrorCategory;
	message: string;
	retriable: boolean;
	statusCode: number | null;
}

/** `MediaError.MEDIA_ERR_ABORTED` — common after seek on progressive/stream URLs. */
export const HTML_MEDIA_ERR_ABORTED = 1;
export const HTML_MEDIA_ERR_NETWORK = 2;
export const HTML_MEDIA_ERR_DECODE = 3;
export const HTML_MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

export function isHtmlMediaAbortedError(
	media: Pick<HTMLMediaElement, 'error'>
): boolean {
	return media.error?.code === HTML_MEDIA_ERR_ABORTED;
}

/** Map HTMLMediaElement.error to playback categories (honest vs invented AUDIO_DECODE_ERROR). */
export function classifyHtmlMediaElementError(
	media: Pick<HTMLMediaElement, 'error'>
): PlaybackErrorCategory {
	const code = media.error?.code;
	if (code === HTML_MEDIA_ERR_ABORTED) return 'aborted';
	if (code === HTML_MEDIA_ERR_NETWORK) return 'unknown';
	if (code === HTML_MEDIA_ERR_DECODE) return 'decode';
	if (code === HTML_MEDIA_ERR_SRC_NOT_SUPPORTED) return 'decode';
	return 'unknown';
}

function statusFromError(error: unknown): number | null {
	const status = (error as { response?: { status?: unknown } })?.response
		?.status;
	if (typeof status === 'number' && Number.isFinite(status)) {
		return status;
	}
	return null;
}

function isNotAllowedPlayError(error: unknown): boolean {
	if (error instanceof DOMException && error.name === 'NotAllowedError') {
		return true;
	}
	const name = (error as { name?: unknown })?.name;
	return name === 'NotAllowedError';
}

function isAbortError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	const name = (error as { name?: unknown }).name;
	if (name === 'AbortError' || name === 'CanceledError') {
		return true;
	}
	const message = (error as { message?: unknown }).message;
	return typeof message === 'string' && /abort|cancel/i.test(message);
}

export function classifyPlaybackError(error: unknown): PlaybackErrorCategory {
	if (isAbortError(error)) return 'aborted';
	if (isNotAllowedPlayError(error)) return 'permission';
	const status = statusFromError(error);
	if (status === 403) return 'permission';
	if (status === 404) return 'not_found';
	if (
		status === 409 ||
		status === 423 ||
		status === 425 ||
		status === 502 ||
		status === 503
	) {
		return 'storage_pending';
	}
	const message =
		typeof (error as { message?: unknown })?.message === 'string'
			? (error as { message: string }).message
			: '';
	if (message === 'follower_tab_passive_mode') {
		return 'permission';
	}
	if (message === 'EMPTY_AUDIO_BLOB' || message === 'EMPTY_CONTENT_BLOB') {
		return 'empty_blob';
	}
	if (/decode|media|demux|format/i.test(message)) {
		return 'decode';
	}
	return 'unknown';
}

export function isPlaybackAbortError(error: unknown): boolean {
	return classifyPlaybackError(error) === 'aborted';
}

export function playbackErrorMessage(
	t: TFunction<'desktopUi'>,
	category: PlaybackErrorCategory,
	keyPrefix: 'musicPlayer' | 'nowPlaying' = 'nowPlaying'
): string {
	switch (category) {
		case 'permission':
			return t(`${keyPrefix}.error403`);
		case 'not_found':
			return t(`${keyPrefix}.error404`);
		case 'storage_pending':
			return t(`${keyPrefix}.errorStoragePending`, {
				defaultValue:
					'Файл еще подготавливается в хранилище. Повторите через несколько секунд.',
			});
		case 'decode':
			return t(`${keyPrefix}.errorDecode`);
		case 'empty_blob':
			return t(`${keyPrefix}.errorEmpty`);
		case 'aborted':
			return t(`${keyPrefix}.errorAborted`, {
				defaultValue: 'Загрузка отменена.',
			});
		default:
			return t(`${keyPrefix}.errorLoadFallback`);
	}
}

export function mapPlaybackErrorInfo(
	error: unknown,
	t: TFunction<'desktopUi'>,
	keyPrefix: 'musicPlayer' | 'nowPlaying' = 'nowPlaying'
): PlaybackErrorInfo {
	const category = classifyPlaybackError(error);
	const statusCode = statusFromError(error);
	return {
		category,
		message: playbackErrorMessage(t, category, keyPrefix),
		retriable: category !== 'permission' && category !== 'aborted',
		statusCode,
	};
}
