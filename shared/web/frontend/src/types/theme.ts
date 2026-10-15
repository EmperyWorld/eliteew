/**
 * 🎨 THEME SYSTEM TYPES
 * Complete TypeScript interfaces for theme customization system
 */

export interface ThemeColors {
	primary: string;
	secondary: string;
	accent: string;
	background: string;
	surface: string;
	text: string;
	textSecondary: string;
	border: string;
	success: string;
	warning: string;
	error: string;
	info?: string;
}

export interface ThemeGradients {
	primary: string;
	secondary: string;
	background: string;
	button: string;
	card: string;
	accent?: string;
	glow?: string;
}

export interface ThemeEffects {
	blur: number;
	shadows: boolean;
	shadowIntensity: number;
	glow: boolean;
	glowIntensity: number;
	borderOpacity: number;
	surfaceOpacity: number;
	glassmorphism?: boolean;
	particles?: boolean;
}

export interface ThemeTypography {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	headingWeight?: number;
}

export interface ThemeSpacing {
	scale: number;
	cardPadding: number;
	buttonPadding: number;
	sectionGap?: number;
	elementGap?: number;
}

export interface ThemeBorders {
	radius: number;
	width: number;
	style: 'solid' | 'dashed' | 'dotted' | 'none';
	cardRadius?: number;
	buttonRadius?: number;
	inputRadius?: number;
}

export interface ThemeAnimation {
	duration: number;
	easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
	hoverScale?: number;
	activeScale?: number;
}

export interface ThemeMetadata {
	author?: string;
	version?: string;
	category?: string;
	tags?: string[];
}

export interface Theme {
	id: string;
	name: string;
	type: 'preset' | 'custom';
	description?: string;
	colors: ThemeColors;
	gradients: ThemeGradients;
	effects: ThemeEffects;
	typography: ThemeTypography;
	spacing: ThemeSpacing;
	borders: ThemeBorders;
	animation: ThemeAnimation;
	metadata?: ThemeMetadata;
}

export interface UserTheme {
	id: string;
	user_id?: string;
	theme_data: Theme;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

// API Response types
export interface PresetsResponse {
	presets: Theme[];
	count: number;
}

export interface MyThemesResponse {
	themes: Theme[];
	active_theme: Theme | null;
}

export interface ActiveThemeResponse {
	theme: Theme;
	is_default: boolean;
}

export interface ThemeResponse {
	success: boolean;
	theme: Theme;
	id?: string;
	message?: string;
}

export interface ThemeStatsResponse {
	total_themes: number;
	custom_themes: number;
	active_theme_name: string | null;
	available_presets: number;
	preset_names: string[];
}

// Utility types
export type ThemeType = 'preset' | 'custom';
export type ThemeCategory = 'Rich' | 'Minimalist' | 'Custom';

// Default preset IDs
export const PRESET_IDS = {
	RICH: 'preset-rich',
	MINIMALIST: 'preset-minimalist',
} as const;

export type PresetId = (typeof PRESET_IDS)[keyof typeof PRESET_IDS];
