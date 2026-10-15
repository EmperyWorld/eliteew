import { describe, expect, it } from 'vitest';
import {
	DEFAULT_TRACK_SORT_FIELD,
	DEFAULT_TRACK_SORT_ORDER,
} from './musicPlayerTypes';

describe('musicPlayerTypes defaults', () => {
	it('defaults to created date descending (newest first)', () => {
		expect(DEFAULT_TRACK_SORT_FIELD).toBe('date');
		expect(DEFAULT_TRACK_SORT_ORDER).toBe('desc');
	});
});
