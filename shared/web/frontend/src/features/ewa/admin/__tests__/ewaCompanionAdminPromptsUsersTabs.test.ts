/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke that Prompts/Users tab modules export and i18n keys exist for new admin tabs.
 */
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en/desktopUi.json';
import ru from '@/i18n/locales/ru/desktopUi.json';

describe('ewaCompanionAdmin Prompts/Users i18n', () => {
	it('exposes tab and empty-state keys in en/ru', () => {
		const enAdmin = en.ewaCompanionAdmin;
		const ruAdmin = ru.ewaCompanionAdmin;
		for (const key of [
			'tabPrompts',
			'tabUsers',
			'loadingPrompts',
			'emptyUsers',
			'usersSearch',
			'savePrompt',
			'usersWipeTitle',
			'usersWipeButton',
			'usersWipeConfirmSubmit',
			'usersWipePending',
			'usersWipeCopyId',
			'usersWipeMismatch',
			'usersWipeSuccess',
			'usersWipeSpaHint',
			'usersWipeErrorQdrantUnavailable',
			'usersWipeErrorNotFound',
			'usersClearButton',
			'usersClearSuccess',
			'usersAuditNoteButton',
			'usersOpenTaskRuns',
		]) {
			expect(enAdmin[key]?.length).toBeGreaterThan(0);
			expect(ruAdmin[key]?.length).toBeGreaterThan(0);
		}
	});
});
