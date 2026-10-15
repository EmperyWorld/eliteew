/**
 * Design Tokens - EliteEW Marketing Cabinet
 * Type-safe design system tokens for consistent UI development
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Usage:
 * import { tokens } from '@/styles/tokens';
 * const myColor = tokens.colors.marketing.pink[500];
 *
 * Features:
 * - Full TypeScript support with IntelliSense
 * - Marketing Cabinet color palette
 * - Glassmorphism effects
 * - Spacing scale (8px base)
 * - Typography system
 * - Animation tokens
 * - Shadow and glow effects
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const colors = {
	// Marketing Cabinet Primary Colors
	marketing: {
		pink: {
			50: '#fdf2f8',
			100: '#fce7f3',
			200: '#fbcfe8',
			300: '#f9a8d4',
			400: '#f472b6',
			500: '#ec4899', // Primary Marketing Cabinet pink
			600: '#db2777',
			700: '#be185d',
			800: '#9f1239',
			900: '#831843',
		},
		purple: {
			50: '#faf5ff',
			100: '#f3e8ff',
			200: '#e9d5ff',
			300: '#d8b4fe',
			400: '#c084fc',
			500: '#8b5cf6', // Primary Marketing Cabinet purple
			600: '#7c3aed',
			700: '#6d28d9',
			800: '#5b21b6',
			900: '#4c1d95',
		},
		blue: {
			50: '#eff6ff',
			100: '#dbeafe',
			200: '#bfdbfe',
			300: '#93c5fd',
			400: '#60a5fa',
			500: '#3b82f6', // Primary Marketing Cabinet blue
			600: '#2563eb',
			700: '#1d4ed8',
			800: '#1e40af',
			900: '#1e3a8a',
		},
		green: {
			50: '#ecfdf5',
			100: '#d1fae5',
			200: '#a7f3d0',
			300: '#6ee7b7',
			400: '#34d399',
			500: '#10b981', // Success/positive
			600: '#059669',
			700: '#047857',
			800: '#065f46',
			900: '#064e3b',
		},
		amber: {
			50: '#fffbeb',
			100: '#fef3c7',
			200: '#fde68a',
			300: '#fcd34d',
			400: '#fbbf24',
			500: '#f59e0b', // Warning/highlight
			600: '#d97706',
			700: '#b45309',
			800: '#92400e',
			900: '#78350f',
		},
		cyan: {
			50: '#ecfeff',
			100: '#cffafe',
			200: '#a5f3fc',
			300: '#67e8f9',
			400: '#22d3ee',
			500: '#06b6d4', // Accent
			600: '#0891b2',
			700: '#0e7490',
			800: '#155e75',
			900: '#164e63',
		},
	},

	// Neutral Colors (Dark Theme)
	slate: {
		50: '#f8fafc',
		100: '#f1f5f9',
		200: '#e2e8f0',
		300: '#cbd5e1',
		400: '#94a3b8',
		500: '#64748b',
		600: '#475569',
		700: '#334155',
		800: '#1e293b',
		900: '#0f172a', // Base background
	},

	// Semantic Colors
	semantic: {
		success: '#10b981',
		warning: '#f59e0b',
		error: '#ef4444',
		info: '#3b82f6',
	},

	// White with opacity variations
	white: {
		100: '#ffffff',
		90: 'rgba(255, 255, 255, 0.9)',
		80: 'rgba(255, 255, 255, 0.8)',
		70: 'rgba(255, 255, 255, 0.7)',
		60: 'rgba(255, 255, 255, 0.6)',
		50: 'rgba(255, 255, 255, 0.5)',
		40: 'rgba(255, 255, 255, 0.4)',
		30: 'rgba(255, 255, 255, 0.3)',
		20: 'rgba(255, 255, 255, 0.2)',
		10: 'rgba(255, 255, 255, 0.1)',
		5: 'rgba(255, 255, 255, 0.05)',
	},

	// Black with opacity variations
	black: {
		100: '#000000',
		90: 'rgba(0, 0, 0, 0.9)',
		80: 'rgba(0, 0, 0, 0.8)',
		70: 'rgba(0, 0, 0, 0.7)',
		60: 'rgba(0, 0, 0, 0.6)',
		50: 'rgba(0, 0, 0, 0.5)',
		40: 'rgba(0, 0, 0, 0.4)',
		30: 'rgba(0, 0, 0, 0.3)',
		20: 'rgba(0, 0, 0, 0.2)',
		10: 'rgba(0, 0, 0, 0.1)',
		5: 'rgba(0, 0, 0, 0.05)',
	},
} as const;

// ============================================================================
// GLASSMORPHISM
// ============================================================================

export const glass = {
	background: {
		light: 'rgba(15, 23, 42, 0.4)',
		default: 'rgba(15, 23, 42, 0.6)',
		strong: 'rgba(15, 23, 42, 0.8)',
		darker: 'rgba(15, 23, 42, 0.9)',
	},
	border: {
		default: 'rgba(255, 255, 255, 0.1)',
		hover: 'rgba(255, 255, 255, 0.2)',
		active: 'rgba(255, 255, 255, 0.3)',
	},
	blur: {
		sm: '8px',
		default: '12px',
		lg: '16px',
		xl: '20px',
	},
} as const;

// ============================================================================
// SPACING SYSTEM (8px base)
// ============================================================================

export const spacing = {
	0: '0',
	0.5: '0.125rem', // 2px
	1: '0.25rem', // 4px
	1.5: '0.375rem', // 6px
	2: '0.5rem', // 8px
	2.5: '0.625rem', // 10px
	3: '0.75rem', // 12px
	3.5: '0.875rem', // 14px
	4: '1rem', // 16px
	5: '1.25rem', // 20px
	6: '1.5rem', // 24px
	7: '1.75rem', // 28px
	8: '2rem', // 32px
	9: '2.25rem', // 36px
	10: '2.5rem', // 40px
	11: '2.75rem', // 44px
	12: '3rem', // 48px
	14: '3.5rem', // 56px
	16: '4rem', // 64px
	20: '5rem', // 80px
	24: '6rem', // 96px
	28: '7rem', // 112px
	32: '8rem', // 128px
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const radius = {
	none: '0',
	sm: '0.375rem', // 6px
	default: '0.5rem', // 8px
	md: '0.5rem', // 8px
	lg: '0.75rem', // 12px
	xl: '1rem', // 16px
	'2xl': '1.5rem', // 24px
	'3xl': '2rem', // 32px
	full: '9999px',
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
	fontFamily: {
		sans: "'Inter', 'Segoe UI', system-ui, sans-serif",
		mono: "'Fira Code', 'Consolas', monospace",
	},
	fontSize: {
		xs: '0.75rem', // 12px
		sm: '0.875rem', // 14px
		base: '1rem', // 16px
		lg: '1.125rem', // 18px
		xl: '1.25rem', // 20px
		'2xl': '1.5rem', // 24px
		'3xl': '1.875rem', // 30px
		'4xl': '2.25rem', // 36px
		'5xl': '3rem', // 48px
		'6xl': '3.75rem', // 60px
		'7xl': '4.5rem', // 72px
		'8xl': '6rem', // 96px
		'9xl': '8rem', // 128px
	},
	fontWeight: {
		thin: '100',
		extralight: '200',
		light: '300',
		normal: '400',
		medium: '500',
		semibold: '600',
		bold: '700',
		extrabold: '800',
		black: '900',
	},
	lineHeight: {
		none: '1',
		tight: '1.25',
		snug: '1.375',
		normal: '1.5',
		relaxed: '1.625',
		loose: '2',
	},
	letterSpacing: {
		tighter: '-0.05em',
		tight: '-0.025em',
		normal: '0',
		wide: '0.025em',
		wider: '0.05em',
		widest: '0.1em',
	},
} as const;

// ============================================================================
// SHADOWS & GLOWS
// ============================================================================

export const shadows = {
	// Standard Shadows
	xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
	sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
	default: '0 2px 8px rgba(0, 0, 0, 0.2)',
	md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
	lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
	xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
	'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
	inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
	none: '0 0 #0000',

	// Glow Effects
	glow: {
		pink: {
			sm: '0 0 10px rgba(236, 72, 153, 0.3)',
			default: '0 0 20px rgba(236, 72, 153, 0.4)',
			lg: '0 0 30px rgba(236, 72, 153, 0.5)',
			xl: '0 0 40px rgba(236, 72, 153, 0.6)',
		},
		purple: {
			sm: '0 0 10px rgba(139, 92, 246, 0.3)',
			default: '0 0 20px rgba(139, 92, 246, 0.4)',
			lg: '0 0 30px rgba(139, 92, 246, 0.5)',
			xl: '0 0 40px rgba(139, 92, 246, 0.6)',
		},
		blue: {
			sm: '0 0 10px rgba(59, 130, 246, 0.3)',
			default: '0 0 20px rgba(59, 130, 246, 0.4)',
			lg: '0 0 30px rgba(59, 130, 246, 0.5)',
			xl: '0 0 40px rgba(59, 130, 246, 0.6)',
		},
		green: {
			sm: '0 0 10px rgba(16, 185, 129, 0.3)',
			default: '0 0 20px rgba(16, 185, 129, 0.4)',
			lg: '0 0 30px rgba(16, 185, 129, 0.5)',
			xl: '0 0 40px rgba(16, 185, 129, 0.6)',
		},
		amber: {
			sm: '0 0 10px rgba(245, 158, 11, 0.3)',
			default: '0 0 20px rgba(245, 158, 11, 0.4)',
			lg: '0 0 30px rgba(245, 158, 11, 0.5)',
			xl: '0 0 40px rgba(245, 158, 11, 0.6)',
		},
	},
} as const;

// ============================================================================
// GRADIENTS
// ============================================================================

export const gradients = {
	// Marketing Cabinet Gradients
	marketing: {
		primary: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', // Purple to Pink
		secondary: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Pink to Rose
		accent: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue to Cyan
		success: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', // Green
		warning: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', // Amber
		danger: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', // Red
	},

	// Mesh Gradients
	mesh: {
		purple:
			'radial-gradient(at 0% 0%, #a855f7 0%, transparent 50%), radial-gradient(at 100% 100%, #ec4899 0%, transparent 50%)',
		blue: 'radial-gradient(at 0% 100%, #3b82f6 0%, transparent 50%), radial-gradient(at 100% 0%, #06b6d4 0%, transparent 50%)',
	},

	// Background Gradients
	background: {
		dark: 'linear-gradient(135deg, #0f172a, #1e293b, #334155)',
		darkRadial: 'radial-gradient(circle at top, #1e293b, #0f172a)',
	},
} as const;

// ============================================================================
// ANIMATION
// ============================================================================

export const animation = {
	duration: {
		instant: '50ms',
		fast: '150ms',
		normal: '250ms',
		slow: '400ms',
		slower: '600ms',
	},
	easing: {
		linear: 'linear',
		in: 'cubic-bezier(0.4, 0, 1, 1)',
		out: 'cubic-bezier(0, 0, 0.2, 1)',
		inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
		elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
		bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
	},
	// Common animation values
	scale: {
		hover: 1.02,
		active: 0.98,
		grow: 1.05,
	},
	translate: {
		hover: '-4px',
		slideIn: '20px',
	},
} as const;

// ============================================================================
// Z-INDEX LAYERS
// ============================================================================

export const zIndex = {
	base: 0,
	dropdown: 1000,
	sticky: 1100,
	fixed: 1200,
	modalBackdrop: 1300,
	modal: 1400,
	popover: 1500,
	tooltip: 1600,
	notification: 1700,
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
	xs: '475px',
	sm: '640px',
	md: '768px',
	lg: '1024px',
	xl: '1280px',
	'2xl': '1536px',
} as const;

// ============================================================================
// COMPONENT TOKENS (Common Patterns)
// ============================================================================

export const components = {
	// Common card styles
	card: {
		glass: {
			background: glass.background.default,
			border: glass.border.default,
			backdropBlur: glass.blur.default,
			borderRadius: radius.xl,
			padding: spacing[6],
		},
		glassPadding: {
			sm: spacing[4],
			md: spacing[6],
			lg: spacing[8],
		},
	},

	// Common button styles
	button: {
		height: {
			sm: '2rem', // 32px
			md: '2.5rem', // 40px
			lg: '3rem', // 48px
		},
		padding: {
			sm: `${spacing[2]} ${spacing[4]}`,
			md: `${spacing[3]} ${spacing[6]}`,
			lg: `${spacing[4]} ${spacing[8]}`,
		},
	},

	// Icon sizes
	icon: {
		xs: '0.75rem', // 12px
		sm: '1rem', // 16px
		md: '1.25rem', // 20px
		lg: '1.5rem', // 24px
		xl: '2rem', // 32px
		'2xl': '2.5rem', // 40px
	},
} as const;

// ============================================================================
// COMPLETE TOKENS EXPORT
// ============================================================================

export const tokens = {
	colors,
	glass,
	spacing,
	radius,
	typography,
	shadows,
	gradients,
	animation,
	zIndex,
	breakpoints,
	components,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ColorScale = typeof colors.marketing.pink;
export type SpacingScale = keyof typeof spacing;
export type RadiusScale = keyof typeof radius;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;

export default tokens;
