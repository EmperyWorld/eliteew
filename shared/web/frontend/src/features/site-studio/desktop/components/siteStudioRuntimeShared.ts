/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared formatters, readiness helpers, and domain stepper utilities for Site Studio runtime panels.
 *
 * Invariants:
 * - User-facing labels use i18n keys from `siteStudio` namespace; machine ids stay out of primary copy.
 * - Domain progress steps follow TXT → route → TLS → active order.
 *
 * Related:
 * - `SiteStudioRuntimePanel.tsx`
 * - `siteStudioRuntimeGuards.ts`
 */
import type {
	SiteStudioDomainBinding,
	SiteStudioHealth,
	SiteStudioInstance,
} from '../api';
import type { SiteStudioDraftState } from '../api';
import type { SiteStudioRuntimeActionState } from './siteStudioRuntimeGuards';

export const FIELD_ITEMS = [
	{ key: 'public_hostname', labelKey: 'runtime.fieldHost' as const },
	{ key: 'public_url', labelKey: 'runtime.fieldPublicUrl' as const },
	{ key: 'api_base_url', labelKey: 'runtime.fieldApiUrl' as const },
] as const;

export type RuntimeReadinessItem = {
	id: string;
	ready: boolean;
	labelKey: string;
	readyKey: string;
	pendingKey: string;
};

export type DomainProgressStatus = 'done' | 'current' | 'next';

export type DomainProgressStep = {
	id: string;
	labelKey: string;
	status: DomainProgressStatus;
};

export function getNextStepHint(
	instance: SiteStudioInstance,
	health: SiteStudioHealth | null,
	drafts: SiteStudioDraftState | null,
	t: (key: string) => string
): string {
	if (!drafts?.siteBlueprint) {
		return t('runtime.nextBrief');
	}
	if (!drafts.contentDrafts.length) {
		return t('runtime.nextContent');
	}
	if (!drafts.imageDrafts.length) {
		return t('runtime.nextMedia');
	}
	if (instance.status === 'draft' || instance.status === 'stopped') {
		return t('runtime.nextProvision');
	}
	if (
		(health?.status === 'running' || instance.status === 'running') &&
		instance.publication_state !== 'open'
	) {
		return t('runtime.nextPublish');
	}
	if (health?.status === 'running' || instance.status === 'running') {
		return t('runtime.nextAdmin');
	}
	return t('runtime.nextDefault');
}

export function formatTranslatedValue(
	t: (key: string, options?: Record<string, unknown>) => string,
	prefix: string,
	value: string | null | undefined
): string {
	if (!value) return t('runtime.notReady');
	return t(`${prefix}.${value}`, { defaultValue: value });
}

export function formatRuntimeState(
	t: (key: string, options?: Record<string, unknown>) => string,
	value: string | null | undefined
): string {
	return formatTranslatedValue(t, 'runtime.runtimeState', value);
}

export function formatHealthState(
	t: (key: string, options?: Record<string, unknown>) => string,
	ok: boolean | null | undefined,
	error: string | null | undefined
): string {
	if (ok) return t('runtime.healthState.ready');
	if (error) return error;
	return t('runtime.healthState.offline');
}

export function formatLifecycleJobSummary(
	t: (key: string, options?: Record<string, unknown>) => string,
	job: SiteStudioHealth['last_job']
): string {
	if (!job) return '';
	const task = job.task_type.replace(/^site_studio_/, '');
	const stage = job.stage || job.status;
	return [
		formatTranslatedValue(t, 'runtime.lifecycleTaskType', task),
		formatTranslatedValue(t, 'runtime.lifecycleJobStatus', job.status),
		stage ? formatTranslatedValue(t, 'runtime.lifecycleJobStage', stage) : null,
	]
		.filter(Boolean)
		.join(' · ');
}

export function formatSmokeCheckName(
	t: (key: string, options?: Record<string, unknown>) => string,
	key: string
): string {
	return t(`runtime.smokeCheck.${key}`, {
		defaultValue: key.replaceAll('_', ' '),
	});
}

export function formatDomainBindingState(
	t: (key: string, options?: Record<string, unknown>) => string,
	binding: SiteStudioDomainBinding
): string {
	return [
		formatTranslatedValue(t, 'runtime.domainBindingStatus', binding.status),
		t('runtime.domainTlsState', {
			state: formatTranslatedValue(
				t,
				'runtime.domainTlsStatus',
				binding.tls_status
			),
		}),
	].join(' · ');
}

export function readinessTone(isReady: boolean): string {
	return isReady
		? 'border-emerald-400/25 bg-emerald-500/8'
		: 'border-amber-400/25 bg-amber-500/8';
}

export function readinessDotTone(isReady: boolean): string {
	return isReady ? 'bg-emerald-300' : 'bg-amber-300';
}

export function domainStepTone(status: DomainProgressStatus): string {
	if (status === 'done') return 'border-emerald-400/30 bg-emerald-500/10';
	if (status === 'current') return 'border-amber-400/35 bg-amber-500/10';
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60';
}

export function domainStepDotTone(status: DomainProgressStatus): string {
	if (status === 'done') return 'bg-emerald-300';
	if (status === 'current') return 'bg-amber-300';
	return 'bg-(--desktop-border-strong)';
}

export function resolveDomainProgressSteps(
	binding: SiteStudioDomainBinding
): DomainProgressStep[] {
	const ownershipReady = [
		'verified',
		'route_pending',
		'route_ready',
		'active',
	].includes(binding.status);
	const routeReady = ['route_ready', 'active'].includes(binding.status);
	const tlsReady = binding.tls_status === 'ready';
	const activeReady = binding.status === 'active';
	const done = {
		txt: ownershipReady,
		route: routeReady,
		tls: tlsReady,
		active: activeReady,
	};
	const firstPending =
		(['txt', 'route', 'tls', 'active'] as const).find((id) => !done[id]) ??
		null;
	return [
		{ id: 'txt', labelKey: 'runtime.domainsStepTxt' },
		{ id: 'route', labelKey: 'runtime.domainsStepRoute' },
		{ id: 'tls', labelKey: 'runtime.domainsStepTls' },
		{ id: 'active', labelKey: 'runtime.domainsStepActive' },
	].map((step) => ({
		...step,
		status: done[step.id as keyof typeof done]
			? 'done'
			: firstPending === step.id
				? 'current'
				: 'next',
	}));
}

export function getDomainToken(binding: SiteStudioDomainBinding): string {
	const value = binding.metadata_json.dns_txt_value;
	return typeof value === 'string' ? value : binding.verification_token_preview;
}

export function resolveActionTooltip(
	t: (key: string) => string,
	fallbackKey: string,
	actionState: SiteStudioRuntimeActionState
): string {
	if (!actionState.disabled || !actionState.reason) {
		return t(fallbackKey);
	}
	switch (actionState.reason) {
		case 'busy':
			return t('runtime.actionDisabledBusy');
		case 'pending':
			return t('runtime.actionDisabledPending');
		case 'already_running':
			return t('runtime.actionDisabledAlreadyRunning');
		case 'already_stopped':
			return t('runtime.actionDisabledAlreadyStopped');
		case 'needs_running':
			return t('runtime.actionDisabledNeedsRunning');
		default:
			return t(fallbackKey);
	}
}

export function computeSiteStudioEdgeState(
	health: SiteStudioHealth | null,
	isPublished: boolean
): { edgeLive: boolean; edgeNeedsAttention: boolean } {
	const edgeLive = Boolean(
		health?.edge?.enabled &&
			health.edge.url &&
			(health.edge.content_source === 'runtime_dist' ||
				health.edge.content_source === 'snapshot')
	);
	const edgeNeedsAttention = Boolean(
		health?.edge?.enabled &&
			isPublished &&
			(!health.edge.url ||
				health.edge.content_source === 'stub' ||
				health.edge.last_error)
	);
	return { edgeLive, edgeNeedsAttention };
}
