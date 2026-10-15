import { describe, expect, it } from 'vitest';
import { ewrpSlideLayoutI18nKey } from './EwrpGeneratorChunks';

describe('ewrpSlideLayoutI18nKey', () => {
	it('maps empty layout to auto', () => {
		expect(ewrpSlideLayoutI18nKey('')).toBe('auto');
	});

	it('passes through API layout ids', () => {
		expect(ewrpSlideLayoutI18nKey('default')).toBe('default');
		expect(ewrpSlideLayoutI18nKey('fullbleed')).toBe('fullbleed');
	});
});
