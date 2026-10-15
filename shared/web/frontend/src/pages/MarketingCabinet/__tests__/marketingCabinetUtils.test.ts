import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	copyToClipboard,
	downloadCsv,
	extractApiErrorMessage,
	getReadinessTone,
	isValidUrl,
	openDesktopApp,
	parseMultilineList,
	parseOptionalNumber,
	requireDefined,
} from '../utils';

describe('requireDefined', () => {
	it('returns value when present', () => {
		expect(requireDefined(42, 'x')).toBe(42);
	});

	it('throws with label when null or undefined', () => {
		expect(() => requireDefined(null, 'foo')).toThrow(
			'MarketingCabinet: expected foo'
		);
		expect(() => requireDefined(undefined, 'bar')).toThrow(
			'MarketingCabinet: expected bar'
		);
	});
});

describe('extractApiErrorMessage', () => {
	it('returns localized string detail from axios-like error', () => {
		const err = new Error('fail') as Error & {
			response?: { data?: { detail?: string } };
		};
		err.response = { data: { detail: 'Not authenticated' } };
		expect(extractApiErrorMessage(err, 'fallback')).toBe(
			'Требуется вход в систему.'
		);
	});

	it('uses first validation object msg from detail array', () => {
		const err = new Error('x') as Error & {
			response?: { data?: { detail?: { msg: string }[] } };
		};
		err.response = {
			data: { detail: [{ msg: 'Field required' }] },
		};
		expect(extractApiErrorMessage(err, 'f')).toBe('Field required');
	});

	it('falls back to Error.message when no detail', () => {
		expect(extractApiErrorMessage(new Error('plain'), 'f')).toBe('plain');
	});

	it('returns fallback for non-Error', () => {
		expect(extractApiErrorMessage('x', 'fallback')).toBe('fallback');
	});
});

describe('parseMultilineList', () => {
	it('splits on newlines and commas and trims', () => {
		expect(parseMultilineList('a\nb, c')).toEqual(['a', 'b', 'c']);
		expect(parseMultilineList('  \n  ')).toEqual([]);
	});
});

describe('parseOptionalNumber', () => {
	it('returns null for empty or non-finite', () => {
		expect(parseOptionalNumber('')).toBeNull();
		expect(parseOptionalNumber('  ')).toBeNull();
		expect(parseOptionalNumber('x')).toBeNull();
	});

	it('parses finite numbers', () => {
		expect(parseOptionalNumber('42')).toBe(42);
		expect(parseOptionalNumber(' 3.5 ')).toBe(3.5);
	});
});

describe('getReadinessTone', () => {
	it('returns tiered class strings', () => {
		expect(getReadinessTone(85)).toContain('desktop-surface-panel-strong');
		expect(getReadinessTone(60)).toContain('mc-accent-10');
		expect(getReadinessTone(10)).toContain('red-500');
	});
});

describe('openDesktopApp', () => {
	it('dispatches desktop-open-app with detail', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		openDesktopApp('FooApp', { x: 1 });
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({ appComponent: 'FooApp', x: 1 });
		window.removeEventListener('desktop-open-app', spy);
	});
});

describe('isValidUrl', () => {
	it('treats empty as valid (caller may allow blank)', () => {
		expect(isValidUrl('')).toBe(true);
		expect(isValidUrl('   ')).toBe(true);
	});

	it('accepts http(s) and bare hostnames', () => {
		expect(isValidUrl('https://example.com/path')).toBe(true);
		expect(isValidUrl('example.com')).toBe(true);
	});

	it('rejects invalid URLs', () => {
		expect(isValidUrl('not a url')).toBe(false);
	});
});

describe('copyToClipboard', () => {
	const writeText = vi.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		writeText.mockClear();
		Object.assign(navigator, {
			clipboard: { writeText },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns true on success', async () => {
		await expect(copyToClipboard('hi')).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('hi');
	});

	it('returns false when clipboard throws', async () => {
		writeText.mockRejectedValueOnce(new Error('denied'));
		await expect(copyToClipboard('x')).resolves.toBe(false);
	});
});

describe('downloadCsv', () => {
	it('creates a blob link and triggers download', () => {
		const createObjectURL = vi.fn().mockReturnValue('blob:mock');
		const revokeObjectURL = vi.fn();
		const click = vi.fn();
		const anchor = { click } as unknown as HTMLAnchorElement;
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL,
			revokeObjectURL,
		});
		const createEl = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag) => {
			if (tag === 'a') return anchor;
			return createEl(tag);
		});

		downloadCsv(
			[
				['a', 'b'],
				['1', '2'],
			],
			't.csv'
		);

		expect(createObjectURL).toHaveBeenCalled();
		expect(anchor.download).toBe('t.csv');
		expect(click).toHaveBeenCalled();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});
});
