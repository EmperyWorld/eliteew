import { describe, expect, it, vi } from 'vitest';

import {
	formatDiagnosticIsoDateTime,
	formatDiagnosticModuleKeyLabel,
} from './diagnosticUiFormat';

describe('formatDiagnosticIsoDateTime', () => {
	it('returns em dash for empty input', () => {
		expect(formatDiagnosticIsoDateTime('', 'ru-RU')).toBe('—');
		expect(formatDiagnosticIsoDateTime(undefined, 'ru-RU')).toBe('—');
	});

	it('returns original string when parse fails', () => {
		expect(formatDiagnosticIsoDateTime('not-a-date', 'ru-RU')).toBe(
			'not-a-date'
		);
	});

	it('formats valid ISO with locale', () => {
		const out = formatDiagnosticIsoDateTime(
			'2026-04-13T12:30:00.000Z',
			'en-US'
		);
		// en-US short date may show two-digit year (e.g. 4/13/26)
		expect(out).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
		expect(out.length).toBeGreaterThan(4);
	});
});

describe('formatDiagnosticModuleKeyLabel', () => {
	it('uses i18n for known module keys', () => {
		const t = vi.fn((k: string) => `lbl:${k}`);
		expect(formatDiagnosticModuleKeyLabel('values', t)).toBe(
			'lbl:diagnostic.moduleSubtitle.values'
		);
		expect(t).toHaveBeenCalledWith('diagnostic.moduleSubtitle.values');
	});

	it('returns raw key for unknown modules', () => {
		const t = vi.fn();
		expect(formatDiagnosticModuleKeyLabel('unknown_mod', t)).toBe(
			'unknown_mod'
		);
		expect(t).not.toHaveBeenCalled();
	});
});
