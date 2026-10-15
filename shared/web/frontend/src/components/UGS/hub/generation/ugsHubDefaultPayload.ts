/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Default JSON payloads for UGS Hub quick-launch / generation modal.
 *
 * Invariants:
 * - User-visible sample prompt/text/goal strings come from `ugsHub.generationDefaults.*`.
 *
 * Related:
 * - UgsHubGenerationModal.tsx, i18n/locales en+ru ugsHub.json
 */

import type { TFunction } from 'i18next';

import type { JsonObject } from '@/types/common';
import type { GenerationType } from '../../../../hooks/api/useUgsDashboard';

const getDefaultPayloads = (
	t: TFunction<'ugsHub'>
): Record<string, JsonObject> => ({
	text: {
		prompt: t('generationDefaults.textPrompt'),
		max_tokens: 600,
		temperature: 0.7,
	},
	image: {
		prompt: t('generationDefaults.imagePrompt'),
		width: 1024,
		height: 1024,
		steps: 24,
	},
	audio: {
		text: t('generationDefaults.audioText'),
		voice: 'elite-female-01',
		format: 'mp3',
	},
	document: {
		document_url: '',
		goal: t('generationDefaults.documentGoal'),
		summary_type: 'structured',
	},
});

export const normalizeGenerationTypeParameters = (
	type?: GenerationType | null
): JsonObject => {
	if (
		!type?.parameters ||
		typeof type.parameters !== 'object' ||
		Array.isArray(type.parameters)
	) {
		return {};
	}

	return { ...type.parameters };
};

export const getDefaultPromptForType = (
	t: TFunction<'ugsHub'>,
	typeKey: string
): string => {
	const normalizedTypeKey = typeKey.toLowerCase();
	if (normalizedTypeKey.includes('translation')) {
		return t('generationDefaults.translationPrompt');
	}
	if (normalizedTypeKey.includes('summarization')) {
		return t('generationDefaults.summarizationPrompt');
	}
	if (normalizedTypeKey.includes('code_review')) {
		return t('generationDefaults.codeReviewPrompt');
	}
	if (normalizedTypeKey.includes('code_generation')) {
		return t('generationDefaults.codeGenerationPrompt');
	}
	const fallback = getDefaultPayloads(t).text.prompt;
	return typeof fallback === 'string' ? fallback : '';
};

export const buildDefaultPayload = (
	t: TFunction<'ugsHub'>,
	type: GenerationType
): JsonObject => {
	const defaults = getDefaultPayloads(t);
	const typeKey = type.type_key;
	const normalizedCategory =
		type.category ||
		(typeKey.includes('image')
			? 'image'
			: typeKey.includes('audio')
				? 'audio'
				: typeKey.includes('document')
					? 'document'
					: 'text');

	const parameters = normalizeGenerationTypeParameters(type);

	if (normalizedCategory === 'image') {
		return {
			...defaults.image,
			negative_prompt: '',
			...parameters,
		};
	}

	if (normalizedCategory === 'audio') {
		return {
			...defaults.audio,
			...parameters,
		};
	}

	if (normalizedCategory === 'document') {
		return {
			...defaults.document,
			...parameters,
		};
	}

	return {
		...defaults.text,
		prompt: getDefaultPromptForType(t, typeKey),
		...parameters,
	};
};
