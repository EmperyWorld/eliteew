/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator diagnostics card for Site Studio: ops overview and publish smoke; collapsed by default.
 *
 * Invariants:
 * - Publish smoke uses the same live path as Site Manager (`run_live: true`).
 * - Smoke results use user-facing i18n summary; check details are secondary.
 *
 * Related:
 * - `SiteStudioRuntimePanel.tsx`
 * - `../api.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	getSiteManagerOpsOverview,
	runSiteManagerPublishSmoke,
	type SiteManagerOpsOverview,
	type SiteManagerOpsSmokeResult,
	type SiteStudioInstance,
} from '../api';
import {
	formatSmokeCheckName,
	formatTranslatedValue,
} from './siteStudioRuntimeShared';

export interface SiteStudioOperatorDiagnosticsCardProps {
	instance: SiteStudioInstance;
}

export const SiteStudioOperatorDiagnosticsCard: React.FC<
	SiteStudioOperatorDiagnosticsCardProps
> = ({ instance }) => {
	const { t } = useTranslation('siteStudio');
	const [opsOverview, setOpsOverview] =
		React.useState<SiteManagerOpsOverview | null>(null);
	const [opsSmoke, setOpsSmoke] =
		React.useState<SiteManagerOpsSmokeResult | null>(null);
	const [opsBusy, setOpsBusy] = React.useState<string | null>(null);
	const [opsError, setOpsError] = React.useState<string | null>(null);
	const smokeHasFailures =
		opsSmoke?.status === 'failed' || (opsSmoke?.hard_failure_count ?? 0) > 0;
	const refreshOpsOverview = React.useCallback(async () => {
		try {
			setOpsBusy('overview');
			setOpsError(null);
			setOpsOverview(await getSiteManagerOpsOverview());
		} catch (error) {
			setOpsError(error instanceof Error ? error.message : String(error));
		} finally {
			setOpsBusy(null);
		}
	}, []);
	const runPublishSmoke = React.useCallback(async () => {
		try {
			setOpsBusy('smoke');
			setOpsError(null);
			setOpsSmoke(
				await runSiteManagerPublishSmoke({
					instance_scope: instance.marketing_project_id ? 'project' : 'user',
					instance_id: instance.id,
					run_live: true,
				})
			);
		} catch (error) {
			setOpsError(error instanceof Error ? error.message : String(error));
		} finally {
			setOpsBusy(null);
		}
	}, [instance.id, instance.marketing_project_id]);

	return (
		<details className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40">
			<summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-(--desktop-text-secondary)">
				{t('runtime.opsTitle')}
			</summary>
			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className="space-y-3 border-0 bg-transparent"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-xs leading-5 text-(--desktop-text-secondary)">
						{t('runtime.opsDescription')}
					</p>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							disabled={opsBusy === 'overview'}
							onClick={() => void refreshOpsOverview()}
						>
							{t('runtime.opsRefresh')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							disabled={opsBusy === 'smoke'}
							onClick={() => void runPublishSmoke()}
						>
							{t('runtime.opsSmoke')}
						</DesktopAppButton>
					</div>
				</div>
				{opsError ? (
					<div className="rounded-md border border-amber-500/20 bg-amber-500/8 p-2 text-xs text-amber-100">
						{t('runtime.lastError', { message: opsError })}
					</div>
				) : null}
				<div className="grid gap-2 text-xs text-(--desktop-text-secondary) md:grid-cols-4">
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.opsWorker')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{opsOverview?.worker?.worker_ready
								? t('runtime.lifecycleWorkerReady')
								: t('runtime.lifecycleWorkerOffline')}
						</div>
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.opsJobs')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{opsOverview?.jobs?.length ?? '—'}
						</div>
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.opsDomains')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{opsOverview?.domains?.length ?? '—'}
						</div>
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.opsReconcile')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{opsOverview?.reconcile?.count ?? '—'}
						</div>
					</div>
				</div>
				{opsSmoke ? (
					<div
						className={`rounded-md border p-3 text-xs ${
							smokeHasFailures
								? 'border-amber-500/25 bg-amber-500/8 text-amber-50'
								: 'border-emerald-400/25 bg-emerald-400/8 text-emerald-50'
						}`}
						role="status"
						aria-live="polite"
					>
						<div className="font-medium text-(--desktop-text-primary)">
							{t('runtime.opsSmokeResult', {
								status: formatTranslatedValue(
									t,
									'runtime.smokeStatus',
									opsSmoke.status
								),
								failures: opsSmoke.hard_failure_count,
							})}
						</div>
						<p className="mt-1 leading-5">
							{smokeHasFailures
								? t('runtime.opsSmokeResultAttention')
								: t('runtime.opsSmokeResultReady')}
						</p>
						<ul className="mt-2 space-y-1">
							{opsSmoke.checks.slice(0, 5).map((check) => (
								<li key={check.key}>
									{check.ok
										? t('runtime.smokeCheckOk')
										: t('runtime.smokeCheckFail')}{' '}
									· {formatSmokeCheckName(t, check.key)}: {check.message}
								</li>
							))}
						</ul>
					</div>
				) : null}
			</DesktopAppSurface>
		</details>
	);
};

export default SiteStudioOperatorDiagnosticsCard;
