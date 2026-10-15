import { describe, expect, it } from 'vitest';

import { parseServerUtcIsoMs } from '../parseServerUtcIso';

describe('parseServerUtcIsoMs', () => {
	it('treats naive ISO as UTC', () => {
		const ms = parseServerUtcIsoMs('2026-05-19T03:00:00');
		expect(ms).toBe(Date.parse('2026-05-19T03:00:00Z'));
	});

	it('passes through Z suffix', () => {
		const iso = '2026-05-19T03:00:00Z';
		expect(parseServerUtcIsoMs(iso)).toBe(Date.parse(iso));
	});
});
