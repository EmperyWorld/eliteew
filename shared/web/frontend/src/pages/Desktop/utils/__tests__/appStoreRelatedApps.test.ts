import { describe, expect, it } from 'vitest';
import { storeAppFixture } from '../../components/appStore/__tests__/storeAppFixture';
import { pickRelatedStoreApps } from '../appStoreRelatedApps';

function app(overrides: Parameters<typeof storeAppFixture>[0]) {
	return storeAppFixture(overrides);
}

describe('pickRelatedStoreApps', () => {
	it('returns same-category peers excluding the current app', () => {
		const current = app({ app_id: 'a', name: 'Alpha', category: 'widgets' });
		const peers = [
			current,
			app({ app_id: 'b', name: 'Beta', category: 'widgets', sort_order: 1 }),
			app({
				app_id: 'c',
				name: 'Gamma',
				category: 'communication',
				sort_order: 0,
			}),
		];

		expect(pickRelatedStoreApps(peers, current)).toEqual([peers[1]]);
	});
});
