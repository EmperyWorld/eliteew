/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed catalog of **EWA SVG sprite** symbol ids (ported from EWASolution / fallup icon sets).
 *
 * Invariants:
 * - Each id must exist in ``sprites/ewa-icons-combined.svg``; symbol ids stay unprefixed for ``<use href="#…">``.
 *
 * Related:
 * - src/features/ewa/ewaIcons/EwaIcon.tsx
 * - src/features/ewa/ewaIcons/sprites/ewa-icons-combined.svg
 */

/** Status / connectivity (``status-icons.svg``). */
export type EwaStatusIconId =
	| 'icon-success'
	| 'icon-error'
	| 'icon-warning'
	| 'icon-info'
	| 'icon-loading'
	| 'icon-online'
	| 'icon-offline'
	| 'icon-processing'
	| 'icon-connected'
	| 'icon-disconnected';

/** EWA product marks (``ewa-special-icons.svg``). */
export type EwaSpecialIconId =
	| 'icon-ewa-brain'
	| 'icon-ewa-dashboard'
	| 'icon-ewa-analytics'
	| 'icon-ewa-plugins'
	| 'icon-ewa-perplexity'
	| 'icon-ewa-llama'
	| 'icon-ewa-android'
	| 'icon-ewa-smarthome'
	| 'icon-ewa-security';

/** Social / contact (``social-icons.svg``). */
export type EwaSocialIconId =
	| 'icon-telegram'
	| 'icon-whatsapp'
	| 'icon-discord'
	| 'icon-slack'
	| 'icon-github'
	| 'icon-linkedin'
	| 'icon-email'
	| 'icon-phone'
	| 'icon-website';

/** Interaction micro-icons (``interaction-icons.svg``). */
export type EwaInteractionIconId =
	| 'icon-like'
	| 'icon-like-empty'
	| 'icon-bookmark'
	| 'icon-bookmark-empty'
	| 'icon-star-filled'
	| 'icon-star-empty'
	| 'icon-hover-cursor'
	| 'icon-click-ripple'
	| 'icon-drag-handle'
	| 'icon-expand'
	| 'icon-collapse'
	| 'icon-pulse'
	| 'icon-fab'
	| 'icon-toast'
	| 'icon-loading-dots'
	| 'icon-progress-ring'
	| 'icon-toggle-on'
	| 'icon-toggle-off';

/** Accessibility marks (``accessibility-icons.svg``). */
export type EwaAccessibilityIconId =
	| 'icon-accessibility'
	| 'icon-screen-reader'
	| 'icon-high-contrast'
	| 'icon-large-text'
	| 'icon-voice-control'
	| 'icon-sign-language'
	| 'icon-keyboard-nav'
	| 'icon-focus-indicator'
	| 'icon-captions'
	| 'icon-motor-assistance'
	| 'icon-seizure-safe'
	| 'icon-dyslexia-friendly'
	| 'icon-colorblind-safe';

/** Stateful UI variants (``state-variants.svg``) — subset used in companion UI. */
export type EwaStateIconId =
	| 'icon-save-default'
	| 'icon-delete-default'
	| 'icon-play-default'
	| 'icon-pause-default'
	| 'icon-bell-default'
	| 'icon-search-default'
	| 'icon-menu-closed'
	| 'icon-wifi-excellent'
	| 'icon-battery-full';

export type EwaIconId =
	| EwaStatusIconId
	| EwaSpecialIconId
	| EwaSocialIconId
	| EwaInteractionIconId
	| EwaAccessibilityIconId
	| EwaStateIconId;

const _KNOWN = new Set<string>([
	'icon-success',
	'icon-error',
	'icon-warning',
	'icon-info',
	'icon-loading',
	'icon-online',
	'icon-offline',
	'icon-processing',
	'icon-connected',
	'icon-disconnected',
	'icon-ewa-brain',
	'icon-ewa-dashboard',
	'icon-ewa-analytics',
	'icon-ewa-plugins',
	'icon-ewa-perplexity',
	'icon-ewa-llama',
	'icon-ewa-android',
	'icon-ewa-smarthome',
	'icon-ewa-security',
	'icon-telegram',
	'icon-whatsapp',
	'icon-discord',
	'icon-slack',
	'icon-github',
	'icon-linkedin',
	'icon-email',
	'icon-phone',
	'icon-website',
	'icon-like',
	'icon-like-empty',
	'icon-bookmark',
	'icon-bookmark-empty',
	'icon-star-filled',
	'icon-star-empty',
	'icon-hover-cursor',
	'icon-click-ripple',
	'icon-drag-handle',
	'icon-expand',
	'icon-collapse',
	'icon-pulse',
	'icon-fab',
	'icon-toast',
	'icon-loading-dots',
	'icon-progress-ring',
	'icon-toggle-on',
	'icon-toggle-off',
	'icon-accessibility',
	'icon-screen-reader',
	'icon-high-contrast',
	'icon-large-text',
	'icon-voice-control',
	'icon-sign-language',
	'icon-keyboard-nav',
	'icon-focus-indicator',
	'icon-captions',
	'icon-motor-assistance',
	'icon-seizure-safe',
	'icon-dyslexia-friendly',
	'icon-colorblind-safe',
	'icon-save-default',
	'icon-delete-default',
	'icon-play-default',
	'icon-pause-default',
	'icon-bell-default',
	'icon-search-default',
	'icon-menu-closed',
	'icon-wifi-excellent',
	'icon-battery-full',
]);

export function isEwaIconId(value: string): value is EwaIconId {
	return _KNOWN.has(value);
}
