/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify Desktop AI web-search source extraction, deduplication, and safe-link normalization.
 *
 * Invariants:
 * - Unsafe protocols and credential-bearing URLs never reach source presentation.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopWebSearchSources.ts
 */
import { describe, expect, it } from 'vitest';

import {
	normalizeWebSearchSources,
	parseWebSearchSourcesFromToolText,
	resolveMessageWebSearchSources,
	webSearchSourcesFromDonePayload,
	webSearchSourcesFromToolsPayload,
} from '../desktopWebSearchSources';

describe('desktopWebSearchSources', () => {
	it('parses numbered web-search blocks from tool preview text', () => {
		const text = `[1] Example title
Short snippet line
URL: https://example.com/news

[2] Other
Another snippet
URL: https://example.org/a`;
		const sources = parseWebSearchSourcesFromToolText(text);
		expect(sources).toHaveLength(2);
		expect(sources[0]?.url).toBe('https://example.com/news');
		expect(sources[0]?.title).toBe('Example title');
	});

	it('extracts sources from tools SSE trace payload', () => {
		const payload = {
			trace: [
				{
					tools: [
						{
							name: 'web_search',
							preview: `[1] Hit
Snippet
URL: https://news.test/item`,
						},
					],
				},
			],
		};
		expect(webSearchSourcesFromToolsPayload(payload)).toEqual([
			{
				url: 'https://news.test/item',
				title: 'Hit',
				snippet: 'Snippet',
			},
		]);
	});

	it('prefers done payload web_search_sources over context fallback', () => {
		const payload = {
			web_search_sources: [{ url: 'https://a.test', title: 'A' }],
			context: {
				web_search_sources: [{ url: 'https://b.test', title: 'B' }],
			},
		};
		expect(webSearchSourcesFromDonePayload(payload)).toEqual([
			{ url: 'https://a.test', title: 'A' },
		]);
	});

	it('resolves message metadata from direct field or context_summary', () => {
		expect(
			resolveMessageWebSearchSources({
				desktop_web_search_sources: [{ url: 'https://direct.test' }],
			})
		).toEqual([{ url: 'https://direct.test' }]);
		expect(
			resolveMessageWebSearchSources({
				context_summary: {
					web_search_sources: [{ url: 'https://ctx.test', title: 'Ctx' }],
				},
			})
		).toEqual([{ url: 'https://ctx.test', title: 'Ctx' }]);
	});

	it('deduplicates normalized sources by url', () => {
		expect(
			normalizeWebSearchSources([
				{ url: 'https://dup.test', title: 'One' },
				{ url: 'https://dup.test', title: 'Two' },
			])
		).toEqual([{ url: 'https://dup.test', title: 'One' }]);
	});

	it('rejects unsafe protocols and embedded URL credentials', () => {
		expect(
			normalizeWebSearchSources([
				{ url: 'javascript:alert(1)' },
				{ url: 'data:text/html,unsafe' },
				{ url: 'https://user:secret@example.com/private' },
				{ url: 'https://safe.test/evidence', title: 'Safe' },
			])
		).toEqual([{ url: 'https://safe.test/evidence', title: 'Safe' }]);
		expect(
			parseWebSearchSourcesFromToolText('URL: javascript:alert(1)')
		).toEqual([]);
	});
});
