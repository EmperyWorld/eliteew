/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub send aria i18n key mapping.
 */

import { describe, expect, it } from 'vitest';
import { feedbackSendAriaI18nKey } from '../feedbackHubSendLabels';

describe('feedbackSendAriaI18nKey', () => {
	it('maps block reasons to desktopUi.feedbackHub keys', () => {
		expect(feedbackSendAriaI18nKey(null)).toBe('sendAria');
		expect(feedbackSendAriaI18nKey('pending')).toBe('sendingAria');
		expect(feedbackSendAriaI18nKey('quota_wish')).toBe(
			'sendDisabledQuotaWishAria'
		);
		expect(feedbackSendAriaI18nKey('over_limit')).toBe(
			'sendDisabledOverLimitAria'
		);
	});
});
