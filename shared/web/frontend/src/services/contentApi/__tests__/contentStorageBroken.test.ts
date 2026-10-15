/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: vi.fn(),
}));

import { APIError } from '@/services/api/client';
import {
	isContentStorageObjectUnavailable,
	openContentManagerBrokenFilesTab,
	resolveContentManagerInitialTab,
} from '@/services/contentApi/contentStorageBroken';

describe('contentStorageBroken', () => {
	it('detects storage-missing 404', () => {
		expect(
			isContentStorageObjectUnavailable(new APIError('x', 404, 'NOT_FOUND'))
		).toBe(true);
		expect(isContentStorageObjectUnavailable(new APIError('x', 503, 'X'))).toBe(
			false
		);
	});

	it('resolves brokenFiles tab', () => {
		expect(resolveContentManagerInitialTab('brokenFiles')).toBe('brokenFiles');
		expect(resolveContentManagerInitialTab('nope')).toBeUndefined();
	});

	it('opens Content Manager on broken tab', async () => {
		const { requestOpenDesktopApp } = await import(
			'@/pages/Desktop/utils/desktopDeepLink'
		);
		openContentManagerBrokenFilesTab();
		expect(requestOpenDesktopApp).toHaveBeenCalledWith({
			appComponent: 'ContentManagerPro',
			contentManagerInitialTab: 'brokenFiles',
		});
	});
});
