/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky top bar above admin section content (breadcrumb or full title block).
 *
 * Invariants:
 * - `headerMode=none` renders only mobile menu control when `isMobile`.
 * - Section labels respect i18n keys from `adminShellConfig`.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import type { AdminSectionId } from './adminShellConfig';
import { getAdminShellSectionMeta } from './adminShellConfig';
import {
	resolveAdminSectionDescription,
	resolveAdminSectionLabel,
} from './adminShellLabels';

interface AdminShellContentHeaderProps {
	section: AdminSectionId;
	isMobile: boolean;
	onOpenMobileNav: () => void;
}

export function AdminShellContentHeader({
	section,
	isMobile,
	onOpenMobileNav,
}: AdminShellContentHeaderProps): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	const meta = getAdminShellSectionMeta(section);
	const label = resolveAdminSectionLabel(section, t);
	const description = resolveAdminSectionDescription(section, t);

	if (meta.headerMode === 'none' && !isMobile) {
		return null;
	}

	if (meta.headerMode === 'none' && isMobile) {
		return (
			<header className="eliteew-admin-shell__topbar sticky top-0 z-20 flex items-center gap-3 px-3 py-2.5">
				<button
					type="button"
					onClick={onOpenMobileNav}
					className={cn(
						'p-2 text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-white/10 bg-slate-800/80'
					)}
					aria-label={t('adminShell.openMenu')}
				>
					<Bars3Icon className="h-5 w-5" />
				</button>
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('adminShell.mobileBreadcrumb', { section: label })}
				</span>
			</header>
		);
	}

	return (
		<header className="eliteew-admin-shell__topbar sticky top-0 z-20 px-4 py-3 sm:px-6">
			<div className="flex flex-wrap items-start gap-3">
				{isMobile ? (
					<button
						type="button"
						onClick={onOpenMobileNav}
						className={cn(
							'p-2 text-white',
							DESKTOP_SURFACE.radius,
							DESKTOP_INTERACTIVE.btnRounded,
							'border border-white/10 bg-slate-800/80'
						)}
						aria-label={t('adminShell.openMenu')}
					>
						<Bars3Icon className="h-5 w-5" />
					</button>
				) : null}
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-violet-300/90">
						{t('adminShell.panelTitle')}
						{meta.headerMode === 'breadcrumb' ? (
							<>
								<span className="text-white/25"> / </span>
								<span className="text-slate-400">{label}</span>
							</>
						) : null}
					</p>
					{meta.headerMode === 'full' ? (
						<>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<h1
									id={meta.headerTitleId}
									className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'text-white/95')}
								>
									{label}
								</h1>
								{meta.badge ? (
									<span className="rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
										{meta.badge}
									</span>
								) : null}
							</div>
							<p className="mt-1 max-w-3xl text-sm text-slate-400">
								{description}
							</p>
						</>
					) : (
						<p className="mt-0.5 text-sm text-slate-500">{description}</p>
					)}
				</div>
			</div>
		</header>
	);
}
