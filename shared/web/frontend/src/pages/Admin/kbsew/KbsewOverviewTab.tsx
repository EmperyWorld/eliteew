/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KBSEW admin overview: ready/degraded probe, ingest metrics, barrel/agent summary.
 *
 * Invariants:
 * - Missing `/ready` (404) → n/a widgets, not a hard error.
 *
 * Related:
 * - `pages/Admin/kbsewAdminApi.ts` (`fetchKbsewReady`)
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	BeakerIcon,
	CircleStackIcon,
	HeartIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	fetchKbsewReady,
	getDesktopAiChatDefaults,
	listKbsewBarrels,
	type KbsewBarrel,
} from '../kbsewAdminApi';
import type { KbsewAdminTab } from '../kbsewAdminApi';
import { KbsewDegradedBanner } from './KbsewDegradedBanner';
import {
	countKbsewEnabledAgents,
	readKbsewSettingsFromDefaults,
} from './kbsewSearchSettings';
import {
	formatMetricOrNa,
	normalizeKbsewReady,
	type KbsewReadyView,
} from './kbsewReady';

type Props = {
	onOpenTab: (tab: KbsewAdminTab) => void;
};

export function KbsewOverviewTab({ onOpenTab }: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [barrels, setBarrels] = React.useState<KbsewBarrel[]>([]);
	const [enabledAgents, setEnabledAgents] = React.useState(0);
	const [allowedCount, setAllowedCount] = React.useState(0);
	const [readyView, setReadyView] = React.useState<KbsewReadyView>(() =>
		normalizeKbsewReady(null)
	);
	const [readyError, setReadyError] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		setReadyError(null);
		try {
			const [rows, defaults, ready] = await Promise.all([
				listKbsewBarrels(),
				getDesktopAiChatDefaults(),
				fetchKbsewReady().catch((err: unknown) => {
					setReadyError(err instanceof Error ? err.message : String(err));
					return null;
				}),
			]);
			setBarrels(rows);
			const form = readKbsewSettingsFromDefaults(defaults);
			setEnabledAgents(countKbsewEnabledAgents(form));
			setAllowedCount(form.allowedBarrelIds.length);
			setReadyView(normalizeKbsewReady(ready));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void load();
	}, [load]);

	const enabledBarrels = barrels.filter((b) => b.enabled).length;
	const totalAssets = barrels.reduce((sum, b) => sum + b.asset_count, 0);

	const readyToneClass =
		readyView.kind === 'ready'
			? 'border-emerald-500/30 bg-emerald-500/5'
			: readyView.kind === 'degraded'
				? 'border-amber-500/40 bg-amber-500/5'
				: readyView.kind === 'na'
					? 'border-white/10 bg-black/25'
					: 'border-red-500/40 bg-red-500/5';

	const cards = [
		{
			key: 'barrels',
			label: t('adminKbsew.overview.barrels'),
			value: String(barrels.length),
			sub: t('adminKbsew.overview.barrelsSub', {
				enabled: enabledBarrels,
			}),
			icon: CircleStackIcon,
			tab: 'barrels' as const,
		},
		{
			key: 'assets',
			label: t('adminKbsew.overview.assets'),
			value: String(totalAssets),
			sub: t('adminKbsew.overview.assetsSub'),
			icon: CircleStackIcon,
			tab: 'barrels' as const,
		},
		{
			key: 'agent',
			label: t('adminKbsew.overview.agent'),
			value:
				enabledAgents > 0
					? t('adminKbsew.overview.agentOnCount', { count: enabledAgents })
					: t('adminKbsew.overview.agentOff'),
			sub: t('adminKbsew.overview.agentSub', { count: allowedCount }),
			icon: SparklesIcon,
			tab: 'agent-access' as const,
		},
	];

	const metricCards = [
		{
			key: 'activeJobs',
			label: t('adminKbsew.overview.metrics.activeJobs'),
			value: formatMetricOrNa(readyView.metrics.activeJobs),
		},
		{
			key: 'ingestOk',
			label: t('adminKbsew.overview.metrics.ingestSuccess'),
			value: formatMetricOrNa(readyView.metrics.ingestSuccess),
		},
		{
			key: 'ingestFail',
			label: t('adminKbsew.overview.metrics.ingestFailure'),
			value: formatMetricOrNa(readyView.metrics.ingestFailure),
		},
	];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/70 max-w-2xl`}>
					{t('adminKbsew.overview.intro')}
				</p>
				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 px-3 py-1.5 text-sm`}
					disabled={loading}
					onClick={() => void load()}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminKbsew.refresh')}
				</button>
			</div>

			{error ? <KbsewDegradedBanner tone="error" message={error} /> : null}
			{readyError ? (
				<KbsewDegradedBanner
					tone="degraded"
					title={t('adminKbsew.overview.ready.degradedTitle')}
					message={readyError}
				/>
			) : null}
			{readyView.kind === 'degraded' && readyView.detail ? (
				<KbsewDegradedBanner
					tone="degraded"
					title={t('adminKbsew.overview.ready.degradedTitle')}
					message={readyView.detail}
				/>
			) : null}

			<section className={`rounded-xl border p-4 ${readyToneClass}`}>
				<div className="mb-3 flex items-center gap-2 text-violet-300/90">
					<HeartIcon className="h-5 w-5" />
					<span
						className={`${DESKTOP_TYPOGRAPHY.caption} uppercase tracking-wide`}
					>
						{t('adminKbsew.overview.ready.title')}
					</span>
				</div>
				<div className="text-2xl font-semibold text-white">
					{t(readyView.labelKey)}
				</div>
				{readyView.detail && readyView.kind !== 'degraded' ? (
					<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-white/55`}>
						{readyView.detail}
					</p>
				) : (
					<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-white/55`}>
						{t('adminKbsew.overview.ready.hint')}
					</p>
				)}
				<div className="mt-4 grid gap-2 sm:grid-cols-3">
					{metricCards.map((m) => (
						<div
							key={m.key}
							className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
						>
							<div className={`${DESKTOP_TYPOGRAPHY.caption} text-white/55`}>
								{m.label}
							</div>
							<div className="mt-0.5 font-mono text-lg text-white/90">
								{m.value}
							</div>
						</div>
					))}
				</div>
			</section>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{cards.map((card) => {
					const Icon = card.icon;
					return (
						<button
							key={card.key}
							type="button"
							className="rounded-xl border border-white/10 bg-black/25 p-4 text-left transition-colors hover:border-violet-400/30 hover:bg-violet-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
							onClick={() => onOpenTab(card.tab)}
						>
							<div className="mb-2 flex items-center gap-2 text-violet-300/90">
								<Icon className="h-5 w-5" />
								<span
									className={`${DESKTOP_TYPOGRAPHY.caption} uppercase tracking-wide`}
								>
									{card.label}
								</span>
							</div>
							<div className="text-2xl font-semibold text-white">
								{card.value}
							</div>
							<div
								className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-white/55`}
							>
								{card.sub}
							</div>
						</button>
					);
				})}
			</div>

			<div className="rounded-xl border border-white/10 bg-black/20 p-4">
				<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}>
					{t('adminKbsew.overview.quickActions')}
				</h3>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnPrimary} px-4 py-2 text-sm`}
						onClick={() => onOpenTab('barrels')}
					>
						{t('adminKbsew.overview.openBarrels')}
					</button>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-4 py-2 text-sm`}
						onClick={() => onOpenTab('agent-access')}
					>
						{t('adminKbsew.overview.openAgentAccess')}
					</button>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 px-4 py-2 text-sm`}
						onClick={() => onOpenTab('test-search')}
					>
						<BeakerIcon className="h-4 w-4" />
						{t('adminKbsew.overview.openTestSearch')}
					</button>
				</div>
			</div>
		</div>
	);
}
