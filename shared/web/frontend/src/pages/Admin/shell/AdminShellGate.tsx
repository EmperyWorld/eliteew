/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen loading and access-denied states for unified admin before shell mounts.
 *
 * Invariants:
 * - Same visual language as admin shell (card on gradient backdrop).
 *
 * Related:
 * - `pages/Admin/UnifiedAdminPage.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { BackToDesktopButton } from '@/components/ui/BackToDesktopButton';
import type { NavigationHandler } from '@/types/navigation';
import { syncLocationHashToPage } from '@/utils/pageRouting';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';

export type AdminShellGateVariant = 'loading' | 'denied';

interface AdminShellGateProps {
	variant: AdminShellGateVariant;
	embedded?: boolean;
	onNavigate?: NavigationHandler;
	onRequestClose?: () => void;
}

export function AdminShellGate({
	variant,
	embedded = false,
	onNavigate,
	onRequestClose,
}: AdminShellGateProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const shellClass = embedded
		? 'eliteew-admin-shell h-full min-h-0 flex items-center justify-center overflow-hidden eliteew-admin-shell__root'
		: 'eliteew-admin-shell min-h-screen flex items-center justify-center eliteew-admin-shell__root';

	const Icon = variant === 'loading' ? Squares2X2Icon : ShieldCheckIcon;
	const iconClass =
		variant === 'loading'
			? 'w-16 h-16 text-violet-400/80 mx-auto mb-4 eliteew-admin-shell__loading-pulse'
			: 'w-16 h-16 text-amber-500/60 mx-auto mb-4';

	return (
		<div className={shellClass}>
			<div
				className={`text-center max-w-md mx-4 ${DESKTOP_SURFACE.radiusLg} ${DESKTOP_SURFACE.border} ${DESKTOP_OVERLAY.panelSurface} p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]`}
				role={variant === 'loading' ? 'status' : 'alert'}
				aria-busy={variant === 'loading'}
			>
				<Icon className={iconClass} aria-hidden />
				<h1 className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-2`}>
					{variant === 'loading'
						? t('adminShellGate.loadingTitle')
						: t('adminShellGate.deniedTitle')}
				</h1>
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{variant === 'loading'
						? t('adminShellGate.loadingBody')
						: t('adminShellGate.deniedBody')}
				</p>
				{variant === 'denied' ? (
					<div className="mt-6">
						{onRequestClose ? (
							<button
								type="button"
								onClick={onRequestClose}
								className={`inline-flex items-center gap-2 px-4 py-2 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10`}
							>
								<Squares2X2Icon className="w-4 h-4" aria-hidden />
								{t('adminShellGate.backToDesktop')}
							</button>
						) : onNavigate ? (
							<BackToDesktopButton onNavigate={onNavigate} />
						) : (
							<button
								type="button"
								onClick={() => syncLocationHashToPage('desktop')}
								className={`inline-flex items-center gap-2 mt-0 px-4 py-2 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10`}
							>
								{t('adminShellGate.backToDesktop')}
							</button>
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}
