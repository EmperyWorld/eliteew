/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Non-blocking Suspense fallback for in-canvas desktop chunks (window layer,
 * voice pipelines) — announces loading without a full-screen modal hole.
 * P18: escalates copy after stall threshold (honest delay, no fake retry).
 *
 * Invariants:
 * - ``role="status"`` + ``aria-busy``; no ``fallback={null}`` on shell chunks.
 * - Does not steal pointer events from the desktop canvas.
 * - After stall: label switches to workspace.loadingStalled; data-stalled=true.
 *
 * Related:
 * - DesktopModalSuspenseFallback.tsx (overlay/modals)
 * - DesktopWorkspaceShellLayout.tsx
 * - ../utils/desktopAppLoadStall.ts
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY, DESKTOP_Z_INDEX } from '../constants';
import { useDesktopAppLoadStall } from '../utils/desktopAppLoadStall';

export type DesktopShellInlineSuspenseFallbackProps = {
	/** i18n key under desktopUi, or omit for workspace.loading */
	labelKey?: string;
	className?: string;
	testId?: string;
	/** Override for Vitest; production uses DESKTOP_APP_LOAD_STALL_MS. */
	stallMs?: number;
};

export function DesktopShellInlineSuspenseFallback({
	labelKey,
	className,
	testId = 'desktop-shell-inline-suspense-fallback',
	stallMs,
}: DesktopShellInlineSuspenseFallbackProps): React.JSX.Element {
	const { t } = useTranslation('desktopUi');
	const stalled = useDesktopAppLoadStall(true, stallMs);
	const baseLabel = labelKey
		? t(labelKey, { defaultValue: t('workspace.loading') })
		: t('workspace.loading');
	const label = stalled ? t('workspace.loadingStalled') : baseLabel;

	return (
		<div
			className={cn(
				'pointer-events-none absolute bottom-[calc(var(--desktop-taskbar-height)+0.75rem)] left-1/2 z-(--desktop-inline-suspense-z) -translate-x-1/2',
				'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/92 px-3 py-1.5 shadow-lg backdrop-blur-sm',
				DESKTOP_TYPOGRAPHY.caption,
				'text-(--desktop-text-secondary)',
				className
			)}
			style={
				{
					'--desktop-inline-suspense-z': DESKTOP_Z_INDEX.TOAST,
				} as React.CSSProperties
			}
			role="status"
			aria-busy={!stalled}
			aria-label={label}
			data-testid={testId}
			data-stalled={stalled ? 'true' : 'false'}
		>
			{label}
		</div>
	);
}
