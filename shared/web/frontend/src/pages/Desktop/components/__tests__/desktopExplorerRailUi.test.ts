import { describe, expect, it } from 'vitest';
import { folderNameMonogram } from '../desktopExplorerRailUi';

describe('folderNameMonogram', () => {
	it('returns first two letters uppercased', () => {
		expect(folderNameMonogram('Музыка')).toBe('МУ');
		expect(folderNameMonogram('Documents')).toBe('DO');
	});

	it('skips leading spaces', () => {
		expect(folderNameMonogram('  Elite EW')).toBe('EL');
	});

	it('falls back for empty names', () => {
		expect(folderNameMonogram('   ')).toBe('??');
	});
});
