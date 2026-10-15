/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AMKA Builder UI: operator config pipeline stages, presets panel, and save/reset controls
 * for the Marketing Cabinet AMKA tab (feature-owned boundary).
 *
 * Invariants:
 * - Trusted-operator-only mutations remain enforced by API; this component only reflects hooks state.
 * - Stage order and icons stay aligned with server-side pipeline semantics.
 *
 * Related:
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 * - src/features/amka/AmkaPresetsPanel.tsx
 * - src/features/amka/amkaOperatorConfigNormalize.ts
 */
import type { ComponentType, SVGProps } from 'react';

import {
	AMKA_OPERATOR_CONFIG_V1_DEFAULT,
	extractApiErrorMessage,
	type AmkaOperatorConfigV1,
} from '@/services/amka/marketingCabinetAmkaBridge';
import {
	useAmkaOperatorConfig,
	usePutAmkaOperatorConfig,
} from '@/hooks/api/useAmka';
import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import {
	ArrowDownOnSquareIcon,
	ArrowPathIcon,
	CameraIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClipboardDocumentListIcon,
	FlagIcon,
	MapIcon,
	PlayCircleIcon,
	ShieldCheckIcon,
	SparklesIcon,
	SignalIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppErrorState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { normalizeAmkaOperatorConfigV1 } from './amkaOperatorConfigNormalize';
import { AmkaPresetsPanel } from './AmkaPresetsPanel';
import {
	AmkaBuilderStageForm,
	type AmkaPipelineStageId,
} from './AmkaBuilderStageForm';

function amkaOperatorConfigsEqual(
	a: AmkaOperatorConfigV1,
	b: AmkaOperatorConfigV1
): boolean {
	const na = normalizeAmkaOperatorConfigV1(a);
	const nb = normalizeAmkaOperatorConfigV1(b);
	if (na.schema_version !== nb.schema_version) return false;
	if (
		na.baseline_audit.extra_prompt_suffix !==
		nb.baseline_audit.extra_prompt_suffix
	) {
		return false;
	}
	const sa = na.section_llm_audit;
	const sb = nb.section_llm_audit;
	if (sa.enabled !== sb.enabled) return false;
	if (sa.delay_ms !== sb.delay_ms) return false;
	if (sa.parallelism !== sb.parallelism) return false;
	if (sa.require_work_needed_quotes !== sb.require_work_needed_quotes)
		return false;
	if (sa.extra_prompt_instruction !== sb.extra_prompt_instruction) return false;
	const ma = na.master_plan;
	const mb = nb.master_plan;
	if (ma.llm_enabled !== mb.llm_enabled) return false;
	if (ma.max_tokens !== mb.max_tokens) return false;
	if (ma.extra_prompt_instruction !== mb.extra_prompt_instruction) return false;
	if (ma.retry_on_parse_failure !== mb.retry_on_parse_failure) return false;
	if (ma.repair_json_on_parse_failure !== mb.repair_json_on_parse_failure)
		return false;
	if (na.execute.max_wait_seconds !== nb.execute.max_wait_seconds) return false;
	const fa = na.final_assessment;
	const fb = nb.final_assessment;
	if (fa.llm_enabled !== fb.llm_enabled) return false;
	if (fa.max_prompt_chars !== fb.max_prompt_chars) return false;
	return fa.extra_prompt_instruction === fb.extra_prompt_instruction;
}

type HeroOutlineIcon = ComponentType<SVGProps<SVGSVGElement>>;

const STAGE_ICONS: Record<AmkaPipelineStageId, HeroOutlineIcon> = {
	snapshot: CameraIcon,
	baseline: ClipboardDocumentListIcon,
	section_llm: SparklesIcon,
	master_plan: MapIcon,
	operator_gate: ShieldCheckIcon,
	execute: PlayCircleIcon,
	final: FlagIcon,
};

const STAGE_ORDER: AmkaPipelineStageId[] = [
	'snapshot',
	'baseline',
	'section_llm',
	'master_plan',
	'operator_gate',
	'execute',
	'final',
];

export function AmkaBuilderView({
	projectId,
	canEditGlobalConfig,
	onGlobalDirtyChange,
}: {
	projectId: string | null;
	canEditGlobalConfig: boolean;
	onGlobalDirtyChange?: (dirty: boolean) => void;
}) {
	const { t } = useTranslation('marketing');
	const { success, error } = useNotifications();
	const query = useAmkaOperatorConfig();
	const putMutation = usePutAmkaOperatorConfig();
	const [draft, setDraft] = useState<AmkaOperatorConfigV1>(
		normalizeAmkaOperatorConfigV1(AMKA_OPERATOR_CONFIG_V1_DEFAULT)
	);
	const initRef = useRef(false);
	const [activeStage, setActiveStage] =
		useState<AmkaPipelineStageId>('baseline');

	useEffect(() => {
		if (query.data?.stored && !initRef.current) {
			setDraft(normalizeAmkaOperatorConfigV1(query.data.stored));
			initRef.current = true;
		}
	}, [query.data]);

	const caps = query.data?.env_caps;
	const eff = query.data?.effective;
	const secEff =
		eff?.section_llm_audit && typeof eff.section_llm_audit === 'object'
			? (eff.section_llm_audit as Record<string, unknown>)
			: undefined;
	const mpEff =
		eff?.master_plan && typeof eff.master_plan === 'object'
			? (eff.master_plan as Record<string, unknown>)
			: undefined;
	const exEff =
		eff?.execute && typeof eff.execute === 'object'
			? (eff.execute as Record<string, unknown>)
			: undefined;
	const finEff =
		eff?.final_assessment && typeof eff.final_assessment === 'object'
			? (eff.final_assessment as Record<string, unknown>)
			: undefined;

	const isGlobalDirty = useMemo(() => {
		if (!canEditGlobalConfig || !query.data?.stored) return false;
		return !amkaOperatorConfigsEqual(draft, query.data.stored);
	}, [canEditGlobalConfig, draft, query.data?.stored]);

	useEffect(() => {
		onGlobalDirtyChange?.(isGlobalDirty);
	}, [isGlobalDirty, onGlobalDirtyChange]);

	useEffect(() => {
		if (!isGlobalDirty || !canEditGlobalConfig) return;
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [isGlobalDirty, canEditGlobalConfig]);

	const pipelineSteps = useMemo(() => {
		const meta: Record<
			AmkaPipelineStageId,
			{ title: string; desc: string; readOnly: boolean }
		> = {
			snapshot: {
				title: t('amkaBuilder.stage.snapshot.title'),
				desc: t('amkaBuilder.stage.snapshot.desc'),
				readOnly: true,
			},
			baseline: {
				title: t('amkaBuilder.stage.baseline.title'),
				desc: t('amkaBuilder.stage.baseline.desc'),
				readOnly: false,
			},
			section_llm: {
				title: t('amkaBuilder.stage.sectionLlm.title'),
				desc: t('amkaBuilder.stage.sectionLlm.desc'),
				readOnly: false,
			},
			master_plan: {
				title: t('amkaBuilder.stage.masterPlan.title'),
				desc: t('amkaBuilder.stage.masterPlan.desc'),
				readOnly: false,
			},
			operator_gate: {
				title: t('amkaBuilder.stage.gate.title'),
				desc: t('amkaBuilder.stage.gate.desc'),
				readOnly: true,
			},
			execute: {
				title: t('amkaBuilder.stage.execute.title'),
				desc: t('amkaBuilder.stage.execute.desc'),
				readOnly: false,
			},
			final: {
				title: t('amkaBuilder.stage.final.title'),
				desc: t('amkaBuilder.stage.final.desc'),
				readOnly: false,
			},
		};
		return STAGE_ORDER.map((id, index) => {
			const m = meta[id];
			const Icon = STAGE_ICONS[id];
			return {
				id,
				step: index + 1,
				Icon,
				title: m.title,
				desc: m.desc,
				readOnly: m.readOnly,
			};
		});
	}, [t]);

	const activeMeta = pipelineSteps.find((s) => s.id === activeStage);
	const ActiveIcon = activeMeta?.Icon ?? ClipboardDocumentListIcon;
	const activeStageIndex = STAGE_ORDER.indexOf(activeStage);
	const safeStageIndex = activeStageIndex >= 0 ? activeStageIndex : 0;
	const canPrevStage = activeStageIndex > 0;
	const canNextStage =
		activeStageIndex >= 0 && activeStageIndex < STAGE_ORDER.length - 1;

	const scrollToPipeline = () => {
		document
			.getElementById('amka-builder-pipeline')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const handleSave = () => {
		putMutation.mutate(normalizeAmkaOperatorConfigV1(draft), {
			onSuccess: (bundle) => {
				setDraft(normalizeAmkaOperatorConfigV1(bundle.stored));
				success(t('amkaBuilder.saveSuccess'));
			},
			onError: (err) => {
				error(extractApiErrorMessage(err, t('amkaBuilder.saveError')));
			},
		});
	};

	const handleReload = () => {
		if (query.data?.stored) {
			setDraft(normalizeAmkaOperatorConfigV1(query.data.stored));
		}
	};

	const ro = !canEditGlobalConfig;

	if (query.isError) {
		return (
			<DesktopAppErrorState
				message={extractApiErrorMessage(
					query.error,
					t('amkaBuilder.loadError')
				)}
				actionLabel={t('amkaBuilder.retry')}
				onAction={() => void query.refetch()}
			/>
		);
	}

	if (query.isPending && !query.data) {
		return (
			<div className="flex items-center gap-2 p-6 text-sm text-(--desktop-text-secondary)">
				<ArrowPathIcon
					className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{t('amkaBuilder.loading')}
			</div>
		);
	}

	const updatedAt = query.data?.updated_at ?? null;
	const updatedBy = query.data?.updated_by_user_id ?? null;

	const envPills = caps
		? [
				{
					key: 'delay',
					label: t('amkaBuilder.envPillDelay', {
						max: caps.audit_delay_ms_max,
					}),
				},
				{
					key: 'par',
					label: t('amkaBuilder.envPillParallel', {
						max: caps.audit_parallelism_max,
					}),
				},
				{
					key: 'wait',
					label: t('amkaBuilder.envPillWait', {
						min: caps.execute_max_wait_seconds_min,
						max: caps.execute_max_wait_seconds_max,
					}),
				},
				{
					key: 'fin',
					label: t('amkaBuilder.envPillFinal', {
						max: caps.final_prompt_chars_max,
					}),
				},
				{
					key: 'tok',
					label: t('amkaBuilder.envPillPlan', {
						max: caps.master_plan_max_tokens_max,
					}),
				},
			]
		: [];

	return (
		<div className="mx-auto max-w-5xl space-y-8">
			<p className="text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
				{t('amkaBuilder.pageContext')}
			</p>
			<div className="overflow-hidden rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) shadow-(--desktop-shadow-panel)">
				<div className="flex flex-wrap items-start gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-4 sm:px-5">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb)/0.95)]">
						<Squares2X2Icon
							className="size-5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
							{t('amkaBuilder.sectionLabelProject')}
						</p>
						<h2 className="mt-1 text-base font-semibold tracking-tight text-(--desktop-text-primary)">
							{t('amkaBuilder.visualPresetsTitle')}
						</h2>
						<p className="mt-1.5 text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
							{t('amkaBuilder.visualPresetsSubtitle')}
						</p>
					</div>
				</div>
				<div className="p-4 sm:p-5">
					<AmkaPresetsPanel projectId={projectId} embedded />
					<div className="mt-5 flex flex-wrap items-center justify-end border-t border-(--desktop-border-subtle) pt-4">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={scrollToPipeline}
						>
							{t('amkaBuilder.jumpToPipeline')}
						</DesktopAppButton>
					</div>
				</div>
			</div>

			{ro ? (
				<p
					className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty"
					role="status"
				>
					{t('amkaBuilder.readOnlyGlobalBanner')}
				</p>
			) : null}
			{updatedAt || updatedBy ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('amkaBuilder.lastSavedMeta', {
						at: updatedAt ? new Date(updatedAt).toLocaleString() : '—',
						by: updatedBy ?? '—',
					})}
				</p>
			) : null}

			<div
				id="amka-builder-pipeline"
				className="scroll-mt-4 overflow-hidden rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) shadow-(--desktop-shadow-panel)"
			>
				<div className="flex flex-col gap-4 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb)/0.95)]">
							<SignalIcon
								className="size-5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</div>
						<div className="min-w-0">
							<p className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
								{t('amkaBuilder.sectionLabelGlobal')}
							</p>
							<h2 className="mt-1 text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
								{t('amkaBuilder.visualPipelineTitle')}
							</h2>
							<p className="mt-2 max-w-prose text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
								{t('amkaBuilder.visualPipelineSubtitle')}
							</p>
						</div>
					</div>
					<div className="flex shrink-0 flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleReload}
							disabled={!query.data || putMutation.isPending || !isGlobalDirty}
						>
							{t('amkaBuilder.discard')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							className="gap-1.5"
							onClick={handleSave}
							disabled={ro || putMutation.isPending || !isGlobalDirty}
						>
							{putMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							) : (
								<ArrowDownOnSquareIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							)}
							{t('amkaBuilder.save')}
						</DesktopAppButton>
					</div>
				</div>

				{envPills.length > 0 ? (
					<div className="flex flex-col gap-2.5 border-b border-(--desktop-border-subtle) px-4 py-3 sm:px-5">
						<span className="text-xs font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.envPillsLabel')}
						</span>
						<div className="flex flex-wrap gap-2">
							{envPills.map((pill) => (
								<span
									key={pill.key}
									className="inline-flex max-w-full items-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-2.5 py-1.5 text-xs leading-snug text-(--desktop-text-secondary) wrap-break-word"
								>
									{pill.label}
								</span>
							))}
						</div>
					</div>
				) : null}

				<nav
					className="flex gap-2 overflow-x-auto px-3 py-3 sm:px-4 motion-safe:scroll-smooth"
					aria-label={t('amkaBuilder.pipelineNavAria')}
				>
					{pipelineSteps.map((s) => {
						const active = activeStage === s.id;
						const Icon = s.Icon;
						return (
							<button
								key={s.id}
								type="button"
								onClick={() => setActiveStage(s.id)}
								className={cn(
									'flex min-w-24 shrink-0 flex-col items-center gap-2 rounded-xl border px-2.5 py-3 text-center transition-colors',
									DESKTOP_CHROME_FOCUS_VISIBLE,
									active
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 text-(--desktop-text-secondary) hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)'
								)}
							>
								<span
									className={cn(
										'flex size-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
										active
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.28)] text-(--desktop-text-primary)'
											: 'bg-(--desktop-surface-panel) text-(--desktop-text-muted)'
									)}
								>
									{s.step}
								</span>
								<Icon
									className="size-4 shrink-0 opacity-90"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								<span className="line-clamp-2 min-h-8 w-full text-xs font-medium leading-snug">
									{s.title}
								</span>
								{s.readOnly ? (
									<span className="text-[10px] font-medium text-(--desktop-text-muted)">
										{t('amkaBuilder.stageBadgeInfo')}
									</span>
								) : (
									<span className="text-[10px] font-medium text-emerald-400/90">
										{t('amkaBuilder.stageBadgeTune')}
									</span>
								)}
							</button>
						);
					})}
				</nav>

				<div className="p-4 pt-0 sm:p-5 sm:pt-0">
					<div className="rounded-xl border border-(--desktop-border-subtle) border-l-4 border-l-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-soft)/25 p-4 sm:p-5">
						<div className="mb-4 flex w-full items-start gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="size-9 shrink-0 self-center p-0"
								onClick={() => {
									if (!canPrevStage) return;
									const prev = STAGE_ORDER.at(activeStageIndex - 1);
									if (prev) setActiveStage(prev);
								}}
								disabled={!canPrevStage}
								aria-label={t('amkaBuilder.stageStepPrevAria')}
							>
								<ChevronLeftIcon
									className="size-5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<div className="flex min-w-0 flex-1 items-start gap-3">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb)/0.95)]">
									<ActiveIcon
										className="size-5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="text-base font-semibold text-(--desktop-text-primary)">
										{activeMeta?.title}
									</h3>
									<p className="mt-2 text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
										{activeMeta?.desc}
									</p>
									<p className="mt-2 text-xs text-(--desktop-text-muted)">
										{t('amkaBuilder.stagePosition', {
											current: safeStageIndex + 1,
											total: STAGE_ORDER.length,
										})}
									</p>
								</div>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="size-9 shrink-0 self-center p-0"
								onClick={() => {
									if (!canNextStage) return;
									const next = STAGE_ORDER.at(activeStageIndex + 1);
									if (next) setActiveStage(next);
								}}
								disabled={!canNextStage}
								aria-label={t('amkaBuilder.stageStepNextAria')}
							>
								<ChevronRightIcon
									className="size-5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
						</div>
						<AmkaBuilderStageForm
							stageId={activeStage}
							draft={draft}
							setDraft={setDraft}
							ro={ro}
							caps={caps}
							secEff={secEff}
							mpEff={mpEff}
							exEff={exEff}
							finEff={finEff}
							t={t}
						/>
					</div>
				</div>
			</div>

			{eff ? (
				<details className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-4 py-3">
					<summary className="cursor-pointer text-sm font-medium text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden">
						{t('amkaBuilder.effectivePreview')}
					</summary>
					<pre className="mt-3 max-h-48 overflow-auto wrap-break-word rounded-lg bg-(--desktop-surface-elevated) p-3 font-mono text-xs leading-snug text-(--desktop-text-muted)">
						{JSON.stringify(eff, null, 2)}
					</pre>
				</details>
			) : null}

			<p className="max-w-prose text-sm leading-relaxed text-(--desktop-text-muted) wrap-pretty">
				{t('amkaBuilder.saveHint')}
			</p>
		</div>
	);
}
