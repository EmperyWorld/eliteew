import { describe, expect, it } from 'vitest';
import { clipboardImageBlobSource } from '../clipboardImageBlobSource';

describe('clipboardImageBlobSource', () => {
	it('routes /api/* to authenticated client', () => {
		expect(clipboardImageBlobSource('/api/v1/content/x/download')).toBe('api');
	});

	it('routes data URLs and blob URLs to fetch', () => {
		expect(clipboardImageBlobSource('data:image/png;base64,AAAA')).toBe(
			'fetch'
		);
		expect(clipboardImageBlobSource('blob:http://localhost/x')).toBe('fetch');
	});
});
