/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Курсорина — full-featured Desktop investigation workspace:
 * - Left rail: past investigations history, search filter, status badges, deletion.
 * - Center: analytical report (Markdown + tables), sources & evidence explorer, goal inspector.
 * - Composer: preset templates, capability badges, keyboard shortcuts (Ctrl+Enter).
 *
 * Invariants:
 * - Backend owns the investigation loop (Celery); UI never drives ticks or tools.
 * - Does not embed Desktop AI Chat / Experts / EWA agentic.
 * - Product enablement SoT: shared/apps/kursorina/app.manifest.yaml
 *
 * Related:
 * - documentation/product/desktop/KURSORINA.md
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/*
 */

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactElement,
} from 'react';
import {
	Bars3Icon,
	ChevronLeftIcon,
	PlusIcon,
	SparklesIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { api, isRequestAborted } from '@/services/api/client';
import { cn } from '@/utils/cn';
import { KursorinaComposer } from './kursorina/KursorinaComposer';
import { KursorinaFindingsView } from './kursorina/KursorinaFindingsView';
import { KursorinaGoalView } from './kursorina/KursorinaGoalView';
import { KursorinaReportView } from './kursorina/KursorinaReportView';
import { KursorinaSidebar } from './kursorina/KursorinaSidebar';
import {
	extractTopicFromGoal,
	mergeServerMissions,
	preferFresher,
	statusLabel,
} from './kursorina/kursorinaUtils';
import type {
	KursorinaTab,
	MissionPublicView,
	MissionResultItem,
	MissionStatus,
} from './kursorina/types';

const ACTIVE: ReadonlySet<MissionStatus> = new Set(['queued', 'running']);
const TERMINAL: ReadonlySet<MissionStatus> = new Set([
	'completed',
	'blocked',
	'cancelled',
]);

const POLL_HEADERS = {
	'Cache-Control': 'no-cache, no-store',
	Pragma: 'no-cache',
} as const;

function asMissionView(raw: unknown): MissionPublicView | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const status = o.status;
	if (
		status !== 'queued' &&
		status !== 'running' &&
		status !== 'completed' &&
		status !== 'blocked' &&
		status !== 'cancelled'
	) {
		return null;
	}
	const id = typeof o.id === 'string' ? o.id : '';
	if (!id) return null;
	const results = Array.isArray(o.results) ? o.results : [];
	return {
		id,
		goal: typeof o.goal === 'string' ? o.goal : '',
		status,
		progress: typeof o.progress === 'string' ? o.progress : '',
		results: results as MissionResultItem[],
		answer: typeof o.answer === 'string' ? o.answer : null,
		block_reason: typeof o.block_reason === 'string' ? o.block_reason : null,
		created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
		updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
	};
}

export function KursorinaApp(): ReactElement {
	const [missions, setMissions] = useState<MissionPublicView[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isComposing, setIsComposing] = useState(false);
	const [composerInitialGoal, setComposerInitialGoal] = useState('');
	const [activeTab, setActiveTab] = useState<KursorinaTab>('report');
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [busy, setBusy] = useState(false);
	const [loadingList, setLoadingList] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const pollIdRef = useRef<string | null>(null);
	const selectedIdRef = useRef<string | null>(selectedId);
	const isComposingRef = useRef(isComposing);
	const listFetchGenRef = useRef(0);
	const listAbortRef = useRef<AbortController | null>(null);

	selectedIdRef.current = selectedId;
	isComposingRef.current = isComposing;

	// Fetch mission list — stable callback (refs), abort stale responses, merge by id.
	const fetchMissionsList = useCallback(async (): Promise<void> => {
		listAbortRef.current?.abort();
		const ac = new AbortController();
		listAbortRef.current = ac;
		const gen = ++listFetchGenRef.current;
		setLoadingList(true);
		try {
			const raw = await api.get<unknown>(
				'/api/v1/kursorina/missions?limit=30',
				{ signal: ac.signal }
			);
			if (gen !== listFetchGenRef.current) return;
			const list = Array.isArray(raw) ? raw : [];
			const parsed = list
				.map(asMissionView)
				.filter((m): m is MissionPublicView => m !== null);
			let merged: MissionPublicView[] = parsed;
			setMissions((prev) => {
				merged = mergeServerMissions(parsed, prev);
				return merged;
			});
			const sel = selectedIdRef.current;
			const composing = isComposingRef.current;
			if (merged.length > 0 && !sel && !composing) {
				setSelectedId(merged[0].id);
			} else if (merged.length === 0 && !sel) {
				// Empty history only opens composer when nothing is selected
				// (never wipe a just-created selection on a stale empty list).
				setIsComposing(true);
			}
		} catch (err) {
			if (
				ac.signal.aborted ||
				isRequestAborted(err) ||
				gen !== listFetchGenRef.current
			) {
				return;
			}
			setError(
				err instanceof Error
					? err.message
					: 'Не удалось загрузить историю расследований'
			);
		} finally {
			if (gen === listFetchGenRef.current) {
				setLoadingList(false);
			}
		}
	}, []);

	// Initial load once (manual refresh via sidebar still calls fetchMissionsList).
	useEffect(() => {
		void fetchMissionsList();
		return () => {
			listAbortRef.current?.abort();
			listFetchGenRef.current += 1;
		};
	}, [fetchMissionsList]);

	// Active mission lookup
	const activeMission = missions.find((m) => m.id === selectedId) || null;

	// Polling effect for active mission
	useEffect(() => {
		const id = activeMission?.id;
		const status = activeMission?.status;
		if (!id || !status || !ACTIVE.has(status)) {
			pollIdRef.current = null;
			return;
		}
		pollIdRef.current = id;
		let cancelled = false;

		const tick = (): void => {
			if (cancelled || pollIdRef.current !== id) return;
			void api
				.get<unknown>(`/api/v1/kursorina/missions/${id}?_=${Date.now()}`, {
					headers: { ...POLL_HEADERS },
				})
				.then((raw) => {
					if (cancelled || pollIdRef.current !== id) return;
					const view = asMissionView(raw);
					if (!view) return;
					if (TERMINAL.has(view.status)) {
						pollIdRef.current = null;
					}
					setMissions((prev) =>
						prev.map((item) =>
							item.id === id ? preferFresher(item, view) : item
						)
					);
				})
				.catch((err: unknown) => {
					if (cancelled || pollIdRef.current !== id) return;
					setError(
						err instanceof Error
							? err.message
							: 'Не удалось обновить статус задачи'
					);
				});
		};

		tick();
		const timer = window.setInterval(tick, 1500);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [activeMission?.id, activeMission?.status]);

	// Create mission handler
	const handleCreateMission = async (goalText: string): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			const raw = await api.post<unknown>('/api/v1/kursorina/missions', {
				goal: goalText,
			});
			const view = asMissionView(raw);
			if (!view) {
				throw new Error('Некорректный ответ при создании задачи');
			}
			setMissions((prev) => [view, ...prev.filter((m) => m.id !== view.id)]);
			setSelectedId(view.id);
			setIsComposing(false);
			setActiveTab('report');
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Не удалось запустить расследование'
			);
		} finally {
			setBusy(false);
		}
	};

	// Cancel mission handler
	const handleCancelMission = async (): Promise<void> => {
		if (!activeMission || !ACTIVE.has(activeMission.status)) return;
		setError(null);
		try {
			const raw = await api.post<unknown>(
				`/api/v1/kursorina/missions/${activeMission.id}/cancel`,
				{}
			);
			const view = asMissionView(raw);
			if (view) {
				setMissions((prev) =>
					prev.map((item) =>
						item.id === view.id ? preferFresher(item, view) : item
					)
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Не удалось отменить задачу'
			);
		}
	};

	// Delete mission handler
	const handleDeleteMission = async (id: string): Promise<void> => {
		try {
			await api.delete(`/api/v1/kursorina/missions/${id}`);
			setMissions((prev) => prev.filter((m) => m.id !== id));
			if (selectedId === id) {
				const remaining = missions.filter((m) => m.id !== id);
				if (remaining.length > 0) {
					setSelectedId(remaining[0].id);
				} else {
					setSelectedId(null);
					setIsComposing(true);
				}
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Не удалось удалить задачу'
			);
		}
	};

	// Select mission from sidebar
	const handleSelectMission = (id: string): void => {
		setSelectedId(id);
		setIsComposing(false);
		setActiveTab('report');
		setError(null);
	};

	// New investigation button
	const handleNewInvestigation = (): void => {
		setComposerInitialGoal('');
		setIsComposing(true);
		setError(null);
	};

	// Clone goal into composer
	const handleCloneGoal = (goalText: string): void => {
		setComposerInitialGoal(goalText);
		setIsComposing(true);
		setError(null);
	};

	// Retry blocked mission
	const handleRetry = (): void => {
		if (!activeMission) return;
		handleCloneGoal(activeMission.goal);
	};

	const currentTopic = activeMission
		? extractTopicFromGoal(activeMission.goal, 50)
		: 'Новое расследование';

	const activeStatus = activeMission?.status;
	const isMissionActive = activeStatus && ACTIVE.has(activeStatus);

	return (
		<DesktopAppContentWrapper appComponent="KursorinaApp">
			<DesktopAppSurface className="flex h-full min-h-0 w-full flex-row overflow-hidden bg-(--desktop-surface-panel)">
				{/* Left Sidebar */}
				{sidebarOpen ? (
					<KursorinaSidebar
						missions={missions}
						selectedId={selectedId}
						isComposing={isComposing}
						loading={loadingList}
						onSelectMission={handleSelectMission}
						onNewMission={handleNewInvestigation}
						onDeleteMission={(id) => void handleDeleteMission(id)}
						onRefresh={() => void fetchMissionsList()}
					/>
				) : null}

				{/* Main Content Area */}
				<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{/* Top Navigation & Status Bar */}
					<header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_40%,transparent)] px-4 backdrop-blur-sm">
						<div className="flex min-w-0 items-center gap-3 overflow-hidden">
							<button
								type="button"
								onClick={() => setSidebarOpen((prev) => !prev)}
								className="shrink-0 rounded-(--desktop-radius) p-1.5 text-(--desktop-text-muted) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)"
								title={sidebarOpen ? 'Скрыть историю' : 'Показать историю'}
								aria-label={sidebarOpen ? 'Скрыть историю' : 'Показать историю'}
							>
								{sidebarOpen ? (
									<ChevronLeftIcon className="size-5" />
								) : (
									<Bars3Icon className="size-5" />
								)}
							</button>

							<div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
								<div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-[rgb(var(--desktop-accent-rgb))]/15 text-[rgb(var(--desktop-accent-rgb))]">
									<SparklesIcon className="size-4" />
								</div>
								<div className="flex min-w-0 flex-col overflow-hidden">
									<span className="truncate text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
										{isComposing ? 'Новое расследование' : currentTopic}
									</span>
									<span className="truncate text-[11px] text-(--desktop-text-dim)">
										Курсорина · автономный исследователь
									</span>
								</div>
							</div>
						</div>

						{/* Center / Right: Tabs or Status Badge */}
						<div className="flex items-center gap-2.5">
							{!isComposing && activeMission ? (
								<>
									{/* Navigation Tabs */}
									<div className="hidden items-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-0.5 sm:flex">
										<button
											type="button"
											onClick={() => setActiveTab('report')}
											className={cn(
												'rounded-(--desktop-radius) px-3 py-1.5 text-xs font-medium transition-colors',
												activeTab === 'report'
													? 'bg-[rgb(var(--desktop-accent-rgb))]/18 text-[rgb(var(--desktop-accent-rgb))] shadow-sm'
													: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
											)}
										>
											Отчет
										</button>
										<button
											type="button"
											onClick={() => setActiveTab('findings')}
											className={cn(
												'rounded-(--desktop-radius) px-3 py-1.5 text-xs font-medium transition-colors',
												activeTab === 'findings'
													? 'bg-[rgb(var(--desktop-accent-rgb))]/18 text-[rgb(var(--desktop-accent-rgb))] shadow-sm'
													: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
											)}
										>
											Источники ({activeMission.results?.length ?? 0})
										</button>
										<button
											type="button"
											onClick={() => setActiveTab('goal')}
											className={cn(
												'rounded-(--desktop-radius) px-3 py-1.5 text-xs font-medium transition-colors',
												activeTab === 'goal'
													? 'bg-[rgb(var(--desktop-accent-rgb))]/18 text-[rgb(var(--desktop-accent-rgb))] shadow-sm'
													: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
											)}
										>
											Цель
										</button>
									</div>

									{/* Status Badge */}
									<span
										className={cn(
											'rounded-full px-2.5 py-0.5 text-xs font-medium border',
											activeMission.status === 'completed' &&
												'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
											activeMission.status === 'running' &&
												'border-sky-500/30 bg-sky-500/15 text-sky-300 motion-safe:animate-pulse',
											activeMission.status === 'queued' &&
												'border-amber-500/30 bg-amber-500/15 text-amber-300',
											activeMission.status === 'blocked' &&
												'border-rose-500/30 bg-rose-500/15 text-rose-300',
											activeMission.status === 'cancelled' &&
												'border-zinc-500/30 bg-zinc-500/15 text-zinc-400'
										)}
									>
										{statusLabel(activeMission.status)}
									</span>

									{/* Cancel Button if running */}
									{isMissionActive ? (
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											onClick={() => void handleCancelMission()}
											className="gap-1 text-xs text-rose-300 hover:text-rose-200"
										>
											<StopIcon className="h-3.5 w-3.5" />
											<span>Отмена</span>
										</DesktopAppButton>
									) : null}
								</>
							) : null}

							{/* New Task Button in Header when sidebar collapsed */}
							{!sidebarOpen ? (
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={handleNewInvestigation}
									className="gap-1 text-xs"
								>
									<PlusIcon className="h-3.5 w-3.5" />
									<span>Новая цель</span>
								</DesktopAppButton>
							) : null}
						</div>
					</header>

					{/* Mobile/Compact Tabs Strip */}
					{!isComposing && activeMission ? (
						<div className="flex sm:hidden border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-3 py-1.5 gap-2">
							<button
								type="button"
								onClick={() => setActiveTab('report')}
								className={cn(
									'rounded px-2 py-1 text-xs font-medium transition-colors',
									activeTab === 'report'
										? 'bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
										: 'text-(--desktop-text-muted)'
								)}
							>
								Отчет
							</button>
							<button
								type="button"
								onClick={() => setActiveTab('findings')}
								className={cn(
									'rounded px-2 py-1 text-xs font-medium transition-colors',
									activeTab === 'findings'
										? 'bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
										: 'text-(--desktop-text-muted)'
								)}
							>
								Источники ({activeMission.results?.length ?? 0})
							</button>
							<button
								type="button"
								onClick={() => setActiveTab('goal')}
								className={cn(
									'rounded px-2 py-1 text-xs font-medium transition-colors',
									activeTab === 'goal'
										? 'bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
										: 'text-(--desktop-text-muted)'
								)}
							>
								Цель
							</button>
						</div>
					) : null}

					{/* Error Alert */}
					{error ? (
						<div
							className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300 flex items-center justify-between"
							role="alert"
						>
							<span>{error}</span>
							<button
								type="button"
								onClick={() => setError(null)}
								className="text-rose-400 hover:text-rose-200"
							>
								✕
							</button>
						</div>
					) : null}

					{/* Workspace Body */}
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						{isComposing || !activeMission ? (
							<KursorinaComposer
								initialGoal={composerInitialGoal}
								busy={busy}
								onSubmit={handleCreateMission}
							/>
						) : activeTab === 'report' ? (
							<KursorinaReportView
								mission={activeMission}
								onCancel={handleCancelMission}
								onRetry={handleRetry}
							/>
						) : activeTab === 'findings' ? (
							<KursorinaFindingsView results={activeMission.results} />
						) : (
							<KursorinaGoalView
								mission={activeMission}
								onCloneGoal={handleCloneGoal}
							/>
						)}
					</div>
				</main>
			</DesktopAppSurface>
		</DesktopAppContentWrapper>
	);
}

export default KursorinaApp;
