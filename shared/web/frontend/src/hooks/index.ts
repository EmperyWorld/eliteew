// Custom hooks export
export { useAppState } from './useAppState';
// ✅ FIXED: useAuth now comes from AuthContext (single source of truth)
export { useAuth } from '../contexts/AuthContext';
export {
	useAdvancedKeyboardShortcuts,
	useConditionalKeyboardShortcuts,
	useKeyboardShortcuts,
} from './useKeyboardShortcuts';
export { useLocalStorage } from './useLocalStorage';
export {
	getMemoryUsage,
	markPerformance,
	measureAsyncExecutionTime,
	measureExecutionTime,
	measurePerformance,
	usePerformance,
} from './usePerformance';
export { useSocketConnection } from './useSocketConnection';

// 🎯 Responsive hooks
export {
	useIsTouchDevice,
	useMediaQuery,
	useOrientation,
	usePrefersDarkMode,
	usePrefersReducedMotion,
} from './useMediaQuery';
export {
	BREAKPOINTS,
	useBreakpoint,
	useResponsive,
	useViewportHeight,
	useViewportWidth,
} from './useResponsive';

// 🎤 Audio processing hooks
export { useWhisperTranscription } from './useWhisperTranscription';

// Re-export types
export type {
	AppSettings,
	AppState,
	AppTheme,
	NavigationHistory,
	NotificationItem,
	PageType,
	ShellPageType,
} from './useAppState';
// AuthState type removed - now in AuthContext
export type { KeyboardHandler, KeyboardShortcut } from './useKeyboardShortcuts';
export type { PerformanceData, PerformanceMetrics } from './usePerformance';
export type { Breakpoint, ResponsiveState } from './useResponsive';
export type { SocketMessage, SocketState } from './useSocketConnection';
export type {
	TranscriptionResult,
	TranscriptionSegment,
	TranscriptionState,
	UseWhisperTranscriptionReturn,
} from './useWhisperTranscription';
