/**
 * Unified notification API facade. Use from anywhere (components or services).
 * Toasts go to Sonner; addToCenter pushes to the notification center store.
 */

import { toast as sonnerToast } from 'sonner';
import { getNotificationStoreRef } from './context';
import { shouldDeliverInAppForType } from './prefsBridge';
import type { NotificationInput, NotificationType } from './types';
import { playNotificationSoundForSourceThrottled } from '../pages/Desktop/utils/notificationSound';
import { formatDuration } from '../utils/formatDuration';

export interface NotifyToastOptions {
	description?: string;
	duration?: number;
	/** Merged onto the Sonner toast root (e.g. source-specific accent). */
	className?: string;
	/** Also add this message to the notification center */
	addToCenter?: boolean;
	/**
	 * Full center row when `addToCenter` is true (id, source, persistent, expiresAt).
	 * If omitted, a row is built from title/message/action.
	 */
	center?: NotificationInput;
	/** Optional action button for notification center entry */
	action?: NotificationInput['action'];
	/** Sonner toast action (e.g. «Open» after install) */
	toastAction?: { label: string; onClick: () => void };
}

export interface NowPlayingToastPayload {
	trackId: string;
	trackName: string;
	durationSeconds: number;
	currentTimeSeconds?: number;
	volume?: number;
	playbackRate?: number;
	source?: 'network' | 'idb-cache';
}

function addToCenterIfRequested(
	type: NotificationType,
	title: string,
	message: string,
	options?: NotifyToastOptions
) {
	if (!options?.addToCenter) return;
	if (!shouldDeliverInAppForType(type)) return;
	const store = getNotificationStoreRef().current;
	if (!store) return;
	if (options.center) {
		store.addToCenter({
			...options.center,
			type: options.center.type ?? type,
		});
	} else {
		store.addToCenter({ type, title, message, action: options.action });
	}
}

function toastAndSound(
	type: NotificationType,
	showToast: () => void,
	source?: string | null
): void {
	if (!shouldDeliverInAppForType(type)) return;
	showToast();
	playNotificationSoundForSourceThrottled(source);
}

export const notify = {
	success: (title: string, message?: string, options?: NotifyToastOptions) => {
		toastAndSound(
			'success',
			() => {
				sonnerToast.success(title, {
					description: message ?? options?.description,
					duration: options?.duration ?? 3000,
					className: options?.className,
					action: options?.toastAction,
				});
			},
			options?.center?.source ?? null
		);
		addToCenterIfRequested('success', title, message ?? '', options);
	},
	error: (title: string, message?: string, options?: NotifyToastOptions) => {
		toastAndSound(
			'error',
			() => {
				sonnerToast.error(title, {
					description: message ?? options?.description,
					duration: options?.duration ?? 5000,
					className: options?.className,
					action: options?.toastAction,
				});
			},
			options?.center?.source ?? null
		);
		addToCenterIfRequested('error', title, message ?? '', options);
	},
	warning: (title: string, message?: string, options?: NotifyToastOptions) => {
		toastAndSound(
			'warning',
			() => {
				sonnerToast.warning(title, {
					description: message ?? options?.description,
					duration: options?.duration ?? 4000,
					className: options?.className,
				});
			},
			options?.center?.source ?? null
		);
		addToCenterIfRequested('warning', title, message ?? '', options);
	},
	info: (title: string, message?: string, options?: NotifyToastOptions) => {
		toastAndSound(
			'info',
			() => {
				sonnerToast.info(title, {
					description: message ?? options?.description,
					duration: options?.duration ?? 3000,
					className: options?.className,
				});
			},
			options?.center?.source ?? null
		);
		addToCenterIfRequested('info', title, message ?? '', options);
	},
	nowPlaying: (
		payload: NowPlayingToastPayload,
		options?: Omit<NotifyToastOptions, 'description' | 'toastAction'>
	) => {
		if (!shouldDeliverInAppForType('info')) return;
		const current = Math.max(0, payload.currentTimeSeconds ?? 0);
		const duration = Math.max(0, payload.durationSeconds);
		const progressLabel = `${formatDuration(current)} / ${formatDuration(duration)}`;
		const sourceLabel =
			payload.source === 'idb-cache' ? 'Локальный кеш' : 'Сеть';
		const volumeLabel =
			typeof payload.volume === 'number'
				? ` · Громкость ${Math.round(payload.volume * 100)}%`
				: '';
		const rateLabel =
			typeof payload.playbackRate === 'number'
				? ` · Скорость ${payload.playbackRate.toFixed(2)}x`
				: '';
		const description = `${progressLabel} · ${sourceLabel}${volumeLabel}${rateLabel}`;

		sonnerToast.info(`Сейчас играет: ${payload.trackName}`, {
			description,
			duration: options?.duration ?? 5600,
			className: `music-now-playing-toast ${options?.className ?? ''}`.trim(),
		});
		playNotificationSoundForSourceThrottled('music_player');

		if (options?.addToCenter !== true) return;
		const store = getNotificationStoreRef().current;
		if (!store) return;
		store.addToCenter({
			type: 'info',
			title: 'Сейчас играет',
			message: `${payload.trackName} · ${formatDuration(duration)}`,
			source: 'music_player',
			metadata: {
				track_id: payload.trackId,
				duration_seconds: duration,
				source: payload.source ?? 'network',
			},
			openApp: { appComponent: 'MusicPlayer' },
		});
	},
	loading: (message: string) => sonnerToast.loading(message),
	promise: <T>(
		promise: Promise<T>,
		messages: {
			loading: string;
			success: string | ((data: T) => string);
			error: string | ((err: Error) => string);
		}
	) => sonnerToast.promise(promise, messages),
	action: (
		message: string,
		action: { label: string; onClick: () => void },
		description?: string
	) => {
		if (!shouldDeliverInAppForType('info')) return;
		sonnerToast(message, {
			description,
			action: { label: action.label, onClick: action.onClick },
			duration: 5000,
		});
	},
	dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),

	/** Add only to notification center (no toast). */
	addToCenter: (input: NotificationInput): string => {
		if (!shouldDeliverInAppForType(input.type)) return '';
		const store = getNotificationStoreRef().current;
		if (!store) return '';
		return store.addToCenter(input);
	},
};

export default notify;
