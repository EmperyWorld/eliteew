import type { GenerationType, ProviderHealth } from '../services/api/ugs/types';

const QUICK_LAUNCH_PRIORITY = [
	'image_generation_comfyui',
	'text_chat_response',
	'text_chat',
	'text_translation',
	'text_summarization',
	'text_code_generation',
	'text_code_review',
	'audio_generation_tts',
] as const;

const QUICK_LAUNCH_EXCLUDED_KEYS = new Set([
	'audio_transcription_faster_whisper',
	'document_analysis',
	'marketing_research_creator',
	'image_style_transfer',
	'image_background_removal',
	'image_enhance',
	'image_upscale_2x',
	'image_upscale_4k',
	'video_avatar_animation',
	'video_avatar_lip_sync',
]);

const QUICK_LAUNCH_BLOCKED_KEYWORDS = [
	'transcription',
	'document',
	'workflow',
	'style_transfer',
	'background_removal',
	'upscale',
	'restoration',
	'enhance',
	'avatar',
	'lip_sync',
] as const;

const QUICK_LAUNCH_FALLBACK_CATEGORIES = new Set(['text', 'image', 'audio']);

const buildProviderStatusMap = (
	providerHealth: ProviderHealth[]
): Map<string, ProviderHealth['status']> =>
	new Map(
		providerHealth
			.filter((provider) => provider.provider_name?.trim())
			.map((provider) => [
				provider.provider_name.trim().toLowerCase(),
				provider.status,
			])
	);

export const isQuickLaunchCompatibleType = (type: GenerationType): boolean => {
	const typeKey = type.type_key.trim().toLowerCase();
	if (!typeKey) {
		return false;
	}
	if (QUICK_LAUNCH_EXCLUDED_KEYS.has(typeKey)) {
		return false;
	}
	if (
		QUICK_LAUNCH_PRIORITY.includes(
			typeKey as (typeof QUICK_LAUNCH_PRIORITY)[number]
		)
	) {
		return true;
	}

	const category = type.category?.trim().toLowerCase() ?? '';
	if (!QUICK_LAUNCH_FALLBACK_CATEGORIES.has(category)) {
		return false;
	}

	return !QUICK_LAUNCH_BLOCKED_KEYWORDS.some((keyword) =>
		typeKey.includes(keyword)
	);
};

export const isQuickLaunchProviderAvailable = (
	type: GenerationType,
	providerStatusMap: Map<string, ProviderHealth['status']>
): boolean => {
	const provider = type.provider?.trim().toLowerCase();
	if (!provider) {
		return true;
	}

	const status = providerStatusMap.get(provider);
	return status === 'healthy';
};

export const getQuickLaunchGenerationTypes = (
	generationTypes: GenerationType[],
	providerHealth: ProviderHealth[],
	limit = 10
): GenerationType[] => {
	const providerStatusMap = buildProviderStatusMap(providerHealth);
	const typeMap = new Map(generationTypes.map((type) => [type.type_key, type]));
	const selected = new Map<string, GenerationType>();

	QUICK_LAUNCH_PRIORITY.forEach((typeKey) => {
		const type = typeMap.get(typeKey);
		if (!type) {
			return;
		}
		if (!isQuickLaunchCompatibleType(type)) {
			return;
		}
		if (!isQuickLaunchProviderAvailable(type, providerStatusMap)) {
			return;
		}
		selected.set(type.type_key, type);
	});

	generationTypes.forEach((type) => {
		if (selected.size >= limit) {
			return;
		}
		if (selected.has(type.type_key)) {
			return;
		}
		if (!isQuickLaunchCompatibleType(type)) {
			return;
		}
		if (!isQuickLaunchProviderAvailable(type, providerStatusMap)) {
			return;
		}
		selected.set(type.type_key, type);
	});

	return Array.from(selected.values()).slice(0, limit);
};
