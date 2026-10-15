/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for logout companion/Poemma/desktop localStorage purge — user A keys removed, unrelated keys kept.
 *
 * Invariants:
 * - Uses in-memory localStorage stub; no browser or network.
 *
 * Related:
 * - src/services/auth/clearPrincipalScopedLocalStorage.ts
 * - src/contexts/AuthContext.tsx
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearPrincipalScopedLocalStorage,
	DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
	shouldPurgePrincipalScopedLocalStorageKey,
} from '../clearPrincipalScopedLocalStorage';
import { STORAGE_KEYS } from '@/pages/Desktop/constants';

function createMemoryStorage(): Storage {
	const store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key: string) {
			return store.get(key) ?? null;
		},
		key(index: number) {
			return [...store.keys()][index] ?? null;
		},
		removeItem(key: string) {
			store.delete(key);
		},
		setItem(key: string, value: string) {
			store.set(key, value);
		},
	} as Storage;
}

describe('clearPrincipalScopedLocalStorage', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('removes companion and poemma keys for user A on logout teardown', () => {
		const storage = createMemoryStorage();
		vi.stubGlobal('localStorage', storage);

		const userA = 'user-a-sub';
		const userB = 'user-b-sub';

		storage.setItem(`eliteew.companion.pinnedTools.v1:${userA}`, '["tool-a"]');
		storage.setItem(`ewa_companion_voice_out.v1:${userA}`, '1');
		storage.setItem(`eliteew.ewaCompanion.chatDraft.v1::${userA}`, 'draft-a');
		storage.setItem(`${poemmaOrgKey(userA)}`, '{"id":"org-a"}');
		storage.setItem(`eliteew.companion.pinnedTools.v1:${userB}`, '["tool-b"]');
		storage.setItem('elite_desktop_config', '{"theme":"dark"}');

		clearPrincipalScopedLocalStorage(userA);

		expect(
			storage.getItem(`eliteew.companion.pinnedTools.v1:${userA}`)
		).toBeNull();
		expect(storage.getItem(`ewa_companion_voice_out.v1:${userA}`)).toBeNull();
		expect(
			storage.getItem(`eliteew.ewaCompanion.chatDraft.v1::${userA}`)
		).toBeNull();
		expect(storage.getItem(poemmaOrgKey(userA))).toBeNull();
		expect(storage.getItem(`eliteew.companion.pinnedTools.v1:${userB}`)).toBe(
			'["tool-b"]'
		);
		expect(storage.getItem('elite_desktop_config')).toBe('{"theme":"dark"}');
	});

	it('removes desktop widget and clipboard LS on logout (F-05 privacy)', () => {
		const storage = createMemoryStorage();
		vi.stubGlobal('localStorage', storage);

		const userA = 'user-a-sub';
		storage.setItem(
			STORAGE_KEYS.WIDGET_NOTES,
			JSON.stringify([{ id: 'n1', content: 'secret note' }])
		);
		storage.setItem(
			STORAGE_KEYS.WIDGET_TODOS,
			JSON.stringify([{ id: 't1', text: 'call bank' }])
		);
		storage.setItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY, '["copied password"]');
		storage.setItem(
			`eliteew.gafChat.composerDraft.v1::${userA}::chat-1`,
			'draft text'
		);
		storage.setItem('elite_desktop_config', '{"theme":"dark"}');
		storage.setItem('elite_desktop_items', '[]');

		clearPrincipalScopedLocalStorage(userA);

		expect(storage.getItem(STORAGE_KEYS.WIDGET_NOTES)).toBeNull();
		expect(storage.getItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY)).toBeNull();
		expect(
			storage.getItem(`eliteew.gafChat.composerDraft.v1::${userA}::chat-1`)
		).toBeNull();
		expect(storage.getItem('elite_desktop_config')).toBe('{"theme":"dark"}');
		expect(storage.getItem('elite_desktop_items')).toBe('[]');
	});

	it('shouldPurgePrincipalScopedLocalStorageKey matches FRONTEND_BROWSER_CACHE_MODEL prefixes', () => {
		const userA = 'user-a-sub';
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(`poemma:v1:${userA}:org`, userA)
		).toBe(true);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(
				`poemma:v1:${userA}:org`,
				'other-user'
			)
		).toBe(false);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(
				'eliteew.ewaCompanion.documentSurfaceDraft.v1::document:doc-1',
				userA
			)
		).toBe(true);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey('elite_desktop_config', userA)
		).toBe(false);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(
				STORAGE_KEYS.WIDGET_NOTES,
				userA
			)
		).toBe(true);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(
				DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
				userA
			)
		).toBe(true);
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(
				`desktop_quiet_mode::${userA}`,
				userA
			)
		).toBe(true);
	});

	it('purges residual activity islands named in sterile isolation audit', () => {
		const storage = createMemoryStorage();
		vi.stubGlobal('localStorage', storage);

		storage.setItem('lastVisitedPage', 'desktop');
		storage.setItem('doc-recent-documents', '["doc-1"]');
		storage.setItem('doc-search-history', '["secret query"]');
		storage.setItem('eliteew_voice_settings', '{"voice":"x"}');
		storage.setItem('liveVoice_settings', '{"mic":true}');
		storage.setItem('ewrp-draft-job-9', '{"slides":[]}');
		storage.setItem('marketing-cabinet-selected-company', 'co-1');
		storage.setItem('eliteew.desktop.clipboardPolicy.v1', 'quarantine');
		storage.setItem('app_version', '1.0.0');

		clearPrincipalScopedLocalStorage('user-a-sub');

		expect(storage.getItem('lastVisitedPage')).toBeNull();
		expect(storage.getItem('doc-recent-documents')).toBeNull();
		expect(storage.getItem('doc-search-history')).toBeNull();
		expect(storage.getItem('eliteew_voice_settings')).toBeNull();
		expect(storage.getItem('liveVoice_settings')).toBeNull();
		expect(storage.getItem('ewrp-draft-job-9')).toBeNull();
		expect(storage.getItem('marketing-cabinet-selected-company')).toBeNull();
		expect(storage.getItem('eliteew.desktop.clipboardPolicy.v1')).toBe(
			'quarantine'
		);
		expect(storage.getItem('app_version')).toBe('1.0.0');
	});
});

function poemmaOrgKey(userId: string): string {
	return `poemma:v1:${userId}:org`;
}
