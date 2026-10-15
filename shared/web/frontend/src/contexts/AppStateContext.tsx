import {
	createContext,
	useContext,
	useMemo,
	useReducer,
	type Dispatch,
	type ReactNode,
} from 'react';
import type { AppAction } from '../appState/types';
import type { User } from '../services';
import { appReducer } from '../appState/reducer';
import { initialAppState } from '../appState/initialState';
import type {
	AppState,
	AppSettings,
	AppTheme,
	NotificationItem,
	PageType,
} from '../appState/types';

type AppStateActions = {
	setCurrentPage: (page: PageType) => void;
	setUser: (user: User | null) => void;
	setLoading: (loading: boolean) => void;
	setAuthenticated: (authenticated: boolean) => void;
	setError: (error: string | null) => void;
	updateSettings: (settings: Partial<AppSettings>) => void;
	updateTheme: (theme: Partial<AppTheme>) => void;
	addNotification: (
		notification: Omit<NotificationItem, 'id' | 'timestamp'>
	) => void;
	removeNotification: (id: string) => void;
	markNotificationRead: (id: string) => void;
	updatePerformance: (perf: Partial<AppState['performance']>) => void;
	updateWebSocket: (ws: Partial<AppState['websocket']>) => void;
	toggleSidebar: () => void;
	setSidebarCompact: (compact: boolean) => void;
	toggleModal: (modal: keyof AppState['modals']) => void;
	setErrorBoundary: (error: Partial<AppState['errorBoundary']>) => void;
	resetState: () => void;
};

type AppStateContextValue = {
	state: AppState;
	dispatch: Dispatch<AppAction>;
	actions: AppStateActions;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
	children,
}: {
	children: ReactNode;
}): React.ReactElement {
	const [state, dispatch] = useReducer(appReducer, initialAppState);

	const actions = useMemo(
		() => ({
			setCurrentPage: (page: PageType) =>
				dispatch({ type: 'SET_CURRENT_PAGE', payload: page }),
			setUser: (user: User | null) =>
				dispatch({ type: 'SET_USER', payload: user }),
			setLoading: (loading: boolean) =>
				dispatch({ type: 'SET_LOADING', payload: loading }),
			setAuthenticated: (authenticated: boolean) =>
				dispatch({ type: 'SET_AUTHENTICATED', payload: authenticated }),
			setError: (error: string | null) =>
				dispatch({ type: 'SET_ERROR', payload: error }),
			updateSettings: (settings: Partial<AppSettings>) =>
				dispatch({ type: 'UPDATE_SETTINGS', payload: settings }),
			updateTheme: (theme: Partial<AppTheme>) =>
				dispatch({ type: 'UPDATE_THEME', payload: theme }),
			addNotification: (
				notification: Omit<NotificationItem, 'id' | 'timestamp'>
			) =>
				dispatch({
					type: 'ADD_NOTIFICATION',
					payload: {
						...notification,
						id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
						timestamp: new Date(),
					},
				}),
			removeNotification: (id: string) =>
				dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }),
			markNotificationRead: (id: string) =>
				dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
			updatePerformance: (perf: Partial<AppState['performance']>) =>
				dispatch({ type: 'UPDATE_PERFORMANCE', payload: perf }),
			updateWebSocket: (ws: Partial<AppState['websocket']>) =>
				dispatch({ type: 'UPDATE_WEBSOCKET', payload: ws }),
			toggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
			setSidebarCompact: (compact: boolean) =>
				dispatch({ type: 'SET_SIDEBAR_COMPACT', payload: compact }),
			toggleModal: (modal: keyof AppState['modals']) =>
				dispatch({ type: 'TOGGLE_MODAL', payload: modal }),
			setErrorBoundary: (error: Partial<AppState['errorBoundary']>) =>
				dispatch({ type: 'SET_ERROR_BOUNDARY', payload: error }),
			resetState: () => dispatch({ type: 'RESET_STATE' }),
		}),
		[]
	);

	const value = useMemo(() => ({ state, dispatch, actions }), [state, actions]);

	return (
		<AppStateContext.Provider value={value}>
			{children}
		</AppStateContext.Provider>
	);
}

export function useAppState(): AppStateContextValue {
	const ctx = useContext(AppStateContext);
	if (!ctx) {
		throw new Error('useAppState must be used within AppStateProvider');
	}
	return ctx;
}
