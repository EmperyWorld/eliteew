/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P15 lock — Settings Performance user copy must not expose Socket.IO / DevTools API jargon.
 *
 * Invariants:
 * - perfRealtimeMarksHint / active-adapters / suspended_adapters stay plain language.
 *
 * Related:
 * - src/i18n/locales/en|ru/desktopUi.json settingsPanel.*
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readJson(rel: string): unknown {
	return JSON.parse(
		readFileSync(resolve(process.cwd(), rel), 'utf8')
	) as unknown;
}

const FORBIDDEN = [
	'Socket.IO',
	'__eliteewSetPerfMode',
	'refetch',
	'/runtime',
	' UI/runtime',
];

describe('desktopSettingsPerformanceCopy.p15', () => {
	it('keeps EN Settings Performance hints free of transport/API jargon', () => {
		const en = readJson('src/i18n/locales/en/desktopUi.json') as {
			settingsPanel: {
				perfRealtimeMarksHint: string;
				perfStatActiveAdaptersHint: string;
			};
			performance: { recommendation: { suspended_adapters: string } };
		};
		const blob = [
			en.settingsPanel.perfRealtimeMarksHint,
			en.settingsPanel.perfStatActiveAdaptersHint,
			en.performance.recommendation.suspended_adapters,
		].join('\n');
		for (const term of FORBIDDEN) {
			expect(blob.includes(term)).toBe(false);
		}
		expect(en.settingsPanel.perfRealtimeMarksHint.toLowerCase()).toContain(
			'developer tools'
		);
	});

	it('keeps RU Settings Performance hints free of transport/API jargon', () => {
		const ru = readJson('src/i18n/locales/ru/desktopUi.json') as {
			settingsPanel: {
				perfRealtimeMarksHint: string;
				perfStatActiveAdaptersHint: string;
			};
			performance: { recommendation: { suspended_adapters: string } };
		};
		const blob = [
			ru.settingsPanel.perfRealtimeMarksHint,
			ru.settingsPanel.perfStatActiveAdaptersHint,
			ru.performance.recommendation.suspended_adapters,
		].join('\n');
		for (const term of [
			'Socket.IO',
			'__eliteewSetPerfMode',
			'refetch',
			'runtime',
		]) {
			expect(blob.includes(term)).toBe(false);
		}
	});
});
