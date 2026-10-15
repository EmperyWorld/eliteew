/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub structured body assembly helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	assembleBugBody,
	assembleWishBody,
	buildFeedbackSubmitBody,
	createEmptyBugForm,
	createEmptyWishForm,
} from '../feedbackHubBodyAssembler';

const label = (key: string) => key;

describe('feedbackHubBodyAssembler', () => {
	it('assembles wish blocks only when included and non-empty', () => {
		const form = createEmptyWishForm();
		form.p1 = { include: true, text: '  Dark mode  ' };
		form.p2 = { include: true, text: '   ' };
		form.p3 = { include: false, text: 'ignored' };
		expect(assembleWishBody(form, label)).toBe('cheatSheetWishP1: Dark mode');
	});

	it('assembles bug body with frequency label', () => {
		const form = createEmptyBugForm();
		form.expected = { include: true, text: 'Save works' };
		form.freq = 'always';
		expect(assembleBugBody(form, label)).toBe(
			'cheatSheetBugP1: Save works\n\ncheatSheetBugP4: freqAlways'
		);
	});

	it('returns empty string when no blocks selected', () => {
		expect(assembleWishBody(createEmptyWishForm(), label)).toBe('');
		expect(assembleBugBody(createEmptyBugForm(), label)).toBe('');
	});

	it('merges main message and structured template for submit', () => {
		expect(buildFeedbackSubmitBody('Main line', 'Extra block')).toBe(
			'Main line\n\nExtra block'
		);
		expect(buildFeedbackSubmitBody('  Only main  ', '')).toBe('Only main');
		expect(buildFeedbackSubmitBody('', '  Template only  ')).toBe(
			'Template only'
		);
		expect(buildFeedbackSubmitBody('   ', '   ')).toBe('');
	});
});
