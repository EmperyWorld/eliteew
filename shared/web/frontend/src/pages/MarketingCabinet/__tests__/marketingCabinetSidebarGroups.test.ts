/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Unit coverage for marketer-facing Marketing Cabinet sidebar grouping.
 *
 * Invariants:
 * - Grouping must preserve stable MarketingView ids for deep links and permissions.
 * - Technical tools stay in the advanced group, not in the primary workflow groups.
 *
 * Related:
 * - ../constants.ts
 */
import { describe, expect, it } from 'vitest';

import {
	getMarketingSidebarGroupForView,
	MARKETING_SIDEBAR_GROUPS,
} from '../constants';

describe('Marketing Cabinet sidebar grouping', () => {
	it('keeps stable view ids under marketer-facing groups', () => {
		expect(getMarketingSidebarGroupForView('jtbd')?.id).toBe('strategy');
		expect(getMarketingSidebarGroupForView('value')?.id).toBe('strategy');
		expect(getMarketingSidebarGroupForView('segments')?.id).toBe('audience');
		expect(getMarketingSidebarGroupForView('campaigns')?.id).toBe('growth');
		expect(getMarketingSidebarGroupForView('alerts')?.id).toBe('work');
	});

	it('moves technical tools to the advanced group', () => {
		const advanced = MARKETING_SIDEBAR_GROUPS.find((group) => group.advanced);

		expect(advanced?.id).toBe('advanced');
		expect(advanced?.viewIds).toContain('project_rag');
		expect(advanced?.viewIds).toContain('ai_studio');
		expect(advanced?.viewIds).toContain('overview_dashboard');
	});
});
