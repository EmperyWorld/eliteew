import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getShellReturnPageFromHash } from '../pageRouting';

describe('getShellReturnPageFromHash', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '#/');
	});

	afterEach(() => {
		window.history.replaceState(null, '', '#/');
	});

	it('returns desktop when return=desktop on login hash', () => {
		window.history.replaceState(null, '', '#/login?return=desktop');
		expect(getShellReturnPageFromHash()).toBe('desktop');
	});

	it('returns null for invalid return target', () => {
		window.history.replaceState(null, '', '#/login?return=not-a-real-page');
		expect(getShellReturnPageFromHash()).toBeNull();
	});

	it('returns null when no query', () => {
		window.history.replaceState(null, '', '#/login');
		expect(getShellReturnPageFromHash()).toBeNull();
	});
});
