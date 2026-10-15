import { describe, expect, it } from 'vitest';
import {
	buildDesktopStoreHashFragment,
	parseDesktopStoreAppIdFromHashFragment,
} from '../utils/desktopStoreHash';

describe('parseDesktopStoreAppIdFromHashFragment', () => {
	it('parses app id from desktop/store hash', () => {
		expect(parseDesktopStoreAppIdFromHashFragment('desktop/store/my-app')).toBe(
			'my-app'
		);
		expect(parseDesktopStoreAppIdFromHashFragment('desktop/store')).toBeNull();
		expect(
			parseDesktopStoreAppIdFromHashFragment('desktop/store/app-1?x=1')
		).toBe('app-1');
		expect(
			parseDesktopStoreAppIdFromHashFragment('desktop/store/app%20one')
		).toBe('app one');
	});
});

describe('buildDesktopStoreHashFragment', () => {
	it('builds store hash with optional app id', () => {
		expect(buildDesktopStoreHashFragment()).toBe('desktop/store');
		expect(buildDesktopStoreHashFragment(null)).toBe('desktop/store');
		expect(buildDesktopStoreHashFragment('my-app')).toBe(
			'desktop/store/my-app'
		);
		expect(buildDesktopStoreHashFragment('app one')).toBe(
			'desktop/store/app%20one'
		);
	});
});
