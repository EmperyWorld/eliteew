/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWA SVG icon + tone mapping for built-in companion tool/quick-action chips.
 *
 * Invariants:
 * - Built-in ids use ``EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX``; unknown ids fall back to ``icon-pulse``.
 *
 * Related:
 * - src/features/ewa/ewaCompanionQuickPresetsUi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import type { EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import type { BuiltinQuickPresetKey } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionQuickPresetVisual = {
	icon: EwaIconId;
	tone: EwaIconTone;
};

const BUILTIN_PRESET_VISUALS: Record<
	BuiltinQuickPresetKey,
	CompanionQuickPresetVisual
> = {
	documentList: { icon: 'icon-search-default', tone: 'brand' },
	documentOpen: { icon: 'icon-ewa-plugins', tone: 'brand' },
	documentCreate: { icon: 'icon-bookmark', tone: 'aura' },
	documentRewrite: { icon: 'icon-high-contrast', tone: 'aura' },
	catalogDiscuss: { icon: 'icon-focus-indicator', tone: 'muted' },
	fileRename: { icon: 'icon-drag-handle', tone: 'aura' },
	fileDelete: { icon: 'icon-delete-default', tone: 'danger' },
	imageGenerate: { icon: 'icon-star-filled', tone: 'aura' },
	imageEdit: { icon: 'icon-drag-handle', tone: 'brand' },
	imageAnalyze: { icon: 'icon-focus-indicator', tone: 'muted' },
	presentationCreate: { icon: 'icon-ewa-analytics', tone: 'aura' },
	presentationOnTopic: { icon: 'icon-ewa-analytics', tone: 'brand' },
	socialPostCompose: { icon: 'icon-ewa-dashboard', tone: 'brand' },
	musicStudioOpen: { icon: 'icon-ewa-perplexity', tone: 'brand' },
	xlBaseInteractive: { icon: 'icon-pulse', tone: 'brand' },
	musicAutonomous: { icon: 'icon-ewa-perplexity', tone: 'brand' },
	operationsStatus: { icon: 'icon-ewa-dashboard', tone: 'brand' },
	operationsCancel: { icon: 'icon-warning', tone: 'warning' },
	musicGenerate: { icon: 'icon-pulse', tone: 'brand' },
	musicOnTopic: { icon: 'icon-pulse', tone: 'aura' },
	planWeek: { icon: 'icon-success', tone: 'success' },
	themeSet: { icon: 'icon-high-contrast', tone: 'aura' },
};

const DEFAULT_VISUAL: CompanionQuickPresetVisual = {
	icon: 'icon-pulse',
	tone: 'muted',
};

/** Resolve chip icon from preset id (built-in suffix or server uuid). */
export function companionQuickPresetVisual(
	presetId: string,
	iconOverride?: CompanionQuickPresetVisual | null
): CompanionQuickPresetVisual {
	if (iconOverride?.icon) {
		return iconOverride;
	}
	if (!presetId.startsWith(EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX)) {
		return DEFAULT_VISUAL;
	}
	const key = presetId.slice(
		EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX.length
	) as BuiltinQuickPresetKey | string;
	if (typeof key === 'string' && key.startsWith('planComplete:')) {
		return { icon: 'icon-success', tone: 'success' };
	}
	return BUILTIN_PRESET_VISUALS[key as BuiltinQuickPresetKey] ?? DEFAULT_VISUAL;
}
