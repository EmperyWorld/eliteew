/**
 * 🎨 THEME CONTEXT
 * Global theme management with persistence and real-time updates
 */

import type { FC, ReactNode } from 'react';
import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from 'react';
import type { Theme } from '../types/theme';
import { PRESET_IDS } from '../types/theme';
import { log } from '../utils/logger';

const LOG_COMPONENT = 'ThemeContext';

interface ThemeContextValue {
	theme: Theme | null;
	loading: boolean;
	error: string | null;
	setTheme: (theme: Theme) => void;
	refreshTheme: () => Promise<void>;
	applyPreset: (presetId: string) => Promise<void>;
	applyThemeToDOM: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = (): ThemeContextValue => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};

interface ThemeProviderProps {
	children: ReactNode;
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
	const [theme, setThemeState] = useState<Theme | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Apply theme to DOM via CSS custom properties
	 */
	const applyThemeToDOM = useCallback((theme: Theme): void => {
		const root = document.documentElement;

		// Colors
		root.style.setProperty('--theme-primary', theme.colors.primary);
		root.style.setProperty('--theme-secondary', theme.colors.secondary);
		root.style.setProperty('--theme-accent', theme.colors.accent);
		root.style.setProperty('--theme-background', theme.colors.background);
		root.style.setProperty('--theme-surface', theme.colors.surface);
		root.style.setProperty('--theme-text', theme.colors.text);
		root.style.setProperty(
			'--theme-text-secondary',
			theme.colors.textSecondary
		);
		root.style.setProperty('--theme-border', theme.colors.border);
		root.style.setProperty('--theme-success', theme.colors.success);
		root.style.setProperty('--theme-warning', theme.colors.warning);
		root.style.setProperty('--theme-error', theme.colors.error);

		if (theme.colors.info) {
			root.style.setProperty('--theme-info', theme.colors.info);
		}

		// Effects
		root.style.setProperty('--theme-blur', `${theme.effects.blur}px`);
		root.style.setProperty(
			'--theme-shadow-intensity',
			theme.effects.shadowIntensity.toString()
		);
		root.style.setProperty(
			'--theme-glow-intensity',
			theme.effects.glowIntensity.toString()
		);
		root.style.setProperty(
			'--theme-border-opacity',
			theme.effects.borderOpacity.toString()
		);
		root.style.setProperty(
			'--theme-surface-opacity',
			theme.effects.surfaceOpacity.toString()
		);
		root.style.setProperty(
			'--theme-shadows',
			theme.effects.shadows ? '1' : '0'
		);
		root.style.setProperty('--theme-glow', theme.effects.glow ? '1' : '0');

		// Typography
		root.style.setProperty('--theme-font-family', theme.typography.fontFamily);
		root.style.setProperty(
			'--theme-font-size',
			`${theme.typography.fontSize}px`
		);
		root.style.setProperty(
			'--theme-font-weight',
			theme.typography.fontWeight.toString()
		);
		root.style.setProperty(
			'--theme-line-height',
			theme.typography.lineHeight.toString()
		);

		if (theme.typography.headingWeight) {
			root.style.setProperty(
				'--theme-heading-weight',
				theme.typography.headingWeight.toString()
			);
		}

		// Spacing
		root.style.setProperty(
			'--theme-spacing-scale',
			theme.spacing.scale.toString()
		);
		root.style.setProperty(
			'--theme-card-padding',
			`${theme.spacing.cardPadding}px`
		);
		root.style.setProperty(
			'--theme-button-padding',
			`${theme.spacing.buttonPadding}px`
		);

		if (theme.spacing.sectionGap) {
			root.style.setProperty(
				'--theme-section-gap',
				`${theme.spacing.sectionGap}px`
			);
		}
		if (theme.spacing.elementGap) {
			root.style.setProperty(
				'--theme-element-gap',
				`${theme.spacing.elementGap}px`
			);
		}

		// Borders
		root.style.setProperty(
			'--theme-border-radius',
			`${theme.borders.radius}px`
		);
		root.style.setProperty('--theme-border-width', `${theme.borders.width}px`);
		root.style.setProperty('--theme-border-style', theme.borders.style);

		if (theme.borders.cardRadius) {
			root.style.setProperty(
				'--theme-card-radius',
				`${theme.borders.cardRadius}px`
			);
		}
		if (theme.borders.buttonRadius) {
			root.style.setProperty(
				'--theme-button-radius',
				`${theme.borders.buttonRadius}px`
			);
		}
		if (theme.borders.inputRadius) {
			root.style.setProperty(
				'--theme-input-radius',
				`${theme.borders.inputRadius}px`
			);
		}

		// Animation
		root.style.setProperty(
			'--theme-animation-duration',
			`${theme.animation.duration}ms`
		);
		root.style.setProperty('--theme-animation-easing', theme.animation.easing);

		if (theme.animation.hoverScale) {
			root.style.setProperty(
				'--theme-hover-scale',
				theme.animation.hoverScale.toString()
			);
		}
		if (theme.animation.activeScale) {
			root.style.setProperty(
				'--theme-active-scale',
				theme.animation.activeScale.toString()
			);
		}

		// Store in localStorage for instant load on next visit
		try {
			localStorage.setItem('active_theme', JSON.stringify(theme));
			localStorage.setItem('active_theme_id', theme.id);
			localStorage.setItem('active_theme_timestamp', Date.now().toString());
		} catch (err) {
			log.warn(LOG_COMPONENT, 'Failed to save theme to localStorage', err);
		}

		log.info(LOG_COMPONENT, `Theme applied: ${theme.name} (${theme.type})`);
	}, []);

	/**
	 * Load active theme from localStorage ONLY (no API calls to prevent blocking)
	 * ⚡ PERFORMANCE FIX: Removed API calls that caused 80+ second page load times
	 */
	const loadActiveTheme = useCallback(async () => {
		try {
			// Load from localStorage only
			const cachedTheme = localStorage.getItem('active_theme');

			if (cachedTheme) {
				const loadedTheme = JSON.parse(cachedTheme);
				setThemeState(loadedTheme);
				applyThemeToDOM(loadedTheme);
				log.info(LOG_COMPONENT, 'Theme loaded from cache (instant)');
			} else {
				// Use hardcoded default theme (Visual Richness preset)
				const defaultTheme: Theme = {
					id: PRESET_IDS.RICH,
					name: 'Visual Richness',
					type: 'preset',
					colors: {
						primary: '#0ea5e9',
						secondary: '#8b5cf6',
						accent: '#f59e0b',
						background: '#0f172a',
						surface: '#1e293b',
						text: '#f1f5f9',
						textSecondary: '#cbd5e1',
						border: '#334155',
						success: '#10b981',
						warning: '#f59e0b',
						error: '#ef4444',
						info: '#3b82f6',
					},
					gradients: {
						primary: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
						secondary: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
						background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
						button: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
						card: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
						accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
						glow: 'radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)',
					},
					effects: {
						blur: 20,
						shadowIntensity: 0.6,
						glowIntensity: 0.4,
						borderOpacity: 0.2,
						surfaceOpacity: 0.9,
						shadows: true,
						glow: true,
						glassmorphism: true,
						particles: false,
					},
					typography: {
						fontFamily: 'Inter, system-ui, sans-serif',
						fontSize: 16,
						fontWeight: 400,
						lineHeight: 1.6,
						headingWeight: 700,
					},
					spacing: {
						scale: 1,
						cardPadding: 24,
						buttonPadding: 12,
						sectionGap: 32,
						elementGap: 16,
					},
					borders: {
						radius: 12,
						width: 1,
						style: 'solid',
						cardRadius: 16,
						buttonRadius: 8,
						inputRadius: 8,
					},
					animation: {
						duration: 200,
						easing: 'ease-out',
						hoverScale: 1.02,
						activeScale: 0.98,
					},
				};

				setThemeState(defaultTheme);
				applyThemeToDOM(defaultTheme);
				log.info(LOG_COMPONENT, 'Theme applied: Visual Richness (preset)');
			}

			setError(null);
		} catch (err) {
			log.error(
				LOG_COMPONENT,
				'Failed to load theme from cache',
				err instanceof Error ? err : undefined,
				err
			);
			setError('Failed to load theme');
		} finally {
			setLoading(false);
		}
	}, [applyThemeToDOM]);

	/**
	 * Set theme manually
	 */
	const setTheme = useCallback(
		(newTheme: Theme) => {
			setThemeState(newTheme);
			applyThemeToDOM(newTheme);
		},
		[applyThemeToDOM]
	);

	/**
	 * Refresh theme from API
	 */
	const refreshTheme = useCallback(async () => {
		setLoading(true);
		await loadActiveTheme();
	}, [loadActiveTheme]);

	/**
	 * Apply a preset theme. No-op: presets are not used; theme mode (dark/light/auto) comes from profile/desktop config (DB).
	 */
	const applyPreset = useCallback(async (_presetId: string) => {
		// No-op: single source of truth for UI theme is DB (profile preferences / desktop config)
	}, []);

	/**
	 * Initialize theme on mount
	 */
	useEffect(() => {
		const initializeTheme = async () => {
			// Try to load from localStorage first (instant)
			try {
				const cached = localStorage.getItem('active_theme');
				if (cached) {
					const cachedTheme = JSON.parse(cached) as Theme;
					setThemeState(cachedTheme);
					applyThemeToDOM(cachedTheme);
					log.info(LOG_COMPONENT, 'Theme loaded from cache (instant)');
				}
			} catch (err) {
				log.warn(LOG_COMPONENT, 'Failed to load theme from localStorage', err);
			}

			// Then load from API (authoritative)
			await loadActiveTheme();
		};

		initializeTheme();
	}, [loadActiveTheme, applyThemeToDOM]);

	const value: ThemeContextValue = {
		theme,
		loading,
		error,
		setTheme,
		refreshTheme,
		applyPreset,
		applyThemeToDOM,
	};

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export default ThemeContext;
