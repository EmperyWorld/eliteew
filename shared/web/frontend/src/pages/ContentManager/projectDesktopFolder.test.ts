import { describe, expect, it } from 'vitest';
import {
	parseProjectIdFromDesktopFolderItemId,
	projectContentFolderItemId,
} from './projectDesktopFolder';

describe('parseProjectIdFromDesktopFolderItemId', () => {
	it('returns uuid rest for prefixed ids', () => {
		expect(
			parseProjectIdFromDesktopFolderItemId(
				'eliteew-proj-550e8400-e29b-41d4-a716-446655440000'
			)
		).toBe('550e8400-e29b-41d4-a716-446655440000');
	});

	it('returns null for ordinary folders and garbage', () => {
		expect(parseProjectIdFromDesktopFolderItemId('folder-1')).toBeNull();
		expect(parseProjectIdFromDesktopFolderItemId('eliteew-proj-')).toBeNull();
		expect(parseProjectIdFromDesktopFolderItemId('eliteew-proj-  ')).toBeNull();
	});

	it('round-trips with projectContentFolderItemId', () => {
		const id = 'aa0e8400-e29b-41d4-a716-446655440001';
		const itemId = projectContentFolderItemId(id);
		expect(parseProjectIdFromDesktopFolderItemId(itemId)).toBe(id);
	});
});
