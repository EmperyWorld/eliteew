/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Validates the shared rehype builder used by assistant markdown surfaces.
 *
 * Invariants:
 * - The resulting plugin chain always ends with `rehype-sanitize`.
 * - Link attributes needed by desktop chat UX (`target`, `rel`) stay in sanitize schema.
 *
 * Related:
 * - src/components/assistantMessage/sharedChatRehypePlugins.ts
 */
import rehypeSanitize from 'rehype-sanitize';
import { describe, expect, it } from 'vitest';

import { buildSharedChatRehypePlugins } from '@/components/assistantMessage/sharedChatRehypePlugins';

describe('buildSharedChatRehypePlugins', () => {
	it('appends rehype-sanitize with shared schema', () => {
		const plugins = buildSharedChatRehypePlugins();
		expect(plugins).toHaveLength(1);

		const sanitizePlugin = plugins[plugins.length - 1];
		expect(Array.isArray(sanitizePlugin)).toBe(true);
		if (!Array.isArray(sanitizePlugin)) {
			return;
		}

		expect(sanitizePlugin[0]).toBe(rehypeSanitize);
		const schema = sanitizePlugin[1] as
			| { attributes?: Record<string, unknown[]> }
			| undefined;
		expect(schema?.attributes?.a).toEqual(
			expect.arrayContaining(['target', 'rel'])
		);
	});
});
