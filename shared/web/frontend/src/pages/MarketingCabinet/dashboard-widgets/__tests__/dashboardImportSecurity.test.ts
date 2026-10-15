import { describe, expect, it } from 'vitest';

import {
	marketingDashboardUrlAllowHostsFromCommaList,
	stripExternalHttpUrlString,
	stripExternalHttpUrlsFromJsonValue,
} from '../dashboardImportSecurity';

describe('dashboardImportSecurity', () => {
	it('strips whole-string http URLs when allowlist empty', () => {
		expect(stripExternalHttpUrlString('https://evil.test/x', new Set())).toBe(
			''
		);
	});

	it('preserves whole-string URL when hostname is allowlisted', () => {
		const allow =
			marketingDashboardUrlAllowHostsFromCommaList('Allowed.EXAMPLE');
		expect(
			stripExternalHttpUrlString('https://allowed.example/path', allow)
		).toBe('https://allowed.example/path');
	});

	it('parses comma-separated hosts like API allowlist', () => {
		const s = marketingDashboardUrlAllowHostsFromCommaList(
			' Foo.com , bar.org '
		);
		expect(s.has('foo.com')).toBe(true);
		expect(s.has('bar.org')).toBe(true);
	});

	it('preserves non-URL strings', () => {
		expect(stripExternalHttpUrlString('hello / relative', new Set())).toBe(
			'hello / relative'
		);
	});

	it('keeps canvasMarkdown subtree including URLs in text', () => {
		const md = 'Link https://x.test in markdown';
		const o = stripExternalHttpUrlsFromJsonValue(
			{ canvasMarkdown: md, metric: 'https://y.test' },
			new Set()
		) as Record<string, unknown>;
		expect(o.canvasMarkdown).toBe(md);
		expect(o.metric).toBe('');
	});

	/** Mirrors `test_dashboard_widget_config.py` N.138-style cases for `chart_metric`. */
	it('strips metric URL but keeps chartKind when allowlist empty (nested)', () => {
		const out = stripExternalHttpUrlsFromJsonValue(
			{
				metric: 'https://evil.example/path',
				chartKind: 'line',
			},
			new Set()
		) as Record<string, unknown>;
		expect(out).toEqual({ metric: '', chartKind: 'line' });
	});

	it('recurses into arrays and nested objects (max depth)', () => {
		const out = stripExternalHttpUrlsFromJsonValue(
			{
				items: [{ u: 'https://a.test' }, 'https://b.test'],
			},
			new Set()
		) as Record<string, unknown>;
		expect(out).toEqual({ items: [{ u: '' }, ''] });
	});
});
