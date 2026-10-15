/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard soft HTTP app-build mismatch toast (one-shot per tab session).
 *
 * Related:
 * - src/utils/softAppBuildMismatchToast.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const warningMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
	toast: {
		warning: warningMock,
	},
}));

import {
	notifySoftAppBuildMismatchFromHeaders,
	resetSoftAppBuildMismatchToastForTests,
} from '../softAppBuildMismatchToast';

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('sessionStorage', {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
	});
	resetSoftAppBuildMismatchToastForTests();
	warningMock.mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	resetSoftAppBuildMismatchToastForTests();
	warningMock.mockClear();
});

describe('notifySoftAppBuildMismatchFromHeaders', () => {
	it('toasts once when mismatch header is present', () => {
		const headers = {
			get: (name: string) =>
				name.toLowerCase() === 'x-eliteew-app-build-status' ? 'mismatch' : null,
		};
		notifySoftAppBuildMismatchFromHeaders(headers);
		notifySoftAppBuildMismatchFromHeaders(headers);
		expect(warningMock).toHaveBeenCalledTimes(1);
	});

	it('ignores matching/current build responses', () => {
		notifySoftAppBuildMismatchFromHeaders({
			get: () => 'ok',
		});
		expect(warningMock).not.toHaveBeenCalled();
	});
});
