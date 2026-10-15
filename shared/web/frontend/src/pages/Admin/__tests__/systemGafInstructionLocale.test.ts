/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	parseGafInstructionLocaleFromJson,
	resolveGafInstructionLocale,
} from '../systemGafInstructionLocale';

describe('systemGafInstructionLocale', () => {
	it('resolveGafInstructionLocale maps app language to ru or en', () => {
		expect(resolveGafInstructionLocale('ru')).toBe('ru');
		expect(resolveGafInstructionLocale('ru-RU')).toBe('ru');
		expect(resolveGafInstructionLocale('en')).toBe('en');
		expect(resolveGafInstructionLocale('en-US')).toBe('en');
		expect(resolveGafInstructionLocale(undefined)).toBe('ru');
	});

	it('parseGafInstructionLocaleFromJson accepts ru/en only', () => {
		expect(parseGafInstructionLocaleFromJson('ru')).toBe('ru');
		expect(parseGafInstructionLocaleFromJson(' EN ')).toBe('en');
		expect(parseGafInstructionLocaleFromJson('de')).toBeNull();
		expect(parseGafInstructionLocaleFromJson(1)).toBeNull();
	});
});
