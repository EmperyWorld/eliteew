/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for i18n feedback status/kind labels in admin Feedback section.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	adminFeedbackKindLabelI18n,
	adminFeedbackStatusLabelI18n,
} from '../adminFeedbackLabelsI18n';

const t = ((key: string) =>
	(
		({
			'adminFeedback.statuses.open': 'Open',
			'adminFeedback.statuses.in_progress': 'In progress',
			'adminFeedback.kinds.wish': 'Wish',
			'adminFeedback.kinds.bug': 'Bug',
		}) as Record<string, string>
	)[key] ?? key) as TFunction<'desktopUi'>;

describe('adminFeedbackLabelsI18n', () => {
	it('maps known status and kind via i18n keys', () => {
		expect(adminFeedbackStatusLabelI18n('open', t)).toBe('Open');
		expect(adminFeedbackStatusLabelI18n('in_progress', t)).toBe('In progress');
		expect(adminFeedbackKindLabelI18n('wish', t)).toBe('Wish');
		expect(adminFeedbackKindLabelI18n('bug', t)).toBe('Bug');
	});

	it('falls back to raw API value for unknown keys', () => {
		expect(adminFeedbackStatusLabelI18n('custom', t)).toBe('custom');
	});
});
