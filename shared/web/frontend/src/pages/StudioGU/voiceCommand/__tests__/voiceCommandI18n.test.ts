/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for clearPersistedHistory and localized command responses.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import enVoice from '@/i18n/locales/_fragments/voiceCommand.en.json';
import ruVoice from '@/i18n/locales/_fragments/voiceCommand.ru.json';
import { executeCommand } from '../engine/commandExecutor';
import { HISTORY_STORAGE_KEY } from '../types';
import {
	clearPersistedHistory,
	loadPersistedHistory,
	savePersistedHistory,
} from '../storage';
import {
	resolveExecutionResponse,
	type VoiceCommandT,
} from '../utils/voiceCommandI18n';

function responseT(responses: Record<string, string>): VoiceCommandT {
	return ((key: string, options?: { date?: string; name?: string }) => {
		if (key === 'responses.date' && options?.date) {
			return `Today is ${options.date}`;
		}
		if (key.startsWith('responses.')) {
			const id = key.slice('responses.'.length);
			return responses[id] ?? key;
		}
		return key;
	}) as VoiceCommandT;
}

vi.hoisted(() => {
	function createMemoryStorage(): Storage {
		let store: Record<string, string> = {};
		return {
			get length() {
				return Object.keys(store).length;
			},
			clear() {
				store = {};
			},
			getItem(key: string) {
				return store[key] ?? null;
			},
			setItem(key: string, value: string) {
				store[key] = String(value);
			},
			removeItem(key: string) {
				delete store[key];
			},
			key(index: number) {
				return Object.keys(store)[index] ?? null;
			},
		};
	}
	vi.stubGlobal('localStorage', createMemoryStorage());
});

describe('clearPersistedHistory', () => {
	afterEach(() => {
		localStorage.clear();
	});

	it('removes HISTORY_STORAGE_KEY from localStorage', () => {
		savePersistedHistory([
			{
				id: 'cmd-1',
				transcript: 'help',
				status: 'success',
				timestamp: new Date(),
			},
		]);
		expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeTruthy();

		clearPersistedHistory();
		expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
		expect(loadPersistedHistory()).toEqual([]);
	});
});

describe('resolveExecutionResponse', () => {
	it('returns English clear_feed copy when locale is en', () => {
		const t = responseT(enVoice.responses);
		const result = executeCommand('clear_history');
		expect(resolveExecutionResponse(result, t, 'en')).toBe(
			enVoice.responses.clear_feed
		);
	});

	it('returns Russian clear_feed copy when locale is ru', () => {
		const t = responseT(ruVoice.responses);
		const result = executeCommand('clear_history');
		expect(resolveExecutionResponse(result, t, 'ru')).toBe(
			ruVoice.responses.clear_feed
		);
	});
});
