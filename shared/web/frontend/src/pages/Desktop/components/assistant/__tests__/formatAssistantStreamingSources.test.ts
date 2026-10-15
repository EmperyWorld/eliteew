/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for streaming RAG source hint formatting (plan R11).
 */
import { describe, expect, it } from 'vitest';
import { formatAssistantStreamingSourcesHint } from '../formatAssistantStreamingSources';

const t = ((key: string, opts?: Record<string, unknown>) => {
	if (key === 'streamingSourcesHint') {
		return `hint:${opts?.sources}`;
	}
	if (key === 'streamingSourcesMore') {
		return ` (+${opts?.count} more)`;
	}
	return key;
}) as Parameters<typeof formatAssistantStreamingSourcesHint>[1];

describe('formatAssistantStreamingSourcesHint', () => {
	it('returns empty string when no labels', () => {
		expect(formatAssistantStreamingSourcesHint([], t)).toBe('');
	});

	it('shows at most two titles with overflow suffix', () => {
		const hint = formatAssistantStreamingSourcesHint(
			['Doc A', 'Doc B', 'Doc C'],
			t
		);
		expect(hint).toBe('hint:«Doc A»; «Doc B» (+1 more)');
	});
});
