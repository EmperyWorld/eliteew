import type { User } from '../services';

export type PageType =
	| 'dashboard'
	| 'elite-dashboard-v3'
	| 'creative-studio'
	| 'ai-hub'
	| 'ai-business'
	| 'business-intelligence'
	| 'agents'
	| 'simple-chat'
	| 'document-editor'
	| 'presentations'
	| 'presentations-archive'
	| 'ewrp'
	| 'audio-transcription'
	| 'unified-content'
	| 'configuration'
	| 'user-profile'
	| 'ugs'
	| 'ugs-hub'
	| 'ugs-admin'
	| 'ugs-analytics'
	| 'voice-studio'
	| 'voice-tester'
	| 'voice-center-settings'
	| 'voice-radio'
	| 'video-studio'
	| 'content-stats'
	| 'content-filters'
	| 'content-grid'
	| 'content-list'
	| 'live-voice'
	| 'desktop'
	| 'desktop/store'
	| 'desktop-admin'
	| 'admin'
	| 'login'
	| 'mobile-app-download'
	| 'mobile-ewa-companion'
	| 'mobile-handbook'
	| 'mobile-social-hub'
	| 'mobile-feedback-hub'
	| 'mobile-notifications'
	| 'mobile-content-manager'
	| 'mobile-ewdesk'
	| 'mobile-professional-worlds'
	| 'mobile-app-store'
	| 'mobile-desktop-settings'
	| 'empery-nexus';

/** Фактический полноэкранный маршрут после desktop-only coercion (см. navigateDesktopShell). */
export type ShellPageType = Extract<
	PageType,
	| 'desktop'
	| 'desktop/store'
	| 'login'
	| 'admin'
	| 'desktop-admin'
	| 'mobile-app-download'
	| 'mobile-ewa-companion'
	| 'mobile-handbook'
	| 'mobile-social-hub'
	| 'mobile-feedback-hub'
	| 'mobile-notifications'
	| 'mobile-content-manager'
	| 'mobile-ewdesk'
	| 'mobile-professional-worlds'
	| 'mobile-app-store'
	| 'mobile-desktop-settings'
	| 'empery-nexus'
>;

export interface AppTheme {
	primary: string;
	secondary: string;
	background: string;
	surface: string;
	text: string;
	accent: string;
	success: string;
	warning: string;
	error: string;
	info: string;
}

export interface AppSettings {
	theme: 'dark' | 'light' | 'auto';
	language: 'ru' | 'en' | 'auto';
	notifications: boolean;
	animations: boolean;
	autoSave: boolean;
	compactMode: boolean;
	developerMode: boolean;
	performanceMode: boolean;
}

export interface NavigationHistory {
	id: string;
	page: ShellPageType;
	timestamp: number;
	params?: Record<string, unknown>;
	title: string;
}

export interface NotificationItem {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message: string;
	timestamp: Date;
	read: boolean;
	persistent: boolean;
	actions?: Array<{
		label: string;
		action: () => void;
	}>;
}

export interface AppState {
	currentPage: ShellPageType;
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	settings: AppSettings;
	theme: AppTheme;
	navigationHistory: NavigationHistory[];
	notifications: NotificationItem[];
	error: string | null;
	errorBoundary: {
		hasError: boolean;
		errorInfo: Error | null;
		errorStack: string | null;
	};
	performance: {
		pageLoadTimes: Partial<Record<ShellPageType, number>>;
		renderCount: number;
		lastRenderTime: number;
		memoryUsage: number;
	};
	websocket: {
		connected: boolean;
		lastMessage: unknown;
		subscriptions: Set<string>;
	};
	sidebar: {
		isOpen: boolean;
		isCompact: boolean;
	};
	modals: {
		settings: boolean;
		profile: boolean;
		notifications: boolean;
		diagnostics: boolean;
	};
}

export type AppAction =
	| { type: 'SET_CURRENT_PAGE'; payload: PageType }
	| { type: 'SET_USER'; payload: User | null }
	| { type: 'SET_LOADING'; payload: boolean }
	| { type: 'SET_AUTHENTICATED'; payload: boolean }
	| { type: 'SET_ERROR'; payload: string | null }
	| { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
	| { type: 'UPDATE_THEME'; payload: Partial<AppTheme> }
	| { type: 'ADD_NAVIGATION_HISTORY'; payload: NavigationHistory }
	| { type: 'ADD_NOTIFICATION'; payload: NotificationItem }
	| { type: 'REMOVE_NOTIFICATION'; payload: string }
	| { type: 'MARK_NOTIFICATION_READ'; payload: string }
	| { type: 'SET_ERROR_BOUNDARY'; payload: Partial<AppState['errorBoundary']> }
	| { type: 'UPDATE_PERFORMANCE'; payload: Partial<AppState['performance']> }
	| { type: 'UPDATE_WEBSOCKET'; payload: Partial<AppState['websocket']> }
	| { type: 'TOGGLE_SIDEBAR' }
	| { type: 'SET_SIDEBAR_COMPACT'; payload: boolean }
	| { type: 'TOGGLE_MODAL'; payload: keyof AppState['modals'] }
	| { type: 'RESET_STATE' };
