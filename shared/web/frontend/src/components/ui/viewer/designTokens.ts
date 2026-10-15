/**
 * ============================================
 * FILE: designTokens.ts
 * ============================================
 *
 * Design tokens for document viewer components
 * Centralized styling constants following EliteEW design system
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const viewerColors = {
	// File type colors (matching FileTypeIcon categories)
	fileTypes: {
		document: {
			bg: 'bg-blue-500/20',
			text: 'text-blue-400',
			border: 'border-blue-500/30',
			gradient: 'from-blue-500 to-blue-600',
		},
		spreadsheet: {
			bg: 'bg-green-500/20',
			text: 'text-green-400',
			border: 'border-green-500/30',
			gradient: 'from-green-500 to-emerald-600',
		},
		presentation: {
			bg: 'bg-orange-500/20',
			text: 'text-orange-400',
			border: 'border-orange-500/30',
			gradient: 'from-orange-500 to-amber-600',
		},
		image: {
			bg: 'bg-purple-500/20',
			text: 'text-purple-400',
			border: 'border-purple-500/30',
			gradient: 'from-purple-500 to-pink-500',
		},
		video: {
			bg: 'bg-pink-500/20',
			text: 'text-pink-400',
			border: 'border-pink-500/30',
			gradient: 'from-pink-500 to-rose-600',
		},
		audio: {
			bg: 'bg-cyan-500/20',
			text: 'text-cyan-400',
			border: 'border-cyan-500/30',
			gradient: 'from-cyan-500 to-teal-600',
		},
		code: {
			bg: 'bg-indigo-500/20',
			text: 'text-indigo-400',
			border: 'border-indigo-500/30',
			gradient: 'from-indigo-500 to-violet-600',
		},
		archive: {
			bg: 'bg-amber-500/20',
			text: 'text-amber-400',
			border: 'border-amber-500/30',
			gradient: 'from-amber-500 to-yellow-600',
		},
		database: {
			bg: 'bg-emerald-500/20',
			text: 'text-emerald-400',
			border: 'border-emerald-500/30',
			gradient: 'from-emerald-500 to-green-600',
		},
		executable: {
			bg: 'bg-red-500/20',
			text: 'text-red-400',
			border: 'border-red-500/30',
			gradient: 'from-red-500 to-rose-600',
		},
		unknown: {
			bg: 'bg-gray-500/20',
			text: 'text-gray-400',
			border: 'border-gray-500/30',
			gradient: 'from-gray-500 to-gray-600',
		},
	},

	// Status colors
	status: {
		success: {
			bg: 'bg-green-500/20',
			text: 'text-green-400',
			border: 'border-green-500/30',
		},
		error: {
			bg: 'bg-red-500/20',
			text: 'text-red-400',
			border: 'border-red-500/30',
		},
		warning: {
			bg: 'bg-yellow-500/20',
			text: 'text-yellow-400',
			border: 'border-yellow-500/30',
		},
		info: {
			bg: 'bg-blue-500/20',
			text: 'text-blue-400',
			border: 'border-blue-500/30',
		},
	},

	// Glassmorphism backgrounds
	glass: {
		light: 'bg-white/5 backdrop-blur-xs',
		medium: 'bg-white/10 backdrop-blur-xl',
		strong: 'bg-slate-900/95 backdrop-blur-2xl',
	},

	// Borders
	borders: {
		subtle: 'border-white/10',
		medium: 'border-white/20',
		strong: 'border-white/30',
		primary: 'border-purple-500/50',
		selected: 'border-purple-500 ring-2 ring-purple-500/30',
	},
};

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const viewerTypography = {
	heading: {
		large: 'text-2xl font-bold text-white',
		medium: 'text-xl font-semibold text-white/90',
		small: 'text-lg font-semibold text-white/80',
	},

	body: {
		large: 'text-base font-normal text-white/90',
		medium: 'text-sm font-normal text-white/80',
		small: 'text-xs font-normal text-white/70',
	},

	label: {
		large: 'text-sm font-medium text-white/90',
		medium: 'text-xs font-medium text-white/80',
		small: 'text-xs font-normal text-white/70',
	},

	metadata: {
		primary: 'text-xs text-white/60',
		secondary: 'text-xs text-white/50',
		tertiary: 'text-xs text-white/40',
	},
};

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const viewerSpacing = {
	container: {
		padding: 'p-4 md:p-6 lg:p-8',
		gap: 'gap-4 md:gap-6',
	},

	card: {
		padding: 'p-3 md:p-4',
		gap: 'gap-2 md:gap-3',
	},

	toolbar: {
		padding: 'px-4 py-3',
		gap: 'gap-2',
	},

	grid: {
		cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
		gap: 'gap-3 md:gap-4',
	},
};

// ============================================================================
// COMPONENT TOKENS
// ============================================================================

export const viewerComponents = {
	button: {
		primary: `
      px-6 py-3
      bg-linear-to-r from-purple-500 to-pink-500
      hover:from-purple-600 hover:to-pink-600
      text-white font-semibold
      rounded-xl
      shadow-lg shadow-purple-500/40
      hover:shadow-xl hover:shadow-purple-500/50
      transition-all duration-200
      hover:scale-105 active:scale-95
      disabled:opacity-50 disabled:cursor-not-allowed
    `,

		secondary: `
      px-4 py-2.5
      bg-white/10 hover:bg-white/20
      border border-white/20 hover:border-white/30
      backdrop-blur-xl
      text-white/80 hover:text-white
      rounded-lg
      transition-all duration-200
      hover:scale-105 active:scale-95
    `,

		icon: `
      p-2
      bg-white/5 hover:bg-white/10
      rounded-lg
      transition-all duration-200
      hover:scale-105 active:scale-95
    `,

		danger: `
      px-4 py-2.5
      bg-linear-to-r from-red-500/80 to-rose-600/80
      hover:from-red-500 hover:to-rose-600
      text-white font-semibold
      rounded-lg
      shadow-lg shadow-red-500/40
      transition-all duration-200
      hover:scale-105 active:scale-95
    `,
	},

	card: {
		default: `
      p-4
      bg-white/10 backdrop-blur-xl
      border border-white/20
      rounded-xl
      hover:bg-white/15 hover:border-white/30
      transition-all duration-200
      cursor-pointer
      shadow-lg
    `,

		selected: `
      p-4
      bg-linear-to-br from-purple-500/20 to-pink-500/20
      border-2 border-purple-500/50
      ring-2 ring-purple-500/30
      rounded-xl
      transition-all duration-200
      cursor-pointer
      shadow-lg
    `,

		hover: 'hover:scale-102 hover:shadow-xl',
	},

	input: {
		default: `
      w-full px-4 py-2.5
      bg-white/10 backdrop-blur-xl
      border-2 border-white/20
      rounded-lg
      text-white placeholder-white/40
      focus:outline-hidden
      focus:border-purple-500/50
      focus:ring-4 focus:ring-purple-500/30
      transition-all duration-200
    `,
	},

	dropdown: {
		menu: `
      absolute z-50
      mt-2
      bg-slate-900/95 backdrop-blur-xl
      border border-white/20
      rounded-lg
      shadow-xl
      overflow-hidden
    `,

		item: `
      px-3 py-2
      text-sm text-white/80
      hover:bg-white/10
      transition-colors
      cursor-pointer
    `,
	},

	badge: {
		default: `
      px-2 py-0.5
      rounded-full
      text-xs font-medium
      border
    `,

		sizes: {
			sm: 'px-2 py-1 text-xs',
			md: 'px-3 py-1.5 text-sm',
			lg: 'px-4 py-2 text-base',
		},
	},
};

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const viewerAnimations = {
	transitions: {
		fast: 'transition-all duration-150',
		normal: 'transition-all duration-200',
		slow: 'transition-all duration-300',
	},

	hover: {
		scale: 'hover:scale-105',
		scaleSubtle: 'hover:scale-102',
		lift: 'hover:-translate-y-1',
	},

	active: {
		scale: 'active:scale-95',
	},
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export const viewerDesignTokens = {
	colors: viewerColors,
	typography: viewerTypography,
	spacing: viewerSpacing,
	components: viewerComponents,
	animations: viewerAnimations,
};

export default viewerDesignTokens;
