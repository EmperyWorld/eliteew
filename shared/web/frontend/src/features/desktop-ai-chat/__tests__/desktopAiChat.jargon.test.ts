/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard user-facing desktopAiChat locale copy against internal jargon (RAG/vault/TTS/MVP).
 * Wave F4: council* Process-tab keys must stay jargon-free (no SSE/metadata/orchestrator).
 * W2: Council user copy must not use product Discussion names; Discussion copy must not
 * use «Совещание» / Council.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const localePaths = [
	join(dir, '../../../i18n/locales/en/desktopAiChat.json'),
	join(dir, '../../../i18n/locales/ru/desktopAiChat.json'),
];

const JARGON = /\b(RAG|vault|TTS|MVP)\b/i;
/** Operator/internal terms banned on Process/«Совещание» user surface (Wave F4). */
const COUNCIL_JARGON =
	/\b(SSE|metadata|orchestrator|OpenAPI|finalizer|stitch|num_predict)\b/i;

/** Product Discussion names must not appear on Council / huddle user copy (W2). */
const COUNCIL_SURFACE_LEAK = /\bdiscussion\b|дискусс|обсужден/i;
/** Council / «Совещание» names must not appear on Discussion user copy (W2). */
const DISCUSSION_SURFACE_LEAK = /\bcouncil\b|совещани/i;

function isCouncilSurfaceKey(keyPath: string): boolean {
	return (
		keyPath.startsWith('council') ||
		keyPath.startsWith('ensembleCouncil') ||
		keyPath === 'ensembleDeliberating'
	);
}

/** Keys allowed to keep technical wording (footnotes, API errors, operator tooltips). */
const ALLOWLIST_KEY_SUFFIXES = [
	'contextRag',
	'contextVault',
	'contextTooltip',
	'blueprintContextChunks',
	'apiErrors',
	'toolsTrace',
	'attachChipBadgeRag',
];

function isAllowlistedKey(keyPath: string): boolean {
	if (keyPath.startsWith('context')) return true;
	if (keyPath.startsWith('blueprint')) return true;
	if (keyPath.startsWith('apiErrors')) return true;
	return ALLOWLIST_KEY_SUFFIXES.some((suffix) => keyPath.includes(suffix));
}

function collectStringLeaves(
	value: unknown,
	keyPath: string,
	out: Array<{ keyPath: string; text: string }>
): void {
	if (typeof value === 'string') {
		out.push({ keyPath, text: value });
		return;
	}
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			collectStringLeaves(v, keyPath ? `${keyPath}.${k}` : k, out);
		}
	}
}

describe('desktopAiChat locale jargon guard', () => {
	for (const localePath of localePaths) {
		it(`purges primary jargon in ${localePath.split('/').slice(-2).join('/')}`, () => {
			const raw = readFileSync(localePath, 'utf8');
			const json = JSON.parse(raw) as unknown;
			const leaves: Array<{ keyPath: string; text: string }> = [];
			collectStringLeaves(json, '', leaves);
			const offenders = leaves.filter(
				({ keyPath, text }) =>
					!isAllowlistedKey(keyPath) &&
					JARGON.test(text) &&
					!keyPath.startsWith('tour.step.') &&
					!keyPath.includes('contextSummaryTooltip')
			);
			expect(offenders).toEqual([]);
		});

		it(`keeps council Process copy jargon-free in ${localePath.split('/').slice(-2).join('/')}`, () => {
			const raw = readFileSync(localePath, 'utf8');
			const json = JSON.parse(raw) as unknown;
			const leaves: Array<{ keyPath: string; text: string }> = [];
			collectStringLeaves(json, '', leaves);
			const offenders = leaves.filter(
				({ keyPath, text }) =>
					keyPath.startsWith('council') && COUNCIL_JARGON.test(text)
			);
			expect(offenders).toEqual([]);
		});

		it(`keeps Council vs Discussion surface names isolated in ${localePath.split('/').slice(-2).join('/')}`, () => {
			const raw = readFileSync(localePath, 'utf8');
			const json = JSON.parse(raw) as unknown;
			const leaves: Array<{ keyPath: string; text: string }> = [];
			collectStringLeaves(json, '', leaves);
			const councilLeaks = leaves.filter(
				({ keyPath, text }) =>
					isCouncilSurfaceKey(keyPath) && COUNCIL_SURFACE_LEAK.test(text)
			);
			const discussionLeaks = leaves.filter(
				({ keyPath, text }) =>
					keyPath.startsWith('discussion') && DISCUSSION_SURFACE_LEAK.test(text)
			);
			expect(councilLeaks).toEqual([]);
			expect(discussionLeaks).toEqual([]);
			const bubbleRaw = leaves.filter(
				({ keyPath, text }) =>
					keyPath === 'streamErrorInBubble' &&
					(/\{\{raw\}\}/.test(text) || /discussion_active/i.test(text))
			);
			expect(bubbleRaw).toEqual([]);
		});
	}
});
