/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight Suspense fallback for desktop overlay modals (wallpaper, palette, …).
 * P18: escalates copy after stall threshold (honest delay).
 *
 * Invariants:
 * - Backdrop + panel skeleton with ``role="status"``.
 * - After stall: ``workspace.loadingStalled`` + ``data-stalled=true``.
 *
 * Related:
 * - DesktopModalsLayer.tsx
 * - constants DESKTOP_OVERLAY
 * - ../utils/desktopAppLoadStall.ts
 */

import { useTranslation } from 'react-i18next';
import { DESKTOP_OVERLAY, DESKTOP_Z_INDEX } from '../constants';
import { useDesktopAppLoadStall } from '../utils/desktopAppLoadStall';
import { getDesktopShellPanelClassName } from '../utils/desktopVisualSystem';
import { DesktopAppSkeleton } from './DesktopAppChrome';

export function DesktopModalSuspenseFallback(): React.JSX.Element {
	const { t } = useTranslation('desktopUi');
	const stalled = useDesktopAppLoadStall(true);
	const loadingLabel = t('workspace.modalLoadingAria', {
		defaultValue: t('workspace.loading'),
	});
	const label = stalled ? t('workspace.loadingStalled') : loadingLabel;

	return (
		<div
			className={`fixed inset-0 z-(--desktop-modal-suspense-z) flex items-center justify-center ${DESKTOP_OVERLAY.backdrop}`}
			style={
				{
					'--desktop-modal-suspense-z': DESKTOP_Z_INDEX.MODAL,
				} as React.CSSProperties
			}
			role="status"
			aria-busy={!stalled}
			aria-label={label}
			data-testid="desktop-modal-suspense-fallback"
			data-stalled={stalled ? 'true' : 'false'}
		>
			<div
				className={`${getDesktopShellPanelClassName('glass')} flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3 p-5`}
			>
				{stalled ? (
					<p className="text-sm text-(--desktop-text-secondary)">{label}</p>
				) : null}
				<DesktopAppSkeleton className="h-8 w-2/3" />
				<DesktopAppSkeleton className="h-4 w-full" />
				<DesktopAppSkeleton className="h-4 w-5/6" />
				<DesktopAppSkeleton className="mt-2 h-32 w-full" />
			</div>
		</div>
	);
}
