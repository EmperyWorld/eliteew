/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for @-mention handle normalization and query parsing.
 *
 * Related:
 * - mentionUtils.ts
 */

import { describe, expect, it } from 'vitest';

import {
	applyMentionToText,
	normalizeMentionHandle,
	resolveActiveMentionQuery,
} from '@/components/UltimateDocEditor/Panels/commentsReview/mentionUtils';

describe('mentionUtils', () => {
	it('normalizeMentionHandle trims, lowercases, and caps length', () => {
		expect(normalizeMentionHandle('  Alice Smith  ')).toBe('alice_smith');
		expect(normalizeMentionHandle('a'.repeat(40))).toHaveLength(32);
	});

	it('resolveActiveMentionQuery detects trailing @ token', () => {
		expect(resolveActiveMentionQuery('hello world')).toBeNull();
		expect(resolveActiveMentionQuery('ping @ali')).toBe('ali');
		expect(resolveActiveMentionQuery('@')).toBe('');
	});

	it('applyMentionToText replaces trailing @ token with handle', () => {
		expect(applyMentionToText('please review @al', 'alice')).toBe(
			'please review @alice '
		);
	});
});
