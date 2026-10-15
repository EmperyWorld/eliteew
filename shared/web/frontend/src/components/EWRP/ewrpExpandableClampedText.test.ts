import { describe, expect, it } from 'vitest';
import {
	ewrpClampedTextNeedsExpand,
	EWRP_EXPANDABLE_CLAMP_CHARS,
	ewrpErrorTextNeedsExpand,
	EWRP_EXPANDABLE_ERROR_COLLAPSE_CHARS,
} from './ewrpExpandableClampedText';

describe('ewrpClampedTextNeedsExpand', () => {
	it('returns false for short single-line text', () => {
		expect(ewrpClampedTextNeedsExpand('Queue timeout')).toBe(false);
	});

	it('returns true when text exceeds collapse threshold', () => {
		const long = 'x'.repeat(EWRP_EXPANDABLE_CLAMP_CHARS + 1);
		expect(ewrpClampedTextNeedsExpand(long)).toBe(true);
	});

	it('returns true for multiline text regardless of length', () => {
		expect(ewrpClampedTextNeedsExpand('line one\nline two')).toBe(true);
	});
});

describe('legacy ewrpErrorTextNeedsExpand aliases', () => {
	it('mirrors clamp helper and constant', () => {
		expect(EWRP_EXPANDABLE_ERROR_COLLAPSE_CHARS).toBe(
			EWRP_EXPANDABLE_CLAMP_CHARS
		);
		expect(ewrpErrorTextNeedsExpand('a\nb')).toBe(true);
	});
});
