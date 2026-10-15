/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure shell/tooltip helpers for Desktop AI Chat layout and settings copy.
 *
 * Invariants:
 * - No React imports; safe for hooks and components.
 *
 * Related:
 * - DesktopAiChatApp.tsx, hooks/useDesktopAiChatShellStyles.ts
 */
import type { TFunction } from 'i18next';
import type { DesktopAiChatItem } from '../api/desktopChatClient';
import { DESKTOP_SURFACE } from '../../../pages/Desktop/constants';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';

export function shellClass(theme: DesktopShellTheme): string {
	if (theme === 'light') {
		return [
			'h-full min-h-0 flex flex-col overflow-hidden font-[family-name:var(--font-desktop)]',
			DESKTOP_SURFACE.radiusLg,
			DESKTOP_SURFACE.border,
			'border-(--desktop-border-subtle) text-(--desktop-text-primary)',
			'bg-[color-mix(in_srgb,var(--desktop-surface-app)_97%,rgb(255,255,255)_03%)]',
			'backdrop-blur-md shadow-[0_18px_48px_rgba(0,0,0,0.1)]',
		].join(' ');
	}
	return [
		'h-full min-h-0 flex flex-col overflow-hidden font-[family-name:var(--font-desktop)]',
		DESKTOP_SURFACE.radiusLg,
		DESKTOP_SURFACE.border,
		'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] text-(--desktop-text-primary)',
		'bg-[color-mix(in_srgb,var(--glass-bg-strong)_82%,transparent)]',
		'backdrop-blur-md shadow-[0_28px_90px_rgba(0,0,0,0.45)]',
	].join(' ');
}

export function buildToolsTooltip(
	defaults: Record<string, unknown>,
	t: TFunction<'desktopAiChat'>
): string {
	const parts: string[] = [];
	if (defaults.tools_image_enabled !== false) {
		parts.push(t('toolsCapImages'));
	}
	if (defaults.tools_fetch_url_enabled !== false) {
		parts.push(t('toolsCapFetchUrl'));
	}
	if (defaults.tools_web_search_enabled === true) {
		parts.push(t('toolsCapWebSearch'));
	}
	if (!parts.length) {
		return t('toolsHintNone');
	}
	return t('toolsHintPrefix', { list: parts.join(', ') });
}

export function resolveDesktopChatModelLabel(
	chat: DesktopAiChatItem | null,
	defaults: Record<string, unknown>,
	t: TFunction<'desktopAiChat'>
): string {
	const fromChat = chat?.llama_model?.trim();
	if (fromChat) {
		return fromChat;
	}
	const d = defaults.default_llama_model;
	if (typeof d === 'string' && d.trim()) {
		return d.trim();
	}
	return t('modelDefaultServer');
}
