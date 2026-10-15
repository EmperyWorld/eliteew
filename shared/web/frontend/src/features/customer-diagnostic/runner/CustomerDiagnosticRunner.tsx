/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose hook/UI for customer diagnostic runner: session hydrate, autosave PATCH,
 * retake requests, and phase routing (welcome / hub / module / complete).
 *
 * Invariants:
 * - Public props remain { projectId, className? }; scoring behavior unchanged.
 * - Debounced autosave and retake gating stay identical to pre-atomization path.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx (stable facade)
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	marketingCabinetApi,
	type CustomerDiagnosticSession,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import {
	marketingCabinetCustomerDiagnosticSessionQueryKey,
	marketingCabinetCustomerDiagnosticSessionQueryOptions,
} from '@/pages/MarketingCabinet/marketingCabinetClientInteractionQueryOptions';
import { cn } from '@/utils/cn';

import { computeAllResults } from '../diagnosticScoring';
import type {
	CustomerDiagnosticSessionState,
	DiagnosticModuleId,
} from '../diagnosticTypes';
import {
	defaultCustomerDiagnosticState,
	normalizeSessionState,
} from '../diagnosticTypes';
import { buildDiagnosticSessionSaveParts } from '../diagnosticSessionAutosave';
import {
	applyDiagnosticLoadHints,
	reconcileCompletedModules,
} from '../diagnosticSessionLoadHints';
import { isModuleUnlocked } from '../diagnosticProgress';
import { HubPanel } from './HubPanel';
import { ModuleRunner } from './ModuleRunner';
import { ResultsPanel } from './ResultsPanel';
import { WelcomePanel } from './WelcomePanel';
import type { CustomerDiagnosticRunnerProps } from './runnerTypes';

export type { CustomerDiagnosticRunnerProps } from './runnerTypes';

export function CustomerDiagnosticRunner({
	projectId,
	className,
}: CustomerDiagnosticRunnerProps) {
	const { t } = useTranslation('customerCabinet');
	const qc = useQueryClient();
	const [draft, setDraft] = React.useState<CustomerDiagnosticSessionState>(() =>
		defaultCustomerDiagnosticState()
	);
	const [hydrated, setHydrated] = React.useState(false);
	const draftRef = React.useRef(draft);
	draftRef.current = draft;
	const prevCompletedRef = React.useRef<Set<string>>(new Set());
	const lastSaveSigRef = React.useRef<string | null>(null);

	const sessionQuery = useQuery({
		...marketingCabinetCustomerDiagnosticSessionQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	const lastHydratedSnapshotRef = React.useRef<string>('');
	React.useEffect(() => {
		const s = sessionQuery.data;
		if (!s) return;
		const snapshotKey = `${s.id}:${s.updated_at}`;
		if (lastHydratedSnapshotRef.current === snapshotKey) return;
		lastHydratedSnapshotRef.current = snapshotKey;
		const norm = applyDiagnosticLoadHints(normalizeSessionState(s.state), s);
		prevCompletedRef.current = new Set(reconcileCompletedModules(norm));
		lastSaveSigRef.current = buildDiagnosticSessionSaveParts(
			norm,
			prevCompletedRef.current
		).signature;
		setDraft(norm);
		setHydrated(true);
	}, [sessionQuery.data]);

	const lastResetProjectIdRef = React.useRef(projectId);
	// Сброс черновика только при смене проекта, не при каждом входе на вкладку «Диагностика».
	React.useEffect(() => {
		if (lastResetProjectIdRef.current === projectId) {
			return;
		}
		lastResetProjectIdRef.current = projectId;
		lastHydratedSnapshotRef.current = '';
		lastSaveSigRef.current = null;
		setHydrated(false);
		prevCompletedRef.current = new Set();
		setDraft(defaultCustomerDiagnosticState());
	}, [projectId]);

	const patchMutation = useMutation({
		mutationFn: (body: {
			state: Record<string, unknown>;
			progress_percent: number;
			computed_results?: Record<string, unknown> | null;
			mark_completed?: boolean;
			completed_module_metrics?: Record<string, Record<string, unknown>> | null;
		}) => marketingCabinetApi.patchCustomerDiagnosticSession(projectId, body),
		onSuccess: (data: CustomerDiagnosticSession) => {
			qc.setQueryData(
				marketingCabinetCustomerDiagnosticSessionQueryKey(projectId),
				data
			);
			const norm = normalizeSessionState(data.state);
			prevCompletedRef.current = new Set(norm.completedModules);
		},
	});

	const retakeRequestMutation = useMutation({
		mutationFn: (moduleKey: DiagnosticModuleId) =>
			marketingCabinetApi.postCustomerDiagnosticRetakeRequest(projectId, {
				module_key: moduleKey,
			}),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetCustomerDiagnosticSessionQueryKey(projectId),
			});
		},
	});

	const saveSeq = React.useRef(0);
	const { mutate: saveSession } = patchMutation;
	// `draft` must retrigger scheduling; timeout only reads `draftRef`, so the linter treats `draft` as redundant.
	// biome-ignore lint/correctness/useExhaustiveDependencies: debounced PATCH must run when answers/progress change
	React.useEffect(() => {
		if (!hydrated || !sessionQuery.isSuccess) return;
		const seq = ++saveSeq.current;
		const t = window.setTimeout(() => {
			if (seq !== saveSeq.current) return;
			const parts = buildDiagnosticSessionSaveParts(
				draftRef.current,
				prevCompletedRef.current
			);
			if (parts.signature === lastSaveSigRef.current) {
				return;
			}
			saveSession(
				{
					state: { ...parts.payloadState } as unknown as Record<
						string,
						unknown
					>,
					progress_percent: parts.progress_percent,
					computed_results: parts.computed_results,
					mark_completed: parts.mark_completed,
					completed_module_metrics: parts.completed_module_metrics,
				},
				{
					onSuccess: () => {
						lastSaveSigRef.current = parts.signature;
					},
				}
			);
		}, 450);
		return () => window.clearTimeout(t);
	}, [draft, hydrated, sessionQuery.isSuccess, saveSession]);

	const updateDraft = React.useCallback(
		(
			updater: (
				prev: CustomerDiagnosticSessionState
			) => CustomerDiagnosticSessionState
		) => {
			setDraft((prev) => {
				const next = updater(prev);
				return { ...next, completedModules: reconcileCompletedModules(next) };
			});
		},
		[]
	);

	const startHub = (): void => {
		updateDraft((p) => ({
			...p,
			uiPhase: 'hub',
			activeModuleId: null,
			step: 0,
		}));
	};

	const moduleRetakeStatus = sessionQuery.data?.module_retake_status ?? {};

	const openModule = (id: DiagnosticModuleId): void => {
		updateDraft((p) => {
			if (!isModuleUnlocked(id, p)) return p;
			const done = p.completedModules.includes(id);
			const rs = moduleRetakeStatus[id] ?? 'none';
			if (done && rs !== 'approved') return p;
			if (done && rs === 'approved') {
				const nextAnswers = { ...p.answers };
				delete nextAnswers[id];
				return {
					...p,
					answers: nextAnswers,
					completedModules: p.completedModules.filter((m) => m !== id),
					uiPhase: 'module',
					activeModuleId: id,
					step: 0,
				};
			}
			return {
				...p,
				uiPhase: 'module',
				activeModuleId: id,
				step: 0,
			};
		});
	};

	const lockedActiveModule =
		draft.uiPhase === 'module' &&
		draft.activeModuleId !== null &&
		!isModuleUnlocked(draft.activeModuleId, draft);

	React.useLayoutEffect(() => {
		if (!lockedActiveModule) return;
		updateDraft((p) => ({
			...p,
			uiPhase: 'hub',
			activeModuleId: null,
			step: 0,
		}));
	}, [lockedActiveModule, updateDraft]);

	const backToHub = (): void => {
		updateDraft((p) => ({
			...p,
			uiPhase: 'hub',
			activeModuleId: null,
			step: 0,
		}));
	};

	const sessionLoading = sessionQuery.isLoading;
	const sessionError = sessionQuery.isError;

	if (sessionLoading) {
		return (
			<div
				className={cn('p-4 text-sm text-(--desktop-text-secondary)', className)}
			>
				{t('diagnostic.loading')}
			</div>
		);
	}

	if (sessionError) {
		return (
			<div className={cn('p-4 text-sm text-red-300', className)}>
				{t('diagnostic.loadError')}
			</div>
		);
	}

	return (
		<div
			className={cn(
				'relative isolate flex min-h-0 flex-col gap-4 overflow-hidden rounded-2xl border border-(--desktop-border-subtle) p-4',
				'bg-[linear-gradient(145deg,color-mix(in_srgb,teal_18%,var(--desktop-surface-muted))_0%,var(--desktop-surface-elevated)_42%,color-mix(in_srgb,violet_14%,var(--desktop-surface-muted))_100%)]',
				'[box-shadow:0_12px_40px_-12px_rgba(0,0,0,0.35)]',
				className
			)}
		>
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.07]"
				style={{
					background:
						'radial-gradient(ellipse 80% 50% at 20% 0%, teal, transparent 55%), radial-gradient(ellipse 70% 45% at 90% 10%, violet, transparent 50%)',
				}}
				aria-hidden
			/>
			<div className="relative z-1 flex min-h-0 flex-col gap-4">
				{draft.uiPhase === 'welcome' ? (
					<WelcomePanel onStart={startHub} />
				) : null}

				{draft.uiPhase === 'hub' ? (
					<HubPanel
						draft={draft}
						moduleRetakeStatus={moduleRetakeStatus}
						onOpenModule={openModule}
						onRequestRetake={(mid) => retakeRequestMutation.mutate(mid)}
						retakePending={retakeRequestMutation.isPending}
						onViewFullResults={() =>
							updateDraft((p) => ({
								...p,
								uiPhase: 'complete',
								activeModuleId: null,
							}))
						}
					/>
				) : null}

				{draft.uiPhase === 'module' && draft.activeModuleId ? (
					<ModuleRunner
						moduleId={draft.activeModuleId}
						draft={draft}
						updateDraft={updateDraft}
						onBack={backToHub}
						t={t}
					/>
				) : null}

				{draft.uiPhase === 'complete' ? (
					<ResultsPanel
						results={
							(sessionQuery.data?.computed_results as ReturnType<
								typeof computeAllResults
							> | null) ?? computeAllResults(draft.answers)
						}
						onBackHub={() =>
							updateDraft((p) => ({
								...p,
								uiPhase: 'hub',
								activeModuleId: null,
							}))
						}
						t={t}
					/>
				) : null}

				{patchMutation.isError ? (
					<p className="text-xs text-amber-200/90">
						{t('diagnostic.saveError')}
					</p>
				) : null}
			</div>
		</div>
	);
}
