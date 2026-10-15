/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Date/time and UI label formatters for Desktop AI Chat surfaces.
 *
 * Invariants:
 * - Invalid ISO inputs degrade to empty or null without throwing.
 *
 * Related:
 * - DesktopAiChatApp.tsx, buildMessageListWithDays.ts
 * ---
 */
import { format, isSameDay, subDays } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { TFunction } from 'i18next';
import { eliteewDegradeDebug } from '@/utils/eliteewDegradeDebug';

export const HEADER_COLLAPSED_KEY = 'desktop_ai_chat_header_collapsed';
export const SETTINGS_ADVANCED_OPEN_KEY =
	'desktop_ai_chat_settings_advanced_open';

/** Countdown for active solo energy session (server `solo_slot_ends_at` ISO UTC). */
export function formatSoloSlotCountdown(endsAtIso: string): string {
	const end = Date.parse(endsAtIso);
	if (Number.isNaN(end)) {
		return '—';
	}
	const ms = end - Date.now();
	if (ms <= 0) {
		return '0:00';
	}
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMessageClock(
	iso: string | null,
	lang: string
): string | null {
	if (!iso) {
		return null;
	}
	try {
		const locale = lang.startsWith('ru') ? ru : enUS;
		return format(new Date(iso), 'HH:mm', { locale });
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_message_time_format',
			'message time format failed',
			err
		);
		return null;
	}
}

export function readHeaderCollapsed(): boolean {
	try {
		const raw = localStorage.getItem(HEADER_COLLAPSED_KEY);
		// Premium quiet chrome: settings rail hidden until the user opens it.
		// Missing key = never toggled → default collapsed (not expanded).
		if (raw === null) return true;
		return raw === '1';
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_header_collapsed_read',
			'localStorage header collapsed read failed',
			err
		);
		return true;
	}
}

export function writeHeaderCollapsed(v: boolean): void {
	try {
		// Persist both sides: '1' collapsed, '0' expanded. Missing key = default collapsed.
		localStorage.setItem(HEADER_COLLAPSED_KEY, v ? '1' : '0');
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_header_collapsed_write',
			'localStorage header collapsed write failed',
			err
		);
	}
}

export function readSettingsAdvancedOpen(): boolean {
	try {
		return localStorage.getItem(SETTINGS_ADVANCED_OPEN_KEY) === '1';
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_settings_advanced_open_read',
			'localStorage settings advanced open read failed',
			err
		);
		return false;
	}
}

export function writeSettingsAdvancedOpen(v: boolean): void {
	try {
		if (v) {
			localStorage.setItem(SETTINGS_ADVANCED_OPEN_KEY, '1');
		} else {
			localStorage.removeItem(SETTINGS_ADVANCED_OPEN_KEY);
		}
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_settings_advanced_open_write',
			'localStorage settings advanced open write failed',
			err
		);
	}
}

export function formatDayDividerLabel(
	iso: string | null,
	lang: string,
	t: TFunction<'desktopAiChat'>
): string {
	if (!iso) {
		return '';
	}
	try {
		const d = new Date(iso);
		const today = new Date();
		if (isSameDay(d, today)) {
			return t('dayToday');
		}
		if (isSameDay(d, subDays(today, 1))) {
			return t('dayYesterday');
		}
		const locale = lang.startsWith('ru') ? ru : enUS;
		return format(d, 'd MMMM yyyy', { locale });
	} catch (err) {
		eliteewDegradeDebug(
			'desktop_ai_chat_day_label_format',
			'day label format failed',
			err
		);
		return '';
	}
}
