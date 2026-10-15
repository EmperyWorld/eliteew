/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock: Admin presence summary counts FoFline as a 5th SSO channel (W3).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §6.2 / W3
 */

import { describe, expect, it } from 'vitest';
import { summarizePresenceChannels } from '../adminUserPresenceSummary';

describe('adminUserPresenceSummary FoFline W3', () => {
	it('counts five channels including FoFline live', () => {
		const summary = summarizePresenceChannels({
			presence_online: true,
			presence_sessions_web: 1,
			presence_sessions_mobile: 0,
			sso_browser_live: true,
			sso_mobile_live: false,
			sso_desktop_live: true,
			sso_fofline_live: true,
		});
		expect(summary.totalChannels).toBe(5);
		expect(summary.liveCount).toBe(4);
	});
});
