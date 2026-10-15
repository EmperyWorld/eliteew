/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Desktop AI blueprint artifact display helpers.
 *
 * Invariants:
 * - Heading extraction remains deterministic for persisted markdown artifacts.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiBlueprintArtifactBubble.tsx
 */
import { describe, expect, it } from 'vitest';

import {
	blueprintQualityTone,
	extractBlueprintMarkdownHeadings,
	resolveBlueprintHeadingElement,
} from '../DesktopAiBlueprintArtifactBubble';

describe('DesktopAiBlueprintArtifactBubble helpers', () => {
	it('extracts h2 and h3 headings for blueprint document navigation', () => {
		expect(
			extractBlueprintMarkdownHeadings(`
## Маркетинговый бриф

### Аудитория

body

## Validation
`)
		).toEqual([
			{ id: 'маркетинговый-бриф', title: 'Маркетинговый бриф', level: 2 },
			{ id: 'аудитория', title: 'Аудитория', level: 3 },
			{ id: 'validation', title: 'Validation', level: 2 },
		]);
	});

	it('maps backend quality status to stable UI tone', () => {
		expect(blueprintQualityTone('grounded')).toBe('good');
		expect(blueprintQualityTone('hypothesis_only')).toBe('warn');
		expect(blueprintQualityTone(undefined)).toBe('muted');
	});

	it('resolves blueprint heading by id then exact title', () => {
		const root = document.createElement('div');
		root.innerHTML = '<h2 id="audience">Audience</h2><h2 id="goals">Goals</h2>';
		expect(
			resolveBlueprintHeadingElement(root, {
				id: 'goals',
				title: 'Goals',
				level: 2,
			})?.id
		).toBe('goals');
		expect(
			resolveBlueprintHeadingElement(root, {
				id: 'missing',
				title: 'Audience',
				level: 2,
			})?.textContent
		).toBe('Audience');
	});
});
