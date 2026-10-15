import { describe, expect, it } from 'vitest';
import { parseEwrpStatusResponse } from './ewrpStatusResponse';

describe('parseEwrpStatusResponse', () => {
	it('reads flat axios data', () => {
		const status = { status: 'completed', progress: 100 };
		expect(parseEwrpStatusResponse({ data: status })).toEqual(status);
	});

	it('reads nested data.data', () => {
		const status = { status: 'generating_images', progress: 20 };
		expect(parseEwrpStatusResponse({ data: { data: status } })).toEqual(status);
	});

	it('returns null for invalid payload', () => {
		expect(parseEwrpStatusResponse(null)).toBeNull();
		expect(parseEwrpStatusResponse({ data: { foo: 1 } })).toBeNull();
	});
});
