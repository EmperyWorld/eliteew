/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Human-readable health probe for Desktop AI Chat admin diagnostics tab.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	isDesktopAiChatAdminForbidden,
	runDesktopAiChatAdminProbe,
} from './desktopAiChatAdminApi';
import { DesktopAiChatAdminStatePanel } from './DesktopAiChatAdminStatePanel';
import type {
	DesktopAiChatProbeCheck,
	DesktopAiChatProbeResponse,
} from './desktopAiChatAdminTypes';

type ProbeLoadState =
	| 'idle'
	| 'running'
	| 'ready'
	| 'error'
	| 'permissionDenied';

function probeCheckLabel(t: (key: string) => string, checkId: string): string {
	const key = `adminAiChat.probeCheck.${checkId}`;
	const label = t(key);
	return label === key ? checkId : label;
}

export function DesktopAiChatAdminProbePanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [loadState, setLoadState] = React.useState<ProbeLoadState>('idle');
	const [data, setData] = React.useState<DesktopAiChatProbeResponse | null>(
		null
	);
	const [errorDetail, setErrorDetail] = React.useState<string | null>(null);

	const runProbe = React.useCallback(async () => {
		setLoadState('running');
		setErrorDetail(null);
		try {
			const res = await runDesktopAiChatAdminProbe();
			setData(res);
			setLoadState('ready');
		} catch (e) {
			log.error(
				'DesktopAiChatAdminProbe',
				'probe failed',
				e instanceof Error ? e : undefined
			);
			if (isDesktopAiChatAdminForbidden(e)) {
				setLoadState('permissionDenied');
			} else {
				setLoadState('error');
			}
			setErrorDetail(
				e instanceof Error ? e.message : t('adminAiChat.probeError')
			);
			setData(null);
		}
	}, [t]);

	const renderCheck = (check: DesktopAiChatProbeCheck) => (
		<li
			key={check.id}
			className="rounded border border-white/5 px-3 py-2 text-sm"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span className="font-medium text-white/90">
					{probeCheckLabel(t, check.id)}
				</span>
				<span className={check.ok ? 'text-emerald-300/90' : 'text-rose-300/90'}>
					{check.ok ? t('adminAiChat.probeOk') : t('adminAiChat.probeFail')}
				</span>
				<span className="text-white/60">{check.latency_ms} ms</span>
			</div>
			<p className="mt-1 text-white/70">{check.message}</p>
			{check.details ? (
				<details className="mt-2">
					<summary
						className={`${DESKTOP_TYPOGRAPHY.caption} cursor-pointer text-white/50`}
					>
						{t('adminAiChat.probeTechnicalDetails')}
					</summary>
					<pre className="mt-1 max-h-32 overflow-auto rounded bg-black/30 p-2 font-mono text-xs text-white/70">
						{JSON.stringify({ id: check.id, details: check.details }, null, 2)}
					</pre>
				</details>
			) : null}
		</li>
	);

	return (
		<section className="rounded-lg border border-white/10 bg-black/20 p-4">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}>
					{t('adminAiChat.probeTitle')}
				</h3>
				<button
					type="button"
					onClick={() => void runProbe()}
					disabled={loadState === 'running'}
					aria-busy={loadState === 'running'}
					className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
				>
					<ArrowPathIcon
						className={`h-4 w-4 ${loadState === 'running' ? 'animate-spin' : ''}`}
						aria-hidden
					/>
					{loadState === 'running'
						? t('adminAiChat.probeRunning')
						: t('adminAiChat.probeRun')}
				</button>
			</div>

			{loadState === 'permissionDenied' || loadState === 'error' ? (
				<DesktopAiChatAdminStatePanel
					state={loadState}
					errorDetail={errorDetail}
					onRetry={loadState === 'error' ? () => void runProbe() : undefined}
				/>
			) : null}

			{loadState === 'idle' ? (
				<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/50`}>
					{t('adminAiChat.probeHint')}
				</p>
			) : null}

			{data ? (
				<div className="space-y-3" aria-live="polite">
					<div
						className={`rounded-md border px-3 py-2 text-sm ${
							data.all_ok
								? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
								: 'border-amber-500/35 bg-amber-500/10 text-amber-100'
						}`}
					>
						{data.all_ok
							? t('adminAiChat.probeAllOk')
							: t('adminAiChat.probeSomeFailed')}
					</div>
					<ul className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto">
						{data.checks.map(renderCheck)}
					</ul>
				</div>
			) : null}
		</section>
	);
}
