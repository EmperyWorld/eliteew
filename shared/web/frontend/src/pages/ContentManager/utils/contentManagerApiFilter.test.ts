import { describe, expect, it } from 'vitest';
import { resolveContentManagerApiFilter } from './contentManagerApiFilter';

describe('resolveContentManagerApiFilter', () => {
	it('omits filters for all', () => {
		expect(resolveContentManagerApiFilter('all')).toEqual({});
	});

	it('passes canonical API content types through', () => {
		expect(resolveContentManagerApiFilter('image')).toEqual({
			content_type: 'image',
		});
	});

	it('maps pdf saved view to document + application/pdf mime', () => {
		expect(resolveContentManagerApiFilter('pdf')).toEqual({
			content_type: 'document',
			mime_type: 'application/pdf',
		});
	});

	it('maps text UI filter to document + text/ mime prefix', () => {
		expect(resolveContentManagerApiFilter('text')).toEqual({
			content_type: 'document',
			mime_type: 'text/',
		});
	});
});
