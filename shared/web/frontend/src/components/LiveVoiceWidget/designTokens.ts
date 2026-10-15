/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Design tokens for LiveVoiceWidget — aligned with Desktop `--desktop-*`.
 * Dock UI prefers opaque rgb fills from `liveVoiceLayoutTokens.ts` over glass surfaces.
 *
 * Related:
 * - liveVoiceLayoutTokens.ts, documentation/product/VOICE-CONTROL-STUDIO.md
 */

export const designTokens = {
	colors: {
		background: {
			/** Prefer opaque dock fills in layout tokens; these remain for legacy card chrome. */
			primary: 'rgb(var(--desktop-bg-primary-rgb) / 1)',
			secondary: 'rgb(var(--desktop-bg-secondary-rgb) / 1)',
			tertiary: 'rgb(var(--desktop-bg-secondary-rgb) / 1)',
		},
		border: {
			default: 'var(--desktop-border-subtle)',
			hover: 'var(--desktop-border-strong)',
		},
		text: {
			primary: 'var(--desktop-text-primary)',
			secondary: 'var(--desktop-text-secondary)',
			tertiary: 'var(--desktop-text-muted)',
			muted: 'var(--desktop-text-dim)',
		},
		accent: {
			primary: 'rgb(var(--desktop-accent-rgb))',
			danger: 'rgb(239 68 68)',
			neutral: 'rgb(161 161 170)',
		},
	},
	shadows: {
		sm: 'var(--desktop-shadow-soft)',
		md: 'var(--desktop-shadow-soft)',
		lg: 'var(--desktop-shadow-panel)',
		xl: 'var(--desktop-shadow-panel)',
		glow: {
			accent: '0 0 24px rgb(var(--desktop-accent-rgb) / 0.22)',
			danger: '0 0 20px rgb(239 68 68 / 0.25)',
		},
	},
	borderRadius: {
		sm: 'var(--desktop-radius)',
		md: 'var(--desktop-radius)',
		lg: 'var(--desktop-radius-lg)',
		xl: 'var(--desktop-radius-xl)',
	},
	spacing: {
		xs: '0.25rem',
		sm: '0.5rem',
		md: '1rem',
		lg: '1.5rem',
		xl: '2rem',
	},
};
