/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose hook for Site Manager Ops: overview/templates fetch, mutations, UX derivation and selection persistence.
 *
 * Invariants:
 * - All data comes from authenticated Site Manager Ops API endpoints.
 * - Mutating controls only call explicit operator endpoints; no repair/delete action is automatic.
 *
 * Related:
 * - ../../api.ts
 * - ../../siteManagerUserStatus.ts
 * - ./siteManagerOpsStorage.ts
 * - documentation/product/SITE-STUDIO.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	cancelSiteManagerLifecycleJob,
	getSiteManagerOpsInstances,
	getSiteManagerOpsOverview,
	getSiteManagerOpsTemplates,
	markSiteManagerDnsOutboxApplied,
	markSiteManagerDomainTlsReady,
	markSiteManagerReconcileFailed,
	retrySiteManagerLifecycleJob,
	runSiteManagerPublishSmoke,
	type SiteManagerOpsOverview,
	type SiteManagerOpsReconcileIssue,
	type SiteManagerOpsRuntimeInstancesPage,
	type SiteManagerOpsSmokeResult,
	type SiteManagerOpsTemplateRegistry,
	type SiteStudioLifecycleJob,
} from '../../api';
import {
	deriveSiteManagerUxOverview,
	deriveSiteManagerSiteDrilldown,
	deriveSiteManagerIssueDigest,
	filterSiteManagerAttentionIssues,
	searchAndSortSiteManagerUxCards,
	type SiteManagerUxDrilldownSectionId,
	type SiteManagerUxNextAction,
	type SiteManagerUxSeverity,
	type SiteManagerUxSiteCard,
} from '../../siteManagerUserStatus';
import { isAttentionSiteCard } from './siteManagerOpsFormatters';
import {
	persistControls,
	persistSelectedSiteKey,
	readStoredControls,
	readStoredSelectedSiteKey,
	type SiteManagerStoredControls,
} from './siteManagerOpsStorage';

export type SiteManagerCardSignalSummary = {
	count: number;
	severity: SiteManagerUxSeverity;
	targetSectionId: SiteManagerUxDrilldownSectionId | null;
	titleKey: string | null;
	detail: string | null;
};

export function useSiteManagerOps() {
	const { t } = useTranslation('siteStudio');
	const [overview, setOverview] = React.useState<SiteManagerOpsOverview | null>(
		null
	);
	const [templates, setTemplates] =
		React.useState<SiteManagerOpsTemplateRegistry | null>(null);
	const [controls, setControls] = React.useState<SiteManagerStoredControls>(
		() => readStoredControls()
	);
	const [selectedSiteKey, setSelectedSiteKey] = React.useState<string | null>(
		() => readStoredSelectedSiteKey()
	);
	const [smokeResults, setSmokeResults] = React.useState<
		Record<string, SiteManagerOpsSmokeResult | undefined>
	>({});
	const [instanceSearchPage, setInstanceSearchPage] =
		React.useState<SiteManagerOpsRuntimeInstancesPage | null>(null);
	const [instanceSearchBusy, setInstanceSearchBusy] = React.useState(false);
	const [instanceSearchError, setInstanceSearchError] = React.useState<
		string | null
	>(null);
	const [pendingSignalFocus, setPendingSignalFocus] = React.useState<{
		siteKey: string;
		sectionId: SiteManagerUxDrilldownSectionId;
	} | null>(null);
	const [confirmAction, setConfirmAction] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [lastSuccessAt, setLastSuccessAt] = React.useState<Date | null>(null);

	const refresh = React.useCallback(async () => {
		try {
			setBusy('refresh');
			setError(null);
			const [nextOverview, nextTemplates] = await Promise.all([
				getSiteManagerOpsOverview(),
				getSiteManagerOpsTemplates(),
			]);
			setOverview(nextOverview);
			setTemplates(nextTemplates);
			setLastSuccessAt(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const runOutboxApply = React.useCallback(
		async (outboxId: string) => {
			try {
				setBusy(`outbox:${outboxId}`);
				setError(null);
				await markSiteManagerDnsOutboxApplied(outboxId);
				setConfirmAction(null);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(null);
			}
		},
		[refresh]
	);

	const runTlsReady = React.useCallback(
		async (bindingId: string, hostname: string) => {
			try {
				setBusy(`tls:${bindingId}`);
				setError(null);
				await markSiteManagerDomainTlsReady(
					bindingId,
					`Marked ready from Site Manager Ops UI for ${hostname}`
				);
				setConfirmAction(null);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(null);
			}
		},
		[refresh]
	);

	const runSmoke = React.useCallback(async (card: SiteManagerUxSiteCard) => {
		try {
			setBusy(`smoke:${card.key}`);
			setError(null);
			const result = await runSiteManagerPublishSmoke({
				instance_scope:
					card.instance.instance_scope === 'project' ? 'project' : 'user',
				instance_id: card.instance.id,
				run_live: true,
			});
			setSmokeResults((previous) => ({
				...previous,
				[card.key]: result,
			}));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	}, []);

	const runJobCancel = React.useCallback(
		async (job: SiteStudioLifecycleJob) => {
			try {
				setBusy(`job-cancel:${job.id}`);
				setError(null);
				await cancelSiteManagerLifecycleJob(job.id);
				setConfirmAction(null);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(null);
			}
		},
		[refresh]
	);

	const runJobRetry = React.useCallback(
		async (job: SiteStudioLifecycleJob) => {
			try {
				setBusy(`job-retry:${job.id}`);
				setError(null);
				await retrySiteManagerLifecycleJob(job.id);
				setConfirmAction(null);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(null);
			}
		},
		[refresh]
	);

	const runReconcileMarkFailed = React.useCallback(
		async (
			card: SiteManagerUxSiteCard,
			issue: SiteManagerOpsReconcileIssue
		) => {
			try {
				const actionId = `reconcile-failed:${card.key}:${issue.code}`;
				setBusy(actionId);
				setError(null);
				await markSiteManagerReconcileFailed({
					instance_scope:
						card.instance.instance_scope === 'project' ? 'project' : 'user',
					instance_id: card.instance.id,
					reason: [
						'Marked failed from Site Manager reconcile UI',
						`site=${card.instance.site_slug}`,
						`issue=${issue.code}`,
						issue.message || issue.next_action,
					]
						.filter(Boolean)
						.join(' · '),
				});
				setConfirmAction(null);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(null);
			}
		},
		[refresh]
	);

	const uxOverview = React.useMemo(
		() =>
			overview ? deriveSiteManagerUxOverview(overview, smokeResults) : null,
		[overview, smokeResults]
	);
	const attentionSiteCards = React.useMemo(
		() =>
			uxOverview
				? searchAndSortSiteManagerUxCards(
						uxOverview.cards.filter(isAttentionSiteCard),
						{
							filter: 'all',
							query: controls.searchQuery,
							sort: controls.sort,
						}
					)
				: [],
		[controls.searchQuery, controls.sort, uxOverview]
	);
	const visibleCards = React.useMemo(
		() =>
			uxOverview
				? searchAndSortSiteManagerUxCards(uxOverview.cards, {
						filter: controls.filter,
						query: controls.searchQuery,
						sort: controls.sort,
					})
				: [],
		[controls.filter, controls.searchQuery, controls.sort, uxOverview]
	);
	const modeSiteCards =
		controls.viewMode === 'attention' ? attentionSiteCards : visibleCards;
	const updateControls = React.useCallback(
		(updates: Partial<SiteManagerStoredControls>) => {
			setControls((previous) => {
				const next = { ...previous, ...updates };
				persistControls(next);
				return next;
			});
		},
		[]
	);
	const selectSiteKey = React.useCallback((siteKey: string | null) => {
		setSelectedSiteKey(siteKey);
		persistSelectedSiteKey(siteKey);
	}, []);
	React.useEffect(() => {
		if (!uxOverview) return;
		const selectionPool =
			controls.viewMode === 'attention'
				? attentionSiteCards
				: controls.viewMode === 'advanced'
					? visibleCards
					: uxOverview.cards;
		if (!selectionPool.length) {
			selectSiteKey(null);
			return;
		}
		if (
			selectedSiteKey &&
			selectionPool.some((card) => card.key === selectedSiteKey)
		) {
			return;
		}
		selectSiteKey(selectionPool[0]?.key ?? null);
	}, [
		attentionSiteCards,
		controls.viewMode,
		selectSiteKey,
		selectedSiteKey,
		uxOverview,
		visibleCards,
	]);
	const selectedDrilldown = React.useMemo(() => {
		if (!overview || !uxOverview || !selectedSiteKey) return null;
		const selectedCard =
			uxOverview.cards.find((card) => card.key === selectedSiteKey) ?? null;
		return selectedCard
			? deriveSiteManagerSiteDrilldown(overview, selectedCard)
			: null;
	}, [overview, selectedSiteKey, uxOverview]);
	const selectedIssueDigest = React.useMemo(
		() =>
			selectedDrilldown ? deriveSiteManagerIssueDigest(selectedDrilldown) : [],
		[selectedDrilldown]
	);
	const selectedAttentionIssues = React.useMemo(
		() => filterSiteManagerAttentionIssues(selectedIssueDigest),
		[selectedIssueDigest]
	);
	const issueDigestByCardKey = React.useMemo(() => {
		if (!overview || !uxOverview) {
			return new Map<
				string,
				{
					count: number;
					severity: SiteManagerUxSeverity;
					targetSectionId: SiteManagerUxDrilldownSectionId | null;
					titleKey: string | null;
					detail: string | null;
				}
			>();
		}
		return new Map(
			uxOverview.cards.map((card) => {
				const issues = filterSiteManagerAttentionIssues(
					deriveSiteManagerIssueDigest(
						deriveSiteManagerSiteDrilldown(overview, card)
					)
				);
				return [
					card.key,
					{
						count: issues.length,
						severity: issues[0]?.severity ?? 'ok',
						targetSectionId: issues[0]?.targetSectionId ?? null,
						titleKey: issues[0]?.titleKey ?? null,
						detail: issues[0]?.detail ?? null,
					},
				];
			})
		);
	}, [overview, uxOverview]);
	const selectedTopSignalSection =
		selectedAttentionIssues[0]?.targetSectionId ?? null;
	const staleJobs = (overview?.jobs ?? []).filter((job) =>
		['created', 'queued', 'running', 'failed'].includes(job.status)
	);
	const pendingOutbox = (overview?.dns_outbox ?? []).filter(
		(row) => row.status === 'pending'
	);
	const pendingDnsTlsQueue = React.useMemo(() => {
		if (!overview || !uxOverview) {
			return { outbox: [], domains: [] };
		}
		const outbox = pendingOutbox.slice(0, 6);
		const domains = uxOverview.domains
			.filter(
				(domain) =>
					domain.needsOperator ||
					domain.pendingOutbox ||
					domain.binding.tls_status === 'pending' ||
					domain.binding.status === 'route_pending'
			)
			.slice(0, 6);
		return { outbox, domains };
	}, [overview, pendingOutbox, uxOverview]);
	const truncatedOverviewLimits = React.useMemo(
		() =>
			Object.entries(overview?.overview_limits ?? {}).filter(
				([, meta]) => meta.truncated
			),
		[overview?.overview_limits]
	);
	const isInstancesOverviewTruncated = Boolean(
		overview?.overview_limits?.instances?.truncated
	);
	const serverSearchQuery = controls.searchQuery.trim();
	React.useEffect(() => {
		if (!isInstancesOverviewTruncated || serverSearchQuery.length < 2) {
			setInstanceSearchPage(null);
			setInstanceSearchError(null);
			setInstanceSearchBusy(false);
			return;
		}
		let cancelled = false;
		const timer = window.setTimeout(() => {
			setInstanceSearchBusy(true);
			setInstanceSearchError(null);
			getSiteManagerOpsInstances({
				q: serverSearchQuery,
				limit: 10,
				offset: 0,
			})
				.then((page) => {
					if (!cancelled) {
						setInstanceSearchPage(page);
					}
				})
				.catch((err) => {
					if (!cancelled) {
						setInstanceSearchError(
							err instanceof Error ? err.message : String(err)
						);
					}
				})
				.finally(() => {
					if (!cancelled) {
						setInstanceSearchBusy(false);
					}
				});
		}, 250);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [isInstancesOverviewTruncated, serverSearchQuery]);
	const handleCardAction = React.useCallback(
		(card: SiteManagerUxSiteCard, action: SiteManagerUxNextAction) => {
			if (action === 'open_public' && card.instance.public_url) {
				window.open(card.instance.public_url, '_blank', 'noopener,noreferrer');
				return;
			}
			if (action === 'run_smoke') {
				void runSmoke(card);
				return;
			}
			if (action === 'check_domain') {
				updateControls({ viewMode: 'domains' });
				window.requestAnimationFrame(() => {
					document
						.getElementById('site-manager-domain-stepper')
						?.scrollIntoView({
							block: 'start',
							behavior: 'smooth',
						});
				});
				return;
			}
			updateControls({ viewMode: 'advanced' });
			window.requestAnimationFrame(() => {
				document.getElementById('site-manager-recovery')?.scrollIntoView({
					block: 'start',
					behavior: 'smooth',
				});
			});
		},
		[runSmoke, updateControls]
	);
	const focusSelectedDrilldown = React.useCallback(() => {
		document.getElementById('site-manager-selected-drilldown')?.scrollIntoView({
			block: 'start',
			behavior: 'smooth',
		});
	}, []);
	const focusSelectedSignal = React.useCallback(() => {
		if (!selectedTopSignalSection) {
			focusSelectedDrilldown();
			return;
		}
		document
			.getElementById(`site-manager-drilldown-${selectedTopSignalSection}`)
			?.scrollIntoView({
				block: 'start',
				behavior: 'smooth',
			});
	}, [focusSelectedDrilldown, selectedTopSignalSection]);
	const focusCardSignal = React.useCallback(
		(siteKey: string, sectionId: SiteManagerUxDrilldownSectionId) => {
			selectSiteKey(siteKey);
			setPendingSignalFocus({ siteKey, sectionId });
		},
		[selectSiteKey]
	);
	React.useEffect(() => {
		if (
			!pendingSignalFocus ||
			!selectedDrilldown ||
			selectedSiteKey !== pendingSignalFocus.siteKey
		) {
			return;
		}
		document
			.getElementById(`site-manager-drilldown-${pendingSignalFocus.sectionId}`)
			?.scrollIntoView({
				block: 'start',
				behavior: 'smooth',
			});
		setPendingSignalFocus(null);
	}, [pendingSignalFocus, selectedDrilldown, selectedSiteKey]);

	return {
		t,
		overview,
		templates,
		controls,
		updateControls,
		selectedSiteKey,
		selectSiteKey,
		smokeResults,
		instanceSearchPage,
		instanceSearchBusy,
		instanceSearchError,
		confirmAction,
		setConfirmAction,
		busy,
		error,
		lastSuccessAt,
		refresh,
		runOutboxApply,
		runTlsReady,
		runSmoke,
		runJobCancel,
		runJobRetry,
		runReconcileMarkFailed,
		uxOverview,
		attentionSiteCards,
		visibleCards,
		modeSiteCards,
		selectedDrilldown,
		selectedIssueDigest,
		selectedAttentionIssues,
		issueDigestByCardKey,
		selectedTopSignalSection,
		staleJobs,
		pendingOutbox,
		pendingDnsTlsQueue,
		truncatedOverviewLimits,
		isInstancesOverviewTruncated,
		serverSearchQuery,
		handleCardAction,
		focusSelectedDrilldown,
		focusSelectedSignal,
		focusCardSignal,
	};
}

export type SiteManagerOpsModel = ReturnType<typeof useSiteManagerOps>;
