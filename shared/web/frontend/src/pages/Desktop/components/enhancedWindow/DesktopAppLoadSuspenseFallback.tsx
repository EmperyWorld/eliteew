/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Suspense fallback for in-window app chunks: initial loading chrome, then
 * P18 stall escalation with Try again / Close window (no silent forever spin).
 *
 * Invariants:
 * - Escalates after DESKTOP_APP_LOAD_STALL_MS (or injected stallMs in tests).
 * - Retry remounts via parent `onRetry` (contentKey); Close uses `onClose`.
 * - Never exposes raw `appComponent` ids — uses window chrome copy helpers.
 *
 * Related:
 * - EnhancedWindowAppContent.tsx
 * - ../../utils/desktopAppLoadStall.ts
 * - ../../utils/desktopWindowChromeCopy.ts
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { DesktopWindowStyle } from '../../../../types/profile';
import { DESKTOP_LUCIDE } from '../../constants';
import type { WindowState } from '../../types/desktop.types';
import { useDesktopAppLoadStall } from '../../utils/desktopAppLoadStall';
import {
	buildDesktopWindowLoadingMessage,
	buildDesktopWindowStillOpeningHint,
	buildDesktopWindowStillOpeningMessage,
} from '../../utils/desktopWindowChromeCopy';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
} from '../DesktopAppChrome';

export type DesktopAppLoadSuspenseFallbackProps = {
	win: WindowState;
	visualStyle: DesktopWindowStyle;
	onRetry: () => void;
	onClose: () => void;
	/** Override for Vitest; production uses DESKTOP_APP_LOAD_STALL_MS. */
	stallMs?: number;
};

export function DesktopAppLoadSuspenseFallback({
	win,
	visualStyle,
	onRetry,
	onClose,
	stallMs,
}: DesktopAppLoadSuspenseFallbackProps): React.JSX.Element {
	const { t } = useTranslation('desktopUi');
	const stalled = useDesktopAppLoadStall(true, stallMs);

	return (
		<DesktopAppContentWrapper
			appComponent={win.appComponent}
			windowStyle={visualStyle}
		>
			<div
				role="status"
				aria-live="polite"
				aria-busy={!stalled}
				data-testid="desktop-app-load-fallback"
				data-stalled={stalled ? 'true' : 'false'}
				className="flex h-full min-w-0 flex-col items-center justify-center gap-3 border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/20 p-8 text-(--desktop-text-muted)"
			>
				{!stalled ? (
					<>
						<div className="animate-spin motion-reduce:animate-none">
							<ArrowPathIcon
								className="h-10 w-10 text-[rgb(var(--desktop-accent-rgb))]"
								aria-hidden="true"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</div>
						<p className="text-sm font-medium text-(--desktop-text-primary)">
							{buildDesktopWindowLoadingMessage(t, win)}
						</p>
					</>
				) : (
					<>
						<p className="text-sm font-medium text-(--desktop-text-primary)">
							{buildDesktopWindowStillOpeningMessage(t, win)}
						</p>
						<p className="max-w-sm text-center text-xs text-(--desktop-text-secondary)">
							{buildDesktopWindowStillOpeningHint(t)}
						</p>
						<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={onRetry}
								data-testid="desktop-app-load-stall-retry"
							>
								<ArrowPathIcon
									className="h-4 w-4"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								{t('windowChrome.retry')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={onClose}
								data-testid="desktop-app-load-stall-close"
							>
								{t('windowChrome.closeWindow')}
							</DesktopAppButton>
						</div>
					</>
				)}
			</div>
		</DesktopAppContentWrapper>
	);
}
