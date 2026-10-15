/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prompt field helpers for UGS Hub generation modal (form-first payload editing).
 *
 * Invariants:
 * - Read prefers `prompt`, then `text`; write always sets `prompt`.
 *
 * Related:
 * - UgsHubGenerationModal.tsx, ugsHubDefaultPayload.ts
 */

import type { JsonObject } from '@/types/common';
import type { GenerationType } from '@/hooks/api/useUgsDashboard';

/** Preferred human prompt string from generation payload. */
export function getGenerationPrompt(payload: JsonObject): string {
	const prompt = payload.prompt;
	if (typeof prompt === 'string' && prompt.trim().length > 0) {
		return prompt;
	}
	const text = payload.text;
	if (typeof text === 'string') {
		return text;
	}
	if (typeof prompt === 'string') {
		return prompt;
	}
	return '';
}

/** Write prompt into payload under `prompt` (keeps other keys). */
export function setGenerationPrompt(
	payload: JsonObject,
	prompt: string
): JsonObject {
	return {
		...payload,
		prompt,
	};
}

/**
 * Web-search toggle is relevant for text-like types, or when payload already
 * carries `use_web_search`.
 */
export function generationTypeSupportsWebSearch(
	type: GenerationType | null | undefined,
	payload: JsonObject
): boolean {
	if ('use_web_search' in payload) {
		return true;
	}
	if (!type) {
		return false;
	}
	const category = (type.category || '').toLowerCase();
	if (category === 'text' || category === 'chat' || category === 'llm') {
		return true;
	}
	const key = type.type_key.toLowerCase();
	return (
		key.includes('text') ||
		key.includes('chat') ||
		key.includes('summar') ||
		key.includes('translation') ||
		key.includes('code_')
	);
}
