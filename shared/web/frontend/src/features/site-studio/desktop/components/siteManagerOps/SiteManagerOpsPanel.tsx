/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Manager Ops panel implementation: chrome shell, view-mode tabs and mode panels.
 *
 * Invariants:
 * - All data comes from authenticated Site Manager Ops API endpoints via useSiteManagerOps.
 * - Mutating controls only call explicit operator endpoints; no repair/delete action is automatic.
 *
 * Related:
 * - ./useSiteManagerOps.ts
 * - ../SiteManagerOpsPanel.tsx (stable facade)
 * - documentation/product/SITE-STUDIO.md
 */
import * as React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ViewModeTabs } from '../SiteManagerOpsAtoms';
import { AdvancedModePanel } from './AdvancedModePanel';
import { AttentionModePanel } from './AttentionModePanel';
import { DomainsModePanel } from './DomainsModePanel';
import { formatDate } from './siteManagerOpsFormatters';
import { useSiteManagerOps } from './useSiteManagerOps';

export const SiteManagerOpsPanel: React.FC = () => {
	const ops = useSiteManagerOps();
	const { t, busy, error, lastSuccessAt, refresh, controls, updateControls } =
		ops;

	return (
		<DesktopAppPanel
			className="h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 isolate"
			data-testid="site-manager-ops-root"
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="text-xs uppercase tracking-[0.2em] text-(--desktop-text-dim)">
						{t('siteManager.headerKicker')}
					</div>
					<h1 className="mt-1 text-2xl font-semibold text-(--desktop-text-primary)">
						{t('siteManager.title')}
					</h1>
					<p className="mt-1 max-w-3xl text-sm leading-6 text-(--desktop-text-secondary)">
						{t('siteManager.headerDescription')}
					</p>
					{lastSuccessAt ? (
						<p
							className="mt-1 text-xs text-(--desktop-text-dim)"
							data-testid="site-manager-last-updated"
						>
							{t('siteManager.lastUpdated', {
								time: formatDate(lastSuccessAt.toISOString()),
							})}
						</p>
					) : null}
				</div>
				<DesktopAppButton
					type="button"
					variant="accent"
					disabled={busy === 'refresh'}
					onClick={() => void refresh()}
				>
					<ArrowPathIcon className="size-4" aria-hidden />
					{t('siteManager.refresh')}
				</DesktopAppButton>
			</header>

			{error ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					aria-live="assertive"
					title={t('siteManager.errorTitle')}
					description={error}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							disabled={busy === 'refresh'}
							onClick={() => void refresh()}
						>
							<ArrowPathIcon className="size-4" aria-hidden />
							{t('siteManager.refresh')}
						</DesktopAppButton>
					}
				/>
			) : null}

			<ViewModeTabs
				activeMode={controls.viewMode}
				ariaLabel={t('siteManager.viewMode.label')}
				labels={{
					attention: t('siteManager.viewMode.attention'),
					domains: t('siteManager.viewMode.domains'),
					advanced: t('siteManager.viewMode.advanced'),
				}}
				onChange={(viewMode) => updateControls({ viewMode })}
			/>

			{controls.viewMode === 'attention' ? (
				<AttentionModePanel ops={ops} />
			) : null}

			{controls.viewMode === 'domains' ? <DomainsModePanel ops={ops} /> : null}

			{controls.viewMode === 'advanced' ? (
				<AdvancedModePanel ops={ops} />
			) : null}
		</DesktopAppPanel>
	);
};

export default SiteManagerOpsPanel;
