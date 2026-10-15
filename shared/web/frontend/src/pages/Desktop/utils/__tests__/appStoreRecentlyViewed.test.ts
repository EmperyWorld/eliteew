import { beforeEach, describe, expect, it } from 'vitest';
import {
	pushRecentlyViewedAppId,
	readRecentlyViewedAppIds,
} from '../appStoreRecentlyViewed';

describe('appStoreRecentlyViewed', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('stores MRU ids without duplicates', () => {
		pushRecentlyViewedAppId('a');
		pushRecentlyViewedAppId('b');
		pushRecentlyViewedAppId('a');

		expect(readRecentlyViewedAppIds()).toEqual(['a', 'b']);
	});
});
