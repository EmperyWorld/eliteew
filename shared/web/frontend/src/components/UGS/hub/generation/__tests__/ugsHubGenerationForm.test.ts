/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Hub generation prompt helpers.
 *
 * Related:
 * - ../ugsHubGenerationForm.ts
 */

import { describe, expect, it } from 'vitest';

import type { GenerationType } from '@/hooks/api/useUgsDashboard';
import {
	generationTypeSupportsWebSearch,
	getGenerationPrompt,
	setGenerationPrompt,
} from '../ugsHubGenerationForm';

describe('ugsHubGenerationForm', () => {
	it('reads prompt first, then text fallback', () => {
		expect(getGenerationPrompt({ prompt: 'A', text: 'B' })).toBe('A');
		expect(getGenerationPrompt({ text: 'B' })).toBe('B');
		expect(getGenerationPrompt({ prompt: '   ', text: 'B' })).toBe('B');
		expect(getGenerationPrompt({})).toBe('');
	});

	it('writes prompt without dropping other keys', () => {
		expect(setGenerationPrompt({ max_tokens: 10, text: 'old' }, 'new')).toEqual(
			{
				max_tokens: 10,
				text: 'old',
				prompt: 'new',
			}
		);
	});

	it('marks web search relevant for text-like types', () => {
		const textType = {
			type_key: 'text_chat',
			category: 'text',
		} as GenerationType;
		const imageType = {
			type_key: 'image_gen',
			category: 'image',
		} as GenerationType;

		expect(generationTypeSupportsWebSearch(textType, {})).toBe(true);
		expect(generationTypeSupportsWebSearch(imageType, {})).toBe(false);
		expect(
			generationTypeSupportsWebSearch(imageType, { use_web_search: false })
		).toBe(true);
	});
});
