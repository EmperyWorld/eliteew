/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Brand → EWDesk reminder gating.
 */

import { describe, expect, it } from 'vitest';

import { shouldShowBrandEwDeskReminder } from './brandEwDeskReminderLogic';

describe('shouldShowBrandEwDeskReminder', () => {
	it('shows when brand lane has copy and EWDesk integration is enabled', () => {
		expect(
			shouldShowBrandEwDeskReminder({
				brandStreamText: 'Weekly post draft',
				brandStreamStatus: 'ready',
				integrations: [{ integration_key: 'ewdesk', is_enabled: true }],
			})
		).toBe(true);
	});

	it('hides when EWDesk integration is disabled', () => {
		expect(
			shouldShowBrandEwDeskReminder({
				brandStreamText: 'Weekly post draft',
				brandStreamStatus: '',
				integrations: [{ integration_key: 'ewdesk', is_enabled: false }],
			})
		).toBe(false);
	});
});
