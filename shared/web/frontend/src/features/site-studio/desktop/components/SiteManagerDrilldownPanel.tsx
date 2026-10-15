/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selected-site drilldown for Site Manager operator diagnostics and repair actions.
 * Owns drilldown-only clipboard state, issue digest navigation and section rendering.
 *
 * Invariants:
 * - Mutating controls are explicit confirmation actions passed in by the parent panel.
 * - Issue digest contents come from the shared Site Manager UX derivation helpers.
 *
 * Related:
 * - ./SiteManagerOpsPanel.tsx
 * - ./SiteManagerOpsAtoms.tsx
 * - ../siteManagerUserStatus.ts
 */
import * as React from 'react';
import type { TFunction } from 'i18next';

import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import type {
	SiteManagerOpsAuditEvent,
	SiteManagerOpsReconcileIssue,
	SiteManagerOpsSmokeCheck,
	SiteStudioLifecycleJob,
} from '../api';
import {
	buildSiteManagerIssueDigestSummary,
	buildSiteManagerSupportSummary,
	deriveSiteManagerIssueDigest,
	type SiteManagerSupportExportCopy,
	type SiteManagerUxDomainFlow,
	type SiteManagerUxDrilldownSectionId,
	type SiteManagerUxIssueDigestItem,
	type SiteManagerUxSeverity,
	type SiteManagerUxSiteCard,
	type SiteManagerUxSiteDrilldown,
} from '../siteManagerUserStatus';
import {
	ConfirmableActionButton,
	EmptyLine,
	SectionTitle,
} from './SiteManagerOpsAtoms';

function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatTranslatedValue(
	t: TFunction<'siteStudio'>,
	prefix: string,
	value: string | null | undefined
): string {
	if (!value) return '—';
	const translated = t(`${prefix}.${value}`, { defaultValue: value });
	return translated === value ? t('siteManager.unknownStatus') : translated;
}

function formatJobTitle(
	t: TFunction<'siteStudio'>,
	job: SiteStudioLifecycleJob
): string {
	return [
		formatTranslatedValue(t, 'siteManager.jobType', job.task_type),
		formatTranslatedValue(t, 'siteManager.jobStatus', job.status),
	].join(' · ');
}

function formatReconcileTitle(
	t: TFunction<'siteStudio'>,
	issue: SiteManagerOpsReconcileIssue
): string {
	return [
		formatTranslatedValue(t, 'siteManager.severity', issue.severity),
		t('siteManager.drilldown.reconcileSignal'),
	].join(' · ');
}

function toneClass(tone: SiteManagerUxSeverity): string {
	if (tone === 'ok')
		return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
	if (tone === 'danger') return 'border-red-400/25 bg-red-500/10 text-red-100';
	if (tone === 'warn')
		return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
	return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
}

export const SiteDrilldownPanel: React.FC<{
	drilldown: SiteManagerUxSiteDrilldown;
	busy: string | null;
	confirmAction: string | null;
	onConfirmAction: (action: string | null) => void;
	onJobCancel: (job: SiteStudioLifecycleJob) => void;
	onJobRetry: (job: SiteStudioLifecycleJob) => void;
	onReconcileMarkFailed: (
		card: SiteManagerUxSiteCard,
		issue: SiteManagerOpsReconcileIssue
	) => void;
	t: TFunction<'siteStudio'>;
}> = ({
	drilldown,
	busy,
	confirmAction,
	onConfirmAction,
	onJobCancel,
	onJobRetry,
	onReconcileMarkFailed,
	t,
}) => {
	const { card } = drilldown;
	const [copyStatus, setCopyStatus] = React.useState<
		'idle' | 'copied' | 'failed'
	>('idle');
	const [digestCopyStatus, setDigestCopyStatus] = React.useState<
		'idle' | 'copied' | 'failed'
	>('idle');
	const supportExportCopy = React.useMemo<SiteManagerSupportExportCopy>(
		() => ({
			headerSupport: t('siteManager.supportExport.headerSupport'),
			headerDigest: t('siteManager.supportExport.headerDigest'),
			site: t('siteManager.supportExport.site'),
			scopeId: t('siteManager.supportExport.scopeId'),
			slugStatus: t('siteManager.supportExport.slugStatus'),
			publication: t('siteManager.supportExport.publication'),
			publicUrl: t('siteManager.supportExport.publicUrl'),
			uxState: t('siteManager.supportExport.uxState'),
			nextAction: t('siteManager.supportExport.nextAction'),
			lastError: t('siteManager.supportExport.lastError'),
			domains: t('siteManager.supportExport.domains'),
			jobs: t('siteManager.supportExport.jobs'),
			publishSmoke: t('siteManager.supportExport.publishSmoke'),
			audit: t('siteManager.supportExport.audit'),
			signals: t('siteManager.supportExport.signals'),
			notSet: t('siteManager.supportExport.notSet'),
			none: t('siteManager.supportExport.none'),
			pending: t('siteManager.supportExport.pending'),
			ok: t('siteManager.supportExport.ok'),
			fail: t('siteManager.supportExport.fail'),
			hardFailures: t('siteManager.supportExport.hardFailures'),
			tls: t('siteManager.supportExport.tls'),
			route: t('siteManager.supportExport.route'),
			stage: t('siteManager.supportExport.stage'),
			error: t('siteManager.supportExport.error'),
			at: t('siteManager.supportExport.at'),
		}),
		[t]
	);
	const supportSummary = React.useMemo(
		() => buildSiteManagerSupportSummary(drilldown, supportExportCopy),
		[drilldown, supportExportCopy]
	);
	const digestSummary = React.useMemo(
		() => buildSiteManagerIssueDigestSummary(drilldown, supportExportCopy),
		[drilldown, supportExportCopy]
	);
	const issueDigest = React.useMemo(
		() => deriveSiteManagerIssueDigest(drilldown),
		[drilldown]
	);
	const summaryItems = React.useMemo(
		() => [
			{
				key: 'domains',
				label: t('siteManager.drilldown.summaryDomains'),
				value: card.domains.length,
			},
			{
				key: 'jobs',
				label: t('siteManager.drilldown.summaryJobs'),
				value: drilldown.jobs.length,
			},
			{
				key: 'smoke',
				label: t('siteManager.drilldown.summarySmoke'),
				value: card.smokeResult
					? t(`siteManager.smoke.${card.smokeResult.status}`, {
							failures: card.smokeResult.hard_failure_count,
						})
					: t('siteManager.smoke.notRun'),
			},
			{
				key: 'signals',
				label: t('siteManager.drilldown.summarySignals'),
				value: issueDigest.length,
			},
		],
		[
			card.domains.length,
			card.smokeResult,
			drilldown.jobs.length,
			issueDigest.length,
			t,
		]
	);
	const copySupportSummary = React.useCallback(async () => {
		try {
			await navigator.clipboard.writeText(supportSummary);
			setCopyStatus('copied');
		} catch {
			setCopyStatus('failed');
		}
	}, [supportSummary]);
	const copyDigestSummary = React.useCallback(async () => {
		try {
			await navigator.clipboard.writeText(digestSummary);
			setDigestCopyStatus('copied');
		} catch {
			setDigestCopyStatus('failed');
		}
	}, [digestSummary]);
	const focusDrilldownSection = React.useCallback(
		(sectionId: SiteManagerUxDrilldownSectionId) => {
			document
				.getElementById(`site-manager-drilldown-${sectionId}`)
				?.scrollIntoView({
					block: 'start',
					behavior: 'smooth',
				});
		},
		[]
	);

	return (
		<DesktopAppSurface
			id="site-manager-selected-drilldown"
			variant="soft"
			padding="sm"
			className="scroll-mt-4 space-y-4 border border-[rgb(var(--desktop-accent-rgb))]/25"
			data-testid="site-manager-selected-drilldown"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<SectionTitle title={t('siteManager.drilldown.title')} />
					<h2 className="mt-2 text-lg font-semibold text-(--desktop-text-primary)">
						{card.instance.site_title || card.instance.site_slug}
					</h2>
					<p className="mt-1 text-sm leading-6 text-(--desktop-text-secondary)">
						{t('siteManager.drilldown.description')}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<span
						className={`rounded-full border px-2 py-1 text-xs ${toneClass(card.severity)}`}
					>
						{t(card.stateKey)}
					</span>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => void copyDigestSummary()}
					>
						{t('siteManager.drilldown.copyDigest')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => void copySupportSummary()}
					>
						{t('siteManager.drilldown.copySummary')}
					</DesktopAppButton>
				</div>
			</div>
			{copyStatus !== 'idle' ? (
				<div
					className={`rounded-md border p-2 text-xs ${
						copyStatus === 'copied'
							? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
							: 'border-amber-400/25 bg-amber-500/10 text-amber-100'
					}`}
				>
					{copyStatus === 'copied'
						? t('siteManager.drilldown.copySummaryDone')
						: t('siteManager.drilldown.copySummaryFailed')}
				</div>
			) : null}
			{digestCopyStatus !== 'idle' ? (
				<div
					className={`rounded-md border p-2 text-xs ${
						digestCopyStatus === 'copied'
							? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
							: 'border-amber-400/25 bg-amber-500/10 text-amber-100'
					}`}
				>
					{digestCopyStatus === 'copied'
						? t('siteManager.drilldown.copyDigestDone')
						: t('siteManager.drilldown.copyDigestFailed')}
				</div>
			) : null}
			<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
				<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
					{t('siteManager.drilldown.summaryTitle')}
				</div>
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{summaryItems.map((item) => (
						<div
							key={item.key}
							className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-3"
						>
							<div className="text-xs text-(--desktop-text-dim)">
								{item.label}
							</div>
							<div className="mt-1 text-base font-semibold text-(--desktop-text-primary)">
								{item.value}
							</div>
						</div>
					))}
				</div>
			</DesktopAppSurface>

			<IssueDigestPanel
				issues={issueDigest}
				onOpenSection={focusDrilldownSection}
				t={t}
			/>

			<div className="grid gap-3 lg:grid-cols-2">
				<DrilldownSection
					id="site-manager-drilldown-domains"
					title={t('siteManager.drilldown.domains')}
					count={card.domains.length}
					t={t}
				>
					{card.domains.length ? (
						card.domains.map((domain) => (
							<div
								key={domain.binding.id}
								className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-2 text-xs text-(--desktop-text-secondary)"
							>
								<div className="break-all font-medium text-(--desktop-text-primary)">
									{domain.binding.hostname}
								</div>
								<div className="mt-1">{t(domain.statusKey)}</div>
								<DomainStepMini domain={domain} t={t} />
							</div>
						))
					) : (
						<EmptyLine text={t('siteManager.drilldown.noDomains')} />
					)}
				</DrilldownSection>

				<DrilldownSection
					id="site-manager-drilldown-jobs"
					title={t('siteManager.drilldown.jobs')}
					count={drilldown.jobs.length}
					t={t}
				>
					{drilldown.jobs.length ? (
						drilldown.jobs.slice(0, 5).map((job) => (
							<div
								key={job.id}
								className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-2 text-xs text-(--desktop-text-secondary)"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="font-medium text-(--desktop-text-primary)">
											{formatJobTitle(t, job)}
										</div>
										<JobMetaChips job={job} t={t} />
										{job.last_error ? (
											<div className="mt-2 rounded-md border border-red-400/20 bg-red-500/8 p-2 text-red-100">
												<div className="text-[10px] uppercase tracking-[0.14em] text-red-200/80">
													{t('siteManager.drilldown.jobLastError')}
												</div>
												<div className="mt-1 wrap-break-word">
													{job.last_error}
												</div>
											</div>
										) : null}
									</div>
									<JobRepairActions
										job={job}
										busy={busy}
										confirmAction={confirmAction}
										onCancel={onJobCancel}
										onConfirmAction={onConfirmAction}
										onRetry={onJobRetry}
										t={t}
									/>
								</div>
							</div>
						))
					) : (
						<EmptyLine text={t('siteManager.drilldown.noJobs')} />
					)}
				</DrilldownSection>

				<DrilldownSection
					id="site-manager-drilldown-smoke"
					title={t('siteManager.drilldown.smoke')}
					count={card.smokeResult?.checks.length ?? 0}
					t={t}
				>
					{card.smokeResult ? (
						<div className="space-y-2">
							<div className="text-sm font-medium text-(--desktop-text-primary)">
								{t(`siteManager.smoke.${card.smokeResult.status}`, {
									failures: card.smokeResult.hard_failure_count,
								})}
							</div>
							<ul className="grid gap-2">
								{card.smokeResult.checks.slice(0, 6).map((check) => (
									<li key={check.key}>
										<SmokeCheckCard check={check} t={t} />
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyLine text={t('siteManager.drilldown.noSmoke')} />
					)}
				</DrilldownSection>

				<DrilldownSection
					id="site-manager-drilldown-reconcile"
					title={t('siteManager.drilldown.reconcile')}
					count={card.reconcileIssues.length}
					t={t}
				>
					{card.reconcileIssues.length ? (
						card.reconcileIssues.slice(0, 5).map((issue) => (
							<div
								key={issue.code}
								className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-2 text-xs text-(--desktop-text-secondary)"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="font-medium text-(--desktop-text-primary)">
											{formatReconcileTitle(t, issue)}
										</div>
										<div className="mt-2 rounded-md border border-amber-400/20 bg-amber-500/8 p-2 text-amber-100">
											<div className="text-[10px] uppercase tracking-[0.14em] text-amber-100/75">
												{t('siteManager.drilldown.reconcileMessage')}
											</div>
											<div className="mt-1 wrap-break-word">
												{issue.message || issue.next_action}
											</div>
										</div>
										<ReconcileMetaChips issue={issue} t={t} />
									</div>
									<ConfirmableActionButton
										actionId={`reconcile-failed:${card.key}:${issue.code}`}
										busy={busy}
										confirmAction={confirmAction}
										label={t('siteManager.reconcileActions.markFailed')}
										confirmLabel={t(
											'siteManager.reconcileActions.confirmMarkFailed'
										)}
										cancelLabel={t(
											'siteManager.reconcileActions.cancelConfirm'
										)}
										onConfirmAction={onConfirmAction}
										onRun={() => onReconcileMarkFailed(card, issue)}
									/>
								</div>
							</div>
						))
					) : (
						<EmptyLine text={t('siteManager.drilldown.noReconcile')} />
					)}
				</DrilldownSection>

				<DrilldownSection
					title={t('siteManager.drilldown.audit')}
					count={drilldown.auditEvents.length}
					t={t}
				>
					{drilldown.auditEvents.length ? (
						drilldown.auditEvents.slice(0, 5).map((event) => (
							<div
								key={event.id}
								className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface) p-2 text-xs text-(--desktop-text-secondary)"
							>
								<div className="font-medium text-(--desktop-text-primary)">
									{formatTranslatedValue(
										t,
										'siteManager.auditAction',
										event.action
									)}
								</div>
								<AuditMetaChips event={event} t={t} />
							</div>
						))
					) : (
						<EmptyLine text={t('siteManager.drilldown.noAudit')} />
					)}
				</DrilldownSection>
			</div>
		</DesktopAppSurface>
	);
};

const IssueDigestPanel: React.FC<{
	issues: SiteManagerUxIssueDigestItem[];
	onOpenSection: (sectionId: SiteManagerUxDrilldownSectionId) => void;
	t: TFunction<'siteStudio'>;
}> = ({ issues, onOpenSection, t }) => (
	<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
				{t('siteManager.issueDigest.title')}
			</div>
			<span className="rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
				{t('siteManager.issueDigest.count', { count: issues.length })}
			</span>
		</div>
		{issues.length ? (
			<ul className="mt-3 grid gap-2 md:grid-cols-2">
				{issues.slice(0, 6).map((issue) => (
					<li key={issue.id}>
						<button
							type="button"
							data-testid={`site-manager-issue-${issue.id}`}
							className={`w-full rounded-md border p-2 text-left text-xs transition hover:brightness-110 ${toneClass(issue.severity)}`}
							onClick={() => onOpenSection(issue.targetSectionId)}
						>
							<div className="font-medium">{t(issue.titleKey)}</div>
							<div className="mt-1 opacity-85">{issue.detail}</div>
							<div className="mt-2 text-[11px] opacity-75">
								{t('siteManager.issueDigest.openSection')}
							</div>
						</button>
					</li>
				))}
			</ul>
		) : (
			<div className="mt-3 text-sm text-(--desktop-text-secondary)">
				{t('siteManager.issueDigest.empty')}
			</div>
		)}
	</div>
);

const DrilldownSection: React.FC<
	React.PropsWithChildren<{
		count?: number;
		id?: string;
		t: TFunction<'siteStudio'>;
		title: string;
	}>
> = ({ count, id, t, title, children }) => (
	<div
		id={id}
		className="scroll-mt-4 space-y-2 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
	>
		<div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-(--desktop-text-dim)">
			<span>{title}</span>
			{typeof count === 'number' ? (
				<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface) px-2 py-0.5 text-[11px] normal-case tracking-normal text-(--desktop-text-muted)">
					{t('siteManager.drilldown.sectionCount', { count })}
				</span>
			) : null}
		</div>
		{children}
	</div>
);

const DomainStepMini: React.FC<{
	domain: SiteManagerUxDomainFlow;
	t: TFunction<'siteStudio'>;
}> = ({ domain, t }) => (
	<ol
		className="mt-3 grid list-none gap-1 p-0 sm:grid-cols-5"
		data-testid={`site-manager-drilldown-domain-steps-${domain.binding.id}`}
	>
		{domain.steps.map((step) => (
			<li
				key={step.id}
				className={`rounded-md border px-2 py-1 ${
					step.status === 'done'
						? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
						: step.status === 'current'
							? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
							: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
				}`}
			>
				<div className="font-medium">{t(step.labelKey)}</div>
				<div className="mt-0.5 text-[11px] opacity-80">
					{t(`siteManager.domainStepStatus.${step.status}`)}
				</div>
			</li>
		))}
	</ol>
);

const JobMetaChips: React.FC<{
	job: SiteStudioLifecycleJob;
	t: TFunction<'siteStudio'>;
}> = ({ job, t }) => (
	<div className="mt-2 flex flex-wrap gap-1">
		{[
			{
				key: 'stage',
				label: t('siteManager.drilldown.jobMetaStage'),
				value: formatTranslatedValue(t, 'siteManager.jobStage', job.stage),
			},
			{
				key: 'updated',
				label: t('siteManager.drilldown.jobMetaUpdated'),
				value: formatDate(job.updated_at),
			},
			{
				key: 'attempts',
				label: t('siteManager.drilldown.jobMetaAttempts'),
				value: job.attempts,
			},
		].map((item) => (
			<span
				key={item.key}
				className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)"
			>
				<span className="text-(--desktop-text-dim)">{item.label}: </span>
				<span className="font-medium text-(--desktop-text-primary)">
					{item.value}
				</span>
			</span>
		))}
	</div>
);

const SmokeCheckCard: React.FC<{
	check: SiteManagerOpsSmokeCheck;
	t: TFunction<'siteStudio'>;
}> = ({ check, t }) => (
	<div
		className={`rounded-md border p-2 text-xs ${
			check.ok
				? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
				: 'border-amber-400/25 bg-amber-500/10 text-amber-100'
		}`}
	>
		<div className="flex flex-wrap items-start justify-between gap-2">
			<div className="font-medium">
				{check.ok
					? t('siteManager.smokeDetails.ok')
					: t('siteManager.smokeDetails.fail')}
			</div>
			<span className="rounded-full border border-current/25 px-2 py-0.5 text-[11px] opacity-85">
				{formatTranslatedValue(t, 'siteManager.severity', check.severity)}
			</span>
		</div>
		<div className="mt-1 leading-5">{check.message}</div>
		<div className="mt-2 text-[11px] opacity-75">
			{t('siteManager.drilldown.smokeCheckKey')}: {check.key}
		</div>
	</div>
);

const ReconcileMetaChips: React.FC<{
	issue: SiteManagerOpsReconcileIssue;
	t: TFunction<'siteStudio'>;
}> = ({ issue, t }) => (
	<div className="mt-2 flex flex-wrap gap-1">
		<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
			<span className="text-(--desktop-text-dim)">
				{t('siteManager.drilldown.reconcileSeverity')}:{' '}
			</span>
			<span className="font-medium text-(--desktop-text-primary)">
				{formatTranslatedValue(t, 'siteManager.severity', issue.severity)}
			</span>
		</span>
		<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
			<span className="text-(--desktop-text-dim)">
				{t('siteManager.drilldown.reconcileCode')}:{' '}
			</span>
			<span className="font-medium text-(--desktop-text-primary)">
				{issue.code}
			</span>
		</span>
		<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
			<span className="text-(--desktop-text-dim)">
				{t('siteManager.drilldown.reconcileNextAction')}:{' '}
			</span>
			<span className="font-medium text-(--desktop-text-primary)">
				{issue.next_action || '—'}
			</span>
		</span>
	</div>
);

const AuditMetaChips: React.FC<{
	event: SiteManagerOpsAuditEvent;
	t: TFunction<'siteStudio'>;
}> = ({ event, t }) => (
	<div className="mt-2 flex flex-wrap gap-1">
		<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
			<span className="text-(--desktop-text-dim)">
				{t('siteManager.drilldown.auditTarget')}:{' '}
			</span>
			<span className="font-medium text-(--desktop-text-primary)">
				{formatTranslatedValue(t, 'siteManager.auditTarget', event.target_type)}
				{' · '}
				{event.target_id ?? '—'}
			</span>
		</span>
		<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] text-(--desktop-text-muted)">
			<span className="text-(--desktop-text-dim)">
				{t('siteManager.drilldown.auditTime')}:{' '}
			</span>
			<span className="font-medium text-(--desktop-text-primary)">
				{formatDate(event.created_at)}
			</span>
		</span>
	</div>
);

const JobRepairActions: React.FC<{
	job: SiteStudioLifecycleJob;
	busy: string | null;
	confirmAction: string | null;
	onCancel: (job: SiteStudioLifecycleJob) => void;
	onConfirmAction: (action: string | null) => void;
	onRetry: (job: SiteStudioLifecycleJob) => void;
	t: TFunction<'siteStudio'>;
}> = ({ job, busy, confirmAction, onCancel, onConfirmAction, onRetry, t }) => {
	const canCancel = ['created', 'queued', 'running'].includes(job.status);
	const canRetry =
		job.status === 'failed' &&
		[
			'site_studio_provision',
			'site_studio_start',
			'site_studio_stop',
			'site_studio_redeploy',
		].includes(job.task_type);

	if (!canCancel && !canRetry) return null;

	return (
		<div className="flex flex-wrap justify-end gap-2">
			{canCancel ? (
				<ConfirmableActionButton
					actionId={`job-cancel:${job.id}`}
					busy={busy}
					confirmAction={confirmAction}
					label={t('siteManager.jobActions.cancel')}
					confirmLabel={t('siteManager.jobActions.confirmCancel')}
					cancelLabel={t('siteManager.jobActions.cancelConfirm')}
					onConfirmAction={onConfirmAction}
					onRun={() => onCancel(job)}
				/>
			) : null}
			{canRetry ? (
				<ConfirmableActionButton
					actionId={`job-retry:${job.id}`}
					busy={busy}
					confirmAction={confirmAction}
					label={t('siteManager.jobActions.retry')}
					confirmLabel={t('siteManager.jobActions.confirmRetry')}
					cancelLabel={t('siteManager.jobActions.cancelConfirm')}
					onConfirmAction={onConfirmAction}
					onRun={() => onRetry(job)}
				/>
			) : null}
		</div>
	);
};
