import { describe, expect, it, vi } from 'vitest';
import {
	hasMarketingCabinetDeepLink,
	parseMarketingCabinetDeepLinkState,
	pushMarketingCabinetSearchFromState,
	stripMarketingCabinetParamsFromCurrentUrl,
} from '../hooks/useMarketingCabinetNavigation';
import {
	MC_OPS_COMPETITOR_TYPE,
	MC_OPS_JTBD_CATEGORY,
	MC_OPS_JTBD_PRIORITY,
	MC_OPS_JTBD_VALIDATED,
	MC_OPS_VALUE_PROP_STATUS,
	parseMarketingCabinetOpsListFilters,
} from '../operationsDeepLink';

describe('hasMarketingCabinetDeepLink', () => {
	it('returns false for empty or unrelated query', () => {
		expect(hasMarketingCabinetDeepLink('')).toBe(false);
		expect(hasMarketingCabinetDeepLink('?foo=1')).toBe(false);
	});

	it('returns true when any mc_* param is non-empty', () => {
		expect(hasMarketingCabinetDeepLink('?mc_view=chat')).toBe(true);
		expect(hasMarketingCabinetDeepLink('mc_company=c1')).toBe(true);
		expect(hasMarketingCabinetDeepLink('?mc_project=p1&other=x')).toBe(true);
	});

	it('treats whitespace-only mc_* as absent', () => {
		expect(hasMarketingCabinetDeepLink('?mc_view=%20%20')).toBe(false);
	});
});

describe('parseMarketingCabinetDeepLinkState', () => {
	it('returns null when no deep link', () => {
		expect(parseMarketingCabinetDeepLinkState('')).toBeNull();
		expect(parseMarketingCabinetDeepLinkState('?foo=bar')).toBeNull();
	});

	it('maps legacy mc_view=setup to companies', () => {
		const s = parseMarketingCabinetDeepLinkState('?mc_view=setup');
		expect(s).not.toBeNull();
		expect(s?.activeView).toBe('companies');
	});

	it('accepts known views and defaults unknown to overview', () => {
		expect(
			parseMarketingCabinetDeepLinkState('?mc_view=evidence')?.activeView
		).toBe('evidence');
		expect(
			parseMarketingCabinetDeepLinkState('?mc_view=unknown_slug')?.activeView
		).toBe('overview');
	});

	it('parses all mc_* ids', () => {
		const s = parseMarketingCabinetDeepLinkState(
			'?mc_view=projects&mc_company=c1&mc_project=p1&mc_entity=e1&mc_content=ct1'
		);
		expect(s).toEqual({
			activeView: 'projects',
			selectedCompanyId: 'c1',
			selectedProjectId: 'p1',
			focusedEntityId: 'e1',
			selectedContentId: 'ct1',
		});
	});

	it('parses mc_view=overview_dashboard (full grid dashboard)', () => {
		const s = parseMarketingCabinetDeepLinkState(
			'?mc_view=overview_dashboard&mc_company=c1&mc_project=p1'
		);
		expect(s).toEqual({
			activeView: 'overview_dashboard',
			selectedCompanyId: 'c1',
			selectedProjectId: 'p1',
			focusedEntityId: null,
			selectedContentId: null,
		});
	});
});

describe('pushMarketingCabinetSearchFromState', () => {
	it('uses history.pushState with mc_* query', () => {
		const pushState = vi.fn();
		Object.defineProperty(window, 'history', {
			configurable: true,
			value: { pushState, replaceState: vi.fn() },
		});
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				href: 'https://app.eliteew.ru/mc?mc_view=overview&mc_project=p1',
				pathname: '/mc',
				search: '?mc_view=overview&mc_project=p1',
				hash: '',
			},
		});

		pushMarketingCabinetSearchFromState({
			activeView: 'overview_dashboard',
			selectedCompanyId: 'c1',
			selectedProjectId: 'p1',
			focusedEntityId: null,
			selectedContentId: null,
		});

		expect(pushState).toHaveBeenCalledTimes(1);
		const url = pushState.mock.calls[0][2] as string;
		expect(url).toContain('mc_view=overview_dashboard');
		expect(url).toContain('mc_project=p1');
		expect(url).toContain('mc_company=c1');
	});

	it('pushState when returning to overview cards keeps mc_project (A.10)', () => {
		const pushState = vi.fn();
		Object.defineProperty(window, 'history', {
			configurable: true,
			value: { pushState, replaceState: vi.fn() },
		});
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				href: 'https://app.eliteew.ru/mc?mc_view=overview_dashboard&mc_project=p1&mc_company=c1',
				pathname: '/mc',
				search: '?mc_view=overview_dashboard&mc_project=p1&mc_company=c1',
				hash: '',
			},
		});

		pushMarketingCabinetSearchFromState({
			activeView: 'overview',
			selectedCompanyId: 'c1',
			selectedProjectId: 'p1',
			focusedEntityId: null,
			selectedContentId: null,
		});

		expect(pushState).toHaveBeenCalledTimes(1);
		const url = pushState.mock.calls[0][2] as string;
		expect(url).toContain('mc_view=overview');
		expect(url).toContain('mc_project=p1');
		expect(url).toContain('mc_company=c1');
	});
});

describe('parseMarketingCabinetOpsListFilters', () => {
	it('returns empty filters when no mc_ops keys', () => {
		expect(parseMarketingCabinetOpsListFilters('?mc_view=jtbd')).toEqual({
			jtbd: { category: '', priority: '', validated: '' },
			valueProp: { status: '' },
			competitor: { competitor_type: '' },
		});
	});

	it('reads JTBD, value-prop, and competitor ops params', () => {
		const q2 = new URLSearchParams({
			[MC_OPS_JTBD_CATEGORY]: 'functional',
			[MC_OPS_JTBD_PRIORITY]: 'high',
			[MC_OPS_JTBD_VALIDATED]: 'true',
			[MC_OPS_VALUE_PROP_STATUS]: 'draft',
			[MC_OPS_COMPETITOR_TYPE]: 'direct',
		});
		expect(parseMarketingCabinetOpsListFilters(`?${q2.toString()}`)).toEqual({
			jtbd: { category: 'functional', priority: 'high', validated: 'true' },
			valueProp: { status: 'draft' },
			competitor: { competitor_type: 'direct' },
		});
	});
});

describe('stripMarketingCabinetParamsFromCurrentUrl', () => {
	it('removes mc_* and keeps other query params and hash', () => {
		const replaceState = vi.fn();
		Object.defineProperty(window, 'history', {
			configurable: true,
			value: { replaceState },
		});
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				href: 'https://app.eliteew.ru/mc?mc_view=chat&keep=1#desk',
				pathname: '/mc',
				search: '?mc_view=chat&keep=1',
				hash: '#desk',
			},
		});

		stripMarketingCabinetParamsFromCurrentUrl();

		expect(replaceState).toHaveBeenCalledWith(
			{},
			'',
			expect.stringContaining('/mc')
		);
		const third = replaceState.mock.calls[0][2] as string;
		expect(third).toContain('keep=1');
		expect(third).not.toContain('mc_view');
		expect(third).toContain('#desk');
	});

	it('no-ops when no mc_* present', () => {
		const replaceState = vi.fn();
		Object.defineProperty(window, 'history', {
			configurable: true,
			value: { replaceState },
		});
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				href: 'https://app.eliteew.ru/?x=1',
				pathname: '/',
				search: '?x=1',
				hash: '',
			},
		});

		stripMarketingCabinetParamsFromCurrentUrl();
		expect(replaceState).not.toHaveBeenCalled();
	});
});
