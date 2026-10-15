/**
 * Barrel export for all TypeScript types
 *
 * Central export point for type definitions across the application.
 *
 * @module types
 */

// File Exchange System Types (primary source for ContentType, PaginatedResponse, formatFileSize)
export * from './fileExchange';

// Content Tags Types
export * from './contentTags';

// Context Types
// Note: CacheConfig from context.ts conflicts with fileExchange.ts
// CacheStats also conflicts - using fileExchange.ts as primary source
// Import context-specific cache types directly from './context' if needed
export type {
	ContextData,
	ContextDataPartial,
	ContextDataCreate,
	ContextValidationResult,
	TemplateVariable,
	TemplateRenderOptions,
	TemplateRenderResult,
	BuildContextRequest,
	BuildContextResponse,
	ContextSummaryRequest,
	ContextSummaryResponse,
	CacheInvalidateRequest,
	CacheInvalidateResponse,
	QueryMetrics,
	PipelineHealthMetrics,
	ContextMetricsDashboard,
} from './context';

// Marketing cabinet DTOs: use `pages/MarketingCabinet/marketingCabinetApi` (and related modules).
// A former `./marketing` barrel was removed; nothing in the repo imported those symbols from here.

// Profile Types
// Note: Theme type from profile.ts conflicts with theme.ts
// Use Theme from theme.ts, and formatFileSize from fileExchange.ts
export type {
	UserProfileResponse,
	ProfileUpdateData,
	AvatarUploadResponse,
	AvatarHistoryItem,
	Language,
	ProfileVisibility,
	EmailFrequency,
	NotificationPreferences,
	PrivacyPreferences,
	UIPreferences,
	AccessibilityPreferences,
	UserPreferences,
	UserPreferencesUpdate,
	SecuritySettings,
	PasswordChangeData,
	UserSessionInfo,
	UserStatistics,
	ActivityLogEntry,
	ActivityLogResponse,
	DataExportRequest,
	DataExportResponse,
} from './profile';

// Theme Types (Theme interface from theme.ts is the primary source)
export type {
	ThemeColors,
	ThemeGradients,
	ThemeEffects,
	ThemeTypography,
	ThemeSpacing,
	ThemeBorders,
	ThemeAnimation,
	ThemeMetadata,
	Theme,
	UserTheme,
	MyThemesResponse,
	ActiveThemeResponse,
	ThemeResponse,
	ThemeStatsResponse,
	ThemeType,
	ThemeCategory,
} from './theme';

// Navigation Types
export type {
	NavigationHandler,
	RouteHandler,
	NavigationProps,
} from './navigation';
