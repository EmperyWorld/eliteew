/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Active-module shell: step chrome, navigation, and per-module step components.
 *
 * Invariants:
 * - Completion transitions to hub or complete when all modules are done.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import {
	DIAGNOSTIC_MODULE_ORDER,
	MODULE_ICONS,
	MODULE_LABELS,
	QUESTIONS,
} from '../diagnosticDefinition';
import type {
	CustomerDiagnosticSessionState,
	DiagnosticModuleId,
} from '../diagnosticTypes';
import { ArchetypeStep } from './ArchetypeStep';
import { BusinessStep } from './BusinessStep';
import { EmotionsStep } from './EmotionsStep';
import { moduleMaxSteps } from './moduleMaxSteps';
import { ServiceStep } from './ServiceStep';
import { ValuesStep } from './ValuesStep';
import type {
	CustomerDiagnosticDraftUpdater,
	DiagnosticTranslate,
} from './runnerTypes';

export type ModuleRunnerProps = {
	moduleId: DiagnosticModuleId;
	draft: CustomerDiagnosticSessionState;
	updateDraft: CustomerDiagnosticDraftUpdater;
	onBack: () => void;
	t: DiagnosticTranslate;
};

export function ModuleRunner({
	moduleId,
	draft,
	updateDraft,
	onBack,
	t,
}: ModuleRunnerProps) {
	const step = draft.step;
	const maxSteps = moduleMaxSteps(moduleId, draft);
	const stepProgressPct =
		maxSteps > 0 ? Math.min(100, Math.round(((step + 1) / maxSteps) * 100)) : 0;

	const goNext = (): void => {
		updateDraft((p) => {
			const active = p.activeModuleId;
			if (!active) return p;
			if (active === 'emotions' && p.step === 0) {
				const em = p.answers.emotions;
				const tp =
					em && typeof em === 'object' && Array.isArray(em.selectedTouchpoints)
						? (em.selectedTouchpoints as string[])
						: [];
				if (tp.length < 4 || tp.length > 8) return p;
			}
			let max = 0;
			if (active === 'archetype') max = QUESTIONS.archetype.length;
			else if (active === 'values') max = QUESTIONS.values.length;
			else if (active === 'business') max = QUESTIONS.business.length;
			else if (active === 'service') max = QUESTIONS.service.length;
			else if (active === 'emotions') {
				const em = p.answers.emotions;
				const tp =
					em && typeof em === 'object' && Array.isArray(em.selectedTouchpoints)
						? (em.selectedTouchpoints as string[])
						: [];
				max = tp.length >= 4 ? 1 + tp.length * 2 : 1;
			}
			const nextStep = p.step + 1;
			if (nextStep >= max) {
				const done = new Set(p.completedModules);
				done.add(active);
				const allDone = DIAGNOSTIC_MODULE_ORDER.every((m) => done.has(m));
				return {
					...p,
					step: 0,
					activeModuleId: null,
					uiPhase: allDone ? 'complete' : 'hub',
					completedModules: Array.from(done),
				};
			}
			return { ...p, step: nextStep };
		});
	};

	const goPrev = (): void => {
		updateDraft((p) => ({
			...p,
			step: Math.max(0, p.step - 1),
		}));
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={onBack}
				>
					{t('diagnostic.back')}
				</DesktopAppButton>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="text-xl" aria-hidden>
						{MODULE_ICONS[moduleId]}
					</span>
					<span className="truncate text-sm font-semibold text-(--desktop-text-primary)">
						{MODULE_LABELS[moduleId]}
					</span>
				</div>
			</div>
			<div className="space-y-1">
				<div className="flex justify-between text-[0.65rem] text-(--desktop-text-secondary)">
					<span>
						{t('diagnostic.stepProgress', { current: step + 1, max: maxSteps })}
					</span>
					<span className="tabular-nums">{stepProgressPct}%</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-white/10">
					<div
						className="h-full rounded-full bg-[linear-gradient(90deg,#14b8a6,#6366f1)] transition-[width] duration-500"
						style={{ width: `${stepProgressPct}%` }}
					/>
				</div>
			</div>
			<div
				className={cn(
					'rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-[6px]',
					'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
				)}
			>
				{moduleId === 'archetype' ? (
					<ArchetypeStep
						step={step}
						answers={draft.answers.archetype ?? {}}
						setAnswer={(qid, v) =>
							updateDraft((p) => ({
								...p,
								answers: {
									...p.answers,
									archetype: { ...p.answers.archetype, [String(qid)]: v },
								},
							}))
						}
					/>
				) : null}
				{moduleId === 'values' ? (
					<ValuesStep
						step={step}
						answers={draft.answers.values ?? {}}
						updateDraft={updateDraft}
					/>
				) : null}
				{moduleId === 'business' ? (
					<BusinessStep
						step={step}
						answers={draft.answers.business ?? {}}
						setAnswer={(qid, v) =>
							updateDraft((p) => ({
								...p,
								answers: {
									...p.answers,
									business: { ...p.answers.business, [String(qid)]: v },
								},
							}))
						}
					/>
				) : null}
				{moduleId === 'service' ? (
					<ServiceStep
						step={step}
						answers={draft.answers.service ?? {}}
						updateDraft={updateDraft}
					/>
				) : null}
				{moduleId === 'emotions' ? (
					<EmotionsStep draft={draft} updateDraft={updateDraft} step={step} />
				) : null}
			</div>
			<div className="flex flex-wrap gap-2">
				{step > 0 ? (
					<DesktopAppButton type="button" variant="neutral" onClick={goPrev}>
						{t('diagnostic.prev')}
					</DesktopAppButton>
				) : null}
				<DesktopAppButton type="button" variant="accent" onClick={goNext}>
					{t('diagnostic.next')}
				</DesktopAppButton>
			</div>
		</div>
	);
}
