/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Voice Command Center localStorage helpers for UI prefs, command history, and macros.
 *
 * Invariants:
 * - Command history and macros have no server sync — device-local only (`VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY`).
 * - Live Voice widget history uses `/api/v1/live-voice/history`; do not conflate with VCC keys below.
 *
 * Related:
 * - `useVoiceCommandHistory.ts`, `macros/voiceMacros.ts`, `documentation/product/desktop/DESKTOP-IMPLEMENTED-VS-STUB.md`
 */

import type { VoiceCenterUIPrefs } from './types';
import type { CommandHistoryItem } from './components/CommandHistoryPanel';
import {
	VOICE_CENTER_UI_SYNC_EVENT,
	VOICE_CENTER_UI_STORAGE_KEY,
	HISTORY_STORAGE_KEY,
	MAX_PERSISTED_HISTORY,
} from './types';

/** Permanent offline contract: VCC command history is never synced to the server. */
export const VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY = true as const;

const DEFAULT_UI_PREFS: VoiceCenterUIPrefs = {
	soundFeedback: true,
	autoListen: false,
	websocketMode: false,
	pushToTalk: false,
};

export function loadVoiceCenterUI(): VoiceCenterUIPrefs {
	try {
		const raw =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(VOICE_CENTER_UI_STORAGE_KEY)
				: null;
		if (raw) {
			const p = JSON.parse(raw) as Partial<VoiceCenterUIPrefs>;
			return {
				soundFeedback:
					typeof p.soundFeedback === 'boolean'
						? p.soundFeedback
						: DEFAULT_UI_PREFS.soundFeedback,
				autoListen:
					typeof p.autoListen === 'boolean'
						? p.autoListen
						: DEFAULT_UI_PREFS.autoListen,
				websocketMode:
					typeof p.websocketMode === 'boolean'
						? p.websocketMode
						: DEFAULT_UI_PREFS.websocketMode,
				pushToTalk:
					typeof p.pushToTalk === 'boolean'
						? p.pushToTalk
						: DEFAULT_UI_PREFS.pushToTalk,
			};
		}
	} catch {
		// ignore
	}
	return { ...DEFAULT_UI_PREFS };
}

export function saveVoiceCenterUI(ui: Partial<VoiceCenterUIPrefs>): void {
	try {
		if (typeof localStorage !== 'undefined') {
			const current = loadVoiceCenterUI();
			const next = { ...current, ...ui };
			localStorage.setItem(VOICE_CENTER_UI_STORAGE_KEY, JSON.stringify(next));
			window.dispatchEvent(new CustomEvent(VOICE_CENTER_UI_SYNC_EVENT));
		}
	} catch {
		// ignore
	}
}

export function loadPersistedHistory(): CommandHistoryItem[] {
	try {
		const raw =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(HISTORY_STORAGE_KEY)
				: null;
		if (raw) {
			const arr = JSON.parse(raw) as Record<string, unknown>[];
			if (Array.isArray(arr)) {
				return arr.slice(0, MAX_PERSISTED_HISTORY).map((e) => ({
					id: String(e.id ?? ''),
					transcript: String(e.transcript ?? ''),
					status: (e.status as 'success' | 'error' | 'cancelled') || 'success',
					responseText:
						e.responseText != null ? String(e.responseText) : undefined,
					timestamp: new Date(String(e.timestamp ?? Date.now())),
					commandId: e.commandId != null ? String(e.commandId) : undefined,
					params: e.params as Record<string, string> | undefined,
				}));
			}
		}
	} catch {
		// ignore
	}
	return [];
}

/** Removes persisted command journal from localStorage. */
export function clearPersistedHistory(): void {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(HISTORY_STORAGE_KEY);
		}
	} catch {
		// ignore
	}
}

/** @returns false when localStorage write fails (quota, private mode). */
export function savePersistedHistory(items: CommandHistoryItem[]): boolean {
	try {
		if (typeof localStorage === 'undefined' || items.length === 0) return true;
		const toSave = items.slice(0, MAX_PERSISTED_HISTORY).map((item) => ({
			id: item.id,
			transcript: item.transcript,
			status: item.status,
			responseText: item.responseText,
			timestamp: item.timestamp.toISOString(),
			commandId: item.commandId,
			params: item.params,
		}));
		localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(toSave));
		return true;
	} catch {
		return false;
	}
}
