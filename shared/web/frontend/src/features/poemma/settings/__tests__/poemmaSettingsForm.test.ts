import { describe, expect, it } from 'vitest';
import {
	parsePoemmaExperienceThresholdInput,
	validatePoemmaExperienceThreshold,
} from '../poemmaSettingsForm';

describe('poemmaSettingsForm', () => {
	it('parses threshold input', () => {
		expect(parsePoemmaExperienceThresholdInput('5')).toBe(5);
		expect(parsePoemmaExperienceThresholdInput(' 7,5 ')).toBe(7.5);
		expect(parsePoemmaExperienceThresholdInput('')).toBeNull();
	});

	it('validates threshold range', () => {
		expect(validatePoemmaExperienceThreshold(5)).toBeNull();
		expect(validatePoemmaExperienceThreshold(0)).toBe('Порог: от 1 до 100%');
		expect(validatePoemmaExperienceThreshold(101)).toBe('Порог: от 1 до 100%');
	});
});
