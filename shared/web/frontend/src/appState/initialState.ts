import { resolveInitialPage } from '../utils/pageRouting';
import type { AppState, AppTheme, ShellPageType } from './types';

export const DARK_THEME: AppTheme = {
	primary: '#3B82F6',
	secondary: '#8B5CF6',
	background: 'linear-gradient(135deg, #1e293b, #334155, #475569)',
	surface: '#1e293b',
	text: '#f8fafc',
	accent: '#10b981',
	success: '#22c55e',
	warning: '#f59e0b',
	error: '#ef4444',
	info: '#06b6d4',
};

export const LIGHT_THEME: AppTheme = {
	primary: '#2563eb',
	secondary: '#7c3aed',
	background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0, #cbd5e1)',
	surface: '#ffffff',
	text: '#1e293b',
	accent: '#059669',
	success: '#16a34a',
	warning: '#d97706',
	error: '#dc2626',
	info: '#0891b2',
};

/** Presets for desktop window chrome (align with shell light/dark, not global SPA theme). */
export const APP_THEME_PRESET_DARK = DARK_THEME;
export const APP_THEME_PRESET_LIGHT = LIGHT_THEME;

export const initialAppState: AppState = {
	currentPage: resolveInitialPage() as ShellPageType,
	user: null,
	isLoading: true,
	isAuthenticated: false,
	settings: {
		theme: 'dark',
		language: 'ru',
		notifications: true,
		animations: true,
		autoSave: true,
		compactMode: false,
		developerMode: false,
		performanceMode: false,
	},
	theme: DARK_THEME,
	navigationHistory: [],
	notifications: [],
	error: null,
	errorBoundary: {
		hasError: false,
		errorInfo: null,
		errorStack: null,
	},
	performance: {
		pageLoadTimes: {} as Partial<Record<ShellPageType, number>>,
		renderCount: 0,
		lastRenderTime: Date.now(),
		memoryUsage: 0,
	},
	websocket: {
		connected: false,
		lastMessage: null,
		subscriptions: new Set(),
	},
	sidebar: {
		isOpen: true,
		isCompact: false,
	},
	modals: {
		settings: false,
		profile: false,
		notifications: false,
		diagnostics: false,
	},
};
