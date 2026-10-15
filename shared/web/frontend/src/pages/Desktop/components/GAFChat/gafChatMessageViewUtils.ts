import type { Locale } from 'date-fns';
import type { GAFMessageItem } from './types';
import {
	differenceInHours,
	format,
	formatDistanceToNow,
	isToday,
	isYesterday,
} from 'date-fns';

export const SCROLL_BOTTOM_THRESHOLD_PX = 72;
export const LONG_PRESS_MS = 520;
export const LOAD_MORE_SENTINEL_HEIGHT_PX = 36;

export function groupMessagesByDate(
	messages: GAFMessageItem[],
	t: (key: string) => string,
	dateLocale: Locale
): Array<{ dateKey: string; label: string; messages: GAFMessageItem[] }> {
	const byDate = new Map<string, GAFMessageItem[]>();
	for (const msg of messages) {
		const d = new Date(msg.created_at);
		const key = format(d, 'yyyy-MM-dd');
		let bucket = byDate.get(key);
		if (!bucket) {
			bucket = [];
			byDate.set(key, bucket);
		}
		bucket.push(msg);
	}
	const sorted = Array.from(byDate.entries()).sort(([a], [b]) =>
		a.localeCompare(b)
	);
	return sorted.map(([key, msgs]) => {
		const d = new Date(key);
		const label = isToday(d)
			? t('date.today')
			: isYesterday(d)
				? t('date.yesterday')
				: format(d, 'd MMMM yyyy', { locale: dateLocale });
		return { dateKey: key, label, messages: msgs };
	});
}

export function formatGafRecordingClock(totalSec: number): string {
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export type GafVideoCallEventName = 'ringing' | 'accepted' | 'ended' | 'missed';

export interface GafVideoCallEventMeta {
	event: GafVideoCallEventName;
	durationSeconds: number | null;
	missedReason: string | null;
}

export function getVideoCallEventMeta(
	metadata: GAFMessageItem['metadata']
): GafVideoCallEventMeta | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const m = metadata as {
		kind?: unknown;
		event?: unknown;
		duration_seconds?: unknown;
		missed_reason?: unknown;
	};
	if (m.kind !== 'video_call_event') return null;
	const event = String(m.event || '');
	if (!['ringing', 'accepted', 'ended', 'missed'].includes(event)) return null;
	const duration =
		typeof m.duration_seconds === 'number' &&
		Number.isFinite(m.duration_seconds)
			? Math.max(0, Math.floor(m.duration_seconds))
			: null;
	const missedReason =
		typeof m.missed_reason === 'string' && m.missed_reason.trim()
			? m.missed_reason.trim()
			: null;
	return {
		event: event as GafVideoCallEventName,
		durationSeconds: duration,
		missedReason,
	};
}

export function formatGafCallDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

export type GafBubbleFooterTimes = ReturnType<typeof bubbleFooterTimes>;

export function bubbleFooterTimes(
	createdAt: string,
	dateLocale: Locale,
	editedAt?: string | null,
	editedLabel?: string
): {
	clock: string;
	relativeHint?: string;
	absoluteTitle: string;
	editedSuffix?: string;
} {
	const d = new Date(createdAt);
	const clock = format(d, 'HH:mm', { locale: dateLocale });
	const absoluteTitle = format(d, 'd MMMM yyyy, HH:mm', { locale: dateLocale });
	const hours = differenceInHours(new Date(), d);
	const relativeHint =
		hours < 48
			? formatDistanceToNow(d, { addSuffix: true, locale: dateLocale })
			: undefined;
	const editedSuffix =
		editedAt != null &&
		String(editedAt).trim() !== '' &&
		editedLabel != null &&
		editedLabel.trim() !== ''
			? editedLabel
			: undefined;
	return { clock, relativeHint, absoluteTitle, editedSuffix };
}
