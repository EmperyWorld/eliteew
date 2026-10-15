/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub phase: module cards, progress, retake requests, and full-results CTA.
 *
 * Invariants:
 * - Module unlock/retake gating stays aligned with diagnosticProgress helpers.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { ModuleCompletionPreview } from '../CustomerDiagnosticHubPreview';
import {
	DIAGNOSTIC_MODULE_ORDER,
	MODULE_DESCRIPTIONS,
	MODULE_ICONS,
	MODULE_LABELS,
} from '../diagnosticDefinition';
import {
	computeDiagnosticProgressPercent,
	getBlockingPreviousModule,
	getModuleAnswerProgress,
	isModuleUnlocked,
} from '../diagnosticProgress';
import type {
	CustomerDiagnosticSessionState,
	DiagnosticModuleId,
} from '../diagnosticTypes';

export function HubPanel({
	draft,
	moduleRetakeStatus,
	onOpenModule,
	onRequestRetake,
	retakePending,
	onViewFullResults,
}: {
	draft: CustomerDiagnosticSessionState;
	moduleRetakeStatus: Record<string, string>;
	onOpenModule: (id: DiagnosticModuleId) => void;
	onRequestRetake: (id: DiagnosticModuleId) => void;
	retakePending: boolean;
	onViewFullResults: () => void;
}) {
	const { t } = useTranslation('customerCabinet');
	const completed = new Set(draft.completedModules);
	const progress = computeDiagnosticProgressPercent(draft);
	const allDone = DIAGNOSTIC_MODULE_ORDER.every((id) => completed.has(id));

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<DesktopAppSectionLabel>
						{t('diagnostic.hubTitle')}
					</DesktopAppSectionLabel>
					<p className="mt-1 text-xs text-(--desktop-text-secondary)">
						{t('diagnostic.hubHint')}
					</p>
				</div>
				<div className="flex min-w-[140px] flex-col gap-1">
					<span className="text-right text-xs font-semibold tabular-nums text-(--desktop-text-primary)">
						{t('diagnostic.progressLabel', { percent: progress })}
					</span>
					<div className="h-2 overflow-hidden rounded-full bg-white/10">
						<div
							className="h-full rounded-full bg-[linear-gradient(90deg,#14b8a6,#a855f7)] transition-[width] duration-500"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</div>
			{allDone ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
					<p className="text-sm text-(--desktop-text-primary)">
						{t('diagnostic.hubAllDoneHint')}
					</p>
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={onViewFullResults}
					>
						{t('diagnostic.viewFullResults')}
					</DesktopAppButton>
				</div>
			) : null}
			<div className="grid gap-3 sm:grid-cols-2">
				{DIAGNOSTIC_MODULE_ORDER.map((id) => {
					const done = completed.has(id);
					const unlocked = isModuleUnlocked(id, draft);
					const rs = moduleRetakeStatus[id] ?? 'none';
					const retakeApproved = rs === 'approved';
					const doneBlocked = done && !retakeApproved;
					const blocker = getBlockingPreviousModule(id, draft);
					const { answered, total, percent } = getModuleAnswerProgress(
						id,
						draft
					);
					const started = answered > 0 && !done;
					const locked = !unlocked || doneBlocked;
					const stripeClass = locked
						? 'bg-white/25'
						: done
							? 'bg-emerald-400'
							: started
								? 'bg-orange-400'
								: 'bg-[linear-gradient(90deg,#fb923c,#a855f7)]';
					const statusLabel = !unlocked
						? t('diagnostic.statusLocked')
						: doneBlocked && rs === 'pending'
							? t('diagnostic.retakePending')
							: doneBlocked && rs === 'rejected'
								? t('diagnostic.retakeRejected')
								: done
									? t('diagnostic.statusCompleted')
									: started
										? t('diagnostic.statusInProgress')
										: t('diagnostic.statusPending');
					const statusDot = locked
						? 'bg-slate-400'
						: done
							? 'bg-emerald-400'
							: started
								? 'bg-orange-400'
								: 'bg-white/30';

					return (
						<div key={id} className="flex flex-col gap-2">
							<button
								type="button"
								disabled={locked}
								aria-label={
									locked && blocker
										? t('diagnostic.moduleLockedAria', {
												module: MODULE_LABELS[blocker],
											})
										: MODULE_LABELS[id]
								}
								onClick={() => onOpenModule(id)}
								className={cn(
									'group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/6 p-4 text-left',
									'backdrop-blur-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400/80',
									locked
										? 'cursor-not-allowed opacity-60'
										: 'transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)]'
								)}
							>
								<div
									className={cn('absolute inset-x-0 top-0 h-1.5', stripeClass)}
								/>
								<div className="mt-2 flex gap-3">
									<div
										className={cn(
											'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl',
											'bg-[linear-gradient(145deg,rgba(20,184,166,0.35),rgba(168,85,247,0.25))]',
											!locked &&
												'transition duration-300 group-hover:scale-105 group-hover:shadow-md'
										)}
									>
										{MODULE_ICONS[id]}
									</div>
									<div className="min-w-0 flex-1">
										<h3 className="text-sm font-bold text-(--desktop-text-primary)">
											{MODULE_LABELS[id]}
										</h3>
										<p className="text-[0.7rem] font-medium text-(--desktop-text-secondary)">
											{t(`diagnostic.moduleSubtitle.${id}`)}
										</p>
									</div>
								</div>
								<p className="mt-3 line-clamp-3 text-xs leading-relaxed text-(--desktop-text-secondary)">
									{MODULE_DESCRIPTIONS[id]}
								</p>
								{locked && blocker ? (
									<p className="mt-2 rounded-lg bg-black/20 px-2 py-1.5 text-[0.65rem] leading-snug text-(--desktop-text-secondary)">
										{t('diagnostic.moduleLockedHint', {
											module: MODULE_LABELS[blocker],
										})}
									</p>
								) : null}
								{done ? (
									<ModuleCompletionPreview
										moduleId={id}
										answers={draft.answers}
										t={t}
									/>
								) : null}
								<div className="mt-3 space-y-1.5">
									<div className="h-1.5 overflow-hidden rounded-full bg-white/10">
										<div
											className="h-full rounded-full bg-[linear-gradient(90deg,#2dd4bf,#818cf8)] transition-[width] duration-500"
											style={{ width: `${percent}%` }}
										/>
									</div>
									<div className="flex items-center justify-between gap-2 text-[0.65rem] text-(--desktop-text-secondary)">
										<span className="tabular-nums">
											{t('diagnostic.questionsProgress', { answered, total })}
										</span>
										<span
											className={cn(
												'flex items-center gap-1 font-semibold text-(--desktop-text-primary)'
											)}
										>
											<span
												className={cn('h-1.5 w-1.5 rounded-full', statusDot)}
											/>
											{statusLabel}
										</span>
									</div>
								</div>
							</button>
							{done && doneBlocked && (rs === 'none' || rs === 'rejected') ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									disabled={retakePending}
									onClick={() => onRequestRetake(id)}
									className="w-full text-xs"
								>
									{t('diagnostic.requestRetake')}
								</DesktopAppButton>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}
