/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Social Hub legacy tab id normalization.
 *
 * Invariants:
 * - Notification payloads using `tab=inbox` resolve to People → Requests.
 *
 * Related:
 * - ../socialHubNavigation.ts
 */

import { describe, expect, it } from 'vitest';

import { resolveLegacySocialHubTab } from '../socialHubNavigation';

describe('resolveLegacySocialHubTab', () => {
	it('maps overview to home', () => {
		expect(resolveLegacySocialHubTab('overview')).toEqual({
			section: 'home',
			peopleSubview: 'contacts',
		});
	});

	it('maps inbox to people requests', () => {
		expect(resolveLegacySocialHubTab('inbox')).toEqual({
			section: 'people',
			peopleSubview: 'requests',
		});
	});

	it('maps profile to privacy', () => {
		expect(resolveLegacySocialHubTab('profile')).toEqual({
			section: 'privacy',
			peopleSubview: 'contacts',
		});
	});

	it('maps mobile-app to phone', () => {
		expect(resolveLegacySocialHubTab('mobile-app')).toEqual({
			section: 'phone',
			peopleSubview: 'contacts',
		});
	});

	it('returns null for unknown tabs', () => {
		expect(resolveLegacySocialHubTab('bad-tab')).toBeNull();
	});
});
