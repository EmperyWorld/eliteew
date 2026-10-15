/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static operator option values, default URLs, and layout class maps for UGS admin UI.
 *
 * Invariants:
 * - Default URLs mirror stack service names used in production compose; changing them affects new-provider forms only.
 * - User-visible labels come from `ugsAdmin` i18n via `ugsAdminOptionLabelI18n` / `ugsAdminSelectOptions`.
 *
 * Related:
 * - src/services/api/ugsAdmin.ts (GenerationProviderDTO)
 * - src/features/ugs/shared/ugsAdminUi.tsx
 * - src/i18n/locales/en/ugsAdmin.json, ru/ugsAdmin.json
 */

import type { TFunction } from 'i18next';

import type { SelectOption } from '@/components/ui/SelectV2';
import type {
	GenerationProviderDTO,
	UGSSettingDTO,
} from '@/services/api/ugsAdmin';

import type {
	UgsAdminBadgeVariant,
	UgsAdminButtonVariant,
} from './ugsAdminUiTypes';

export type UgsAdminOptionMapKey =
	| 'providerTypes'
	| 'scopes'
	| 'genCategories'
	| 'priorities'
	| 'complexities';

/** English fallbacks when i18n key is missing (tests, non-React callers). */
export const PROVIDER_TYPE_LABELS_EN: Record<string, string> = {
	llama: 'Text (llama.cpp)',
	comfyui: 'Media render',
	silero: 'Speech synthesis',
	faster_whisper: 'Speech recognition',
	stable_diffusion: 'Diffusion (web UI)',
	supir: 'Image enhancement',
	sadtalker: 'Speech-driven animation',
	miso: 'Text (alternative)',
	openwebui: 'Web chat',
	localai: 'Local gateway',
	vllm: 'Text server (high load)',
	custom: 'Custom',
};

export const SCOPE_LABELS_EN: Record<string, string> = {
	global: 'Global',
	company: 'Company',
	project: 'Project',
	user: 'User',
};

export const GEN_CATEGORY_LABELS_EN: Record<string, string> = {
	text: 'Text',
	image: 'Images',
	audio: 'Audio',
	video: 'Video',
	workflow: 'Workflow',
	utility: 'Utility',
};

export const COMPLEXITY_LABELS_EN: Record<string, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
};

const OPTION_MAP_EN: Record<UgsAdminOptionMapKey, Record<string, string>> = {
	providerTypes: PROVIDER_TYPE_LABELS_EN,
	scopes: SCOPE_LABELS_EN,
	genCategories: GEN_CATEGORY_LABELS_EN,
	priorities: COMPLEXITY_LABELS_EN,
	complexities: COMPLEXITY_LABELS_EN,
};

export const PROVIDER_TYPE_VALUES = [
	'llama',
	'comfyui',
	'silero',
	'faster_whisper',
	'stable_diffusion',
	'supir',
	'sadtalker',
	'miso',
	'openwebui',
	'localai',
	'vllm',
	'custom',
] as const;

export const SCOPE_VALUES = ['global', 'company', 'project', 'user'] as const;

export const GENERATION_CATEGORY_VALUES = [
	'text',
	'image',
	'audio',
	'video',
	'workflow',
	'utility',
] as const;

export const COMPLEXITY_VALUES = ['low', 'medium', 'high'] as const;

export function ugsAdminOptionLabelI18n(
	value: string,
	mapKey: UgsAdminOptionMapKey,
	t: TFunction<'ugsAdmin'>
): string {
	const key = `${mapKey}.${value}`;
	const label = t(key);
	if (label !== key) {
		return label;
	}
	return OPTION_MAP_EN[mapKey][value] ?? value;
}

export function ugsAdminSelectOptions(
	values: readonly string[],
	mapKey: UgsAdminOptionMapKey,
	t: TFunction<'ugsAdmin'>
): SelectOption[] {
	return values.map((value) => ({
		value,
		label: ugsAdminOptionLabelI18n(value, mapKey, t),
	}));
}

export const PROVIDER_TYPE_DEFAULTS: Record<
	string,
	Partial<GenerationProviderDTO>
> = {
	llama: {
		base_url: 'http://stack2-llama-chat:8080',
		health_endpoint: '/health',
		timeout_seconds: 120,
		max_concurrent: 4,
	},
	comfyui: {
		base_url: 'http://stack2-comfyui:3000',
		health_endpoint: '/system_stats',
		timeout_seconds: 300,
		max_concurrent: 2,
	},
	silero: {
		base_url: 'http://stack9-silero:8000',
		health_endpoint: '/health',
		timeout_seconds: 90,
		max_concurrent: 3,
	},
	faster_whisper: {
		base_url: 'local',
		health_endpoint: '',
		timeout_seconds: 120,
		max_concurrent: 1,
	},
	stable_diffusion: {
		base_url: 'http://stack2-stable-diffusion:7860',
		health_endpoint: '/sdapi/v1/system-info',
		timeout_seconds: 240,
		max_concurrent: 2,
	},
	supir: {
		base_url: 'http://stack2-supir:8000',
		health_endpoint: '/health',
		timeout_seconds: 240,
		max_concurrent: 2,
	},
	sadtalker: {
		base_url: 'http://stack2-sadtalker:8000',
		health_endpoint: '/health',
		timeout_seconds: 240,
		max_concurrent: 2,
	},
	miso: {
		base_url: 'http://stack2-llama-chat:8080',
		health_endpoint: '/health',
		timeout_seconds: 180,
		max_concurrent: 2,
	},
	openwebui: {
		base_url: 'http://stack0-openwebui:8080',
		health_endpoint: '/api/v1/health',
		timeout_seconds: 120,
		max_concurrent: 4,
	},
	localai: {
		base_url: 'http://stack0-localai:8080',
		health_endpoint: '/health',
		timeout_seconds: 120,
		max_concurrent: 4,
	},
};

export const badgeClasses: Record<UgsAdminBadgeVariant, string> = {
	default:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
	success:
		'border border-emerald-400/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
	info: 'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)',
	warning:
		'border border-amber-400/30 bg-amber-500/12 text-amber-800 dark:text-amber-200',
	secondary:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 text-(--desktop-text-secondary)',
};

export const buttonClasses: Record<UgsAdminButtonVariant, string> = {
	primary:
		'border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-accent-rgb)/0.22)]',
	secondary:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	ghost:
		'border border-(--desktop-border-subtle) bg-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	danger:
		'border border-rose-500/35 bg-rose-600/15 text-rose-800 hover:bg-rose-600/25 dark:text-rose-200',
};

export { ugsAdminOverviewCardClass as ugsOverviewCardClass } from '@/features/ugs/shared/ugsDesktopUi';
export { ugsAdminEntityCardClass as ugsEntityCardClass } from '@/features/ugs/shared/ugsDesktopUi';
export { ugsAdminCardHeaderRowClass as ugsCardHeaderRowClass } from '@/features/ugs/shared/ugsDesktopUi';

export const ugsFieldLabelClass =
	'text-[0.6875rem] font-medium uppercase tracking-wide text-(--desktop-text-muted)';

export const ugsJsonPanelClass =
	'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-xs text-(--desktop-text-secondary) shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--desktop-border-subtle)_40%,transparent)]';

export const scopeBadgeMap: Record<
	UGSSettingDTO['scope'],
	UgsAdminBadgeVariant
> = {
	global: 'info',
	company: 'warning',
	project: 'info',
	user: 'success',
};

export const DEFAULT_WORKFLOW_JSON = '{}';
