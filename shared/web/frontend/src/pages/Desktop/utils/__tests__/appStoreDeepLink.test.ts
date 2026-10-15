import { describe, expect, it } from 'vitest';
import { buildDesktopStoreHashFragment } from '../desktopStoreHash';
import { buildAppStoreAppDeepLink } from '../appStoreDeepLink';

describe('buildAppStoreAppDeepLink', () => {
	it('embeds the store hash fragment for an app id', () => {
		const link = buildAppStoreAppDeepLink('my-app');
		expect(link).toContain(`#${buildDesktopStoreHashFragment('my-app')}`);
	});
});
