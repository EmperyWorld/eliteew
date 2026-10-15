/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy app content host inside EnhancedWindow: Suspense, error boundary,
 * pause/empty states, and DesktopAppContentWrapper.
 *
 * Invariants:
 * - Keep app loading outside the memoized/animated window shell so restored
 *   windows can retry Suspense without waiting for unrelated window updates.
 * - Suspense fallback escalates after stall threshold (P18) with retry/close.
 * - After Suspense settles, one-shot layout wake (local rect + deferred resize)
 *   so nested apps leave forever-preloader without requiring manual resize.
 *
 * Related:
 * - EnhancedWindow.tsx
 * - DesktopAppLoadSuspenseFallback.tsx
 * - desktopWindowAppContent.ts
 * - ../../utils/desktopAppWindowBodyLayoutSync.ts
 */

import { RetryBlock } from '@/components/ui/RetryBlock';
import i18n from '@/i18n/config';
import { Cog6ToothIcon, PauseCircleIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { Suspense, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopWindowStyle } from '../../../../types/profile';
import { log } from '../../../../utils/logger';
import { isLikelyStaleChunkImportError } from '../../../../utils/staleBundleReload';
import { useDesktopBackgroundAdapter } from '../../runtime/useDesktopBackgroundAdapter';
import type { WindowState } from '../../types/desktop.types';
import { scheduleAppWindowContentSettledLayoutWake } from '../../utils/desktopAppWindowBodyLayoutSync';
import { buildDesktopWindowErrorMessage } from '../../utils/desktopWindowChromeCopy';
import { resolveDesktopWindowAppComponent } from '../../utils/desktopWindowResolveApp';
import { showDesktopChunkUpdateNoticeThenReload } from '../../utils/showDesktopChunkUpdateNotice';
import {
	DesktopAppContentWrapper,
	DesktopAppEmptyState,
} from '../DesktopAppChrome';
import { getDesktopWindowAppContent } from '../desktopWindowAppContent';
import { DesktopAppLoadSuspenseFallback } from './DesktopAppLoadSuspenseFallback';

/**
 * Mounts only after Suspense resolves — wakes nested apps that wait for resize/reflow
 * without firing on every restored window at desktop boot.
 */
function AppWindowSuspenseSettledWake({
	windowId,
	flushKey,
}: {
	windowId: string;
	flushKey: string;
}): null {
	useLayoutEffect(() => {
		const el = document.querySelector(
			`[data-desktop-window-body="${CSS.escape(windowId)}"]`
		) as HTMLElement | null;
		scheduleAppWindowContentSettledLayoutWake(flushKey, el);
	}, [flushKey, windowId]);
	return null;
}

// Error boundary so failed lazy loads show message instead of blank
class AppErrorBoundary extends React.Component<
	{
		children: React.ReactNode;
		fallback: (errorMessage: string | null) => React.ReactNode;
		appComponent?: string | null;
	},
	{ hasError: boolean; errorMessage: string | null }
> {
	state = { hasError: false, errorMessage: null };
	static getDerivedStateFromError(error: Error) {
		return {
			hasError: true,
			errorMessage:
				error?.message ??
				i18n.t('windowChrome.unknownAppError', { ns: 'desktopUi' }),
		};
	}
	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const appComponent = this.props.appComponent ?? 'unknown';
		const message =
			error?.message ??
			i18n.t('windowChrome.unknownAppError', { ns: 'desktopUi' });
		log.error('DesktopAppErrorBoundary', `[${appComponent}] ${message}`, error);
		console.error(
			`[DesktopAppErrorBoundary:${appComponent}]`,
			error,
			errorInfo
		);
		// React.lazy: failed import() does not always reach window "unhandledrejection"
		if (isLikelyStaleChunkImportError(message)) {
			showDesktopChunkUpdateNoticeThenReload('chunk_load_failure');
			return;
		}
		this.setState({ errorMessage: message });
	}
	render() {
		if (this.state.hasError) {
			return this.props.fallback(this.state.errorMessage);
		}
		return this.props.children;
	}
}

export interface EnhancedWindowAppContentProps {
	win: WindowState;
	visualStyle: DesktopWindowStyle;
	appProps:
		| import('../../context/DesktopAppPropsContext').DesktopAppPropsContextValue
		| null;
	contentKey: number;
	onRetry: () => void;
	onClose: () => void;
	onMaximize: () => void;
	onUpdatePayload?: (
		payload: import('../../types/desktop.types').WindowInitialPayload
	) => void;
}

// Keep app loading outside the memoized/animated window shell.
// Restored windows must be able to retry Suspense as soon as lazy imports resolve,
// without waiting for an unrelated window state update (move/resize/focus).
export const EnhancedWindowAppContent: React.FC<
	EnhancedWindowAppContentProps
> = ({
	win,
	visualStyle,
	appProps,
	contentKey,
	onRetry,
	onClose,
	onMaximize,
	onUpdatePayload,
}) => {
	const { t } = useTranslation('desktopUi');
	const resolvedAppComponent = resolveDesktopWindowAppComponent(
		win.appComponent,
		win
	);
	const runtimeAdapter = useDesktopBackgroundAdapter(
		resolvedAppComponent ?? win.appComponent ?? 'unknown'
	);

	useEffect(() => {
		runtimeAdapter.setPausedEffectsCount(
			runtimeAdapter.shouldPauseEffects ? 1 : 0
		);
	}, [runtimeAdapter]);

	const AppContent = getDesktopWindowAppContent(
		resolvedAppComponent ?? undefined,
		appProps,
		win,
		{
			onClose,
			onMaximize,
			onUpdatePayload,
			visualStyle,
		}
	);

	if (win.type === 'app' && AppContent == null) {
		console.warn(
			'[Desktop:Debug] App window: no component',
			JSON.stringify({
				windowId: win.id,
				title: win.title,
				appComponent: win.appComponent ?? '(empty)',
			})
		);
	}

	if (AppContent == null) {
		return (
			<div className="h-full">
				<DesktopAppContentWrapper
					appComponent={win.appComponent}
					windowStyle={visualStyle}
				>
					<DesktopAppEmptyState
						className="h-full"
						icon={
							<Cog6ToothIcon className="w-12 h-12 text-(--desktop-text-dim)" />
						}
						title={t('windowChrome.appNotFound')}
					/>
				</DesktopAppContentWrapper>
			</div>
		);
	}

	if (win.type === 'app' && runtimeAdapter.shouldSuspendAppRuntime) {
		return (
			<div className="h-full">
				<DesktopAppContentWrapper
					appComponent={resolvedAppComponent ?? win.appComponent}
					windowStyle={visualStyle}
				>
					<DesktopAppEmptyState
						className="h-full"
						icon={
							<PauseCircleIcon className="w-12 h-12 text-(--desktop-text-dim)" />
						}
						title={t('windowChrome.paused.title')}
						description={t('windowChrome.paused.description')}
					/>
				</DesktopAppContentWrapper>
			</div>
		);
	}

	const errorFallback = (_errorMessage: string | null) => (
		<DesktopAppContentWrapper
			appComponent={win.appComponent}
			windowStyle={visualStyle}
		>
			<div className="h-full min-h-50 flex items-center justify-center p-6">
				<RetryBlock
					message={buildDesktopWindowErrorMessage(t, win)}
					onRetry={onRetry}
					retryLabel={t('windowChrome.retry')}
				/>
			</div>
		</DesktopAppContentWrapper>
	);

	return (
		<div className="h-full">
			<AppErrorBoundary
				key={contentKey}
				fallback={errorFallback}
				appComponent={win.appComponent}
			>
				<Suspense
					fallback={
						<DesktopAppLoadSuspenseFallback
							win={win}
							visualStyle={visualStyle}
							onRetry={onRetry}
							onClose={onClose}
						/>
					}
				>
					{win.type === 'app' ? (
						<AppWindowSuspenseSettledWake
							windowId={win.id}
							flushKey={`${win.id}:${contentKey}`}
						/>
					) : null}
					<DesktopAppContentWrapper
						appComponent={win.appComponent}
						windowStyle={visualStyle}
					>
						{React.isValidElement(AppContent)
							? AppContent
							: React.createElement(AppContent as React.ComponentType)}
					</DesktopAppContentWrapper>
				</Suspense>
			</AppErrorBoundary>
		</div>
	);
};

/** Alias kept for call sites that used the former local name. */
export const AppWindowContent = EnhancedWindowAppContent;
