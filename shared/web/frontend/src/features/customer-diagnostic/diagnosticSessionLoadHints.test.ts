import type { CustomerDiagnosticSession } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { describe, expect, it } from 'vitest';

import {
	applyDiagnosticLoadHints,
	answersLookNonEmpty,
	reconcileCompletedModules,
} from './diagnosticSessionLoadHints';
import { defaultCustomerDiagnosticState } from './diagnosticTypes';

function session(
	over: Partial<CustomerDiagnosticSession>
): CustomerDiagnosticSession {
	return {
		id: 's1',
		project_id: 'p1',
		state: {},
		progress_percent: 0,
		computed_results: null,
		completed_at: null,
		updated_at: '2026-01-01T00:00:00Z',
		...over,
	};
}

describe('answersLookNonEmpty', () => {
	it('returns false for empty object', () => {
		expect(answersLookNonEmpty({})).toBe(false);
	});
	it('returns true when archetype has keys', () => {
		expect(
			answersLookNonEmpty({ archetype: { hero: 1 } as Record<string, number> })
		).toBe(true);
	});
});

describe('applyDiagnosticLoadHints', () => {
	it('keeps welcome when nothing started', () => {
		const base = defaultCustomerDiagnosticState();
		const out = applyDiagnosticLoadHints(base, session({}));
		expect(out.uiPhase).toBe('welcome');
	});

	it('moves welcome to hub when there are answers', () => {
		const base = defaultCustomerDiagnosticState();
		base.answers = { archetype: { hero: 0.5 } };
		const out = applyDiagnosticLoadHints(base, session({}));
		expect(out.uiPhase).toBe('hub');
	});

	it('sets complete when all module ids are in completedModules', () => {
		const base = defaultCustomerDiagnosticState();
		base.completedModules = [
			'archetype',
			'values',
			'business',
			'service',
			'emotions',
		];
		base.uiPhase = 'hub';
		const out = applyDiagnosticLoadHints(base, session({}));
		expect(out.uiPhase).toBe('complete');
	});

	it('sets complete when API reports finished session', () => {
		const base = defaultCustomerDiagnosticState();
		base.uiPhase = 'welcome';
		const out = applyDiagnosticLoadHints(
			base,
			session({
				progress_percent: 100,
				completed_at: '2026-01-02T00:00:00Z',
			})
		);
		expect(out.uiPhase).toBe('complete');
	});
});

describe('reconcileCompletedModules', () => {
	it('returns list aligned with isModuleComplete', () => {
		const base = defaultCustomerDiagnosticState();
		const out = reconcileCompletedModules(base);
		expect(Array.isArray(out)).toBe(true);
	});
});
