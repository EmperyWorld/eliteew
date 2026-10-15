/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium task composer for Kursorina: presets, goal formulation, keyboard shortcut hints.
 *
 * Invariants:
 * - Minimum goal length gate (>=3 chars).
 * - Keyboard launch on Ctrl+Enter / Meta+Enter.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/kursorinaUtils.ts
 * - documentation/product/desktop/KURSORINA.md
 */

import { useState, type ReactElement } from 'react';
import {
	ArrowRightIcon,
	BookOpenIcon,
	CommandLineIcon,
	DocumentChartBarIcon,
	GlobeAltIcon,
	SparklesIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	KURSORINA_CONTENT_PAD,
	KURSORINA_CONTENT_SHELL,
} from './kursorinaLayout';
import { PRESET_TEMPLATES } from './kursorinaUtils';
import type { InvestigationPreset } from './types';

interface KursorinaComposerProps {
	initialGoal?: string;
	busy: boolean;
	onSubmit: (goal: string) => Promise<void>;
}

export function KursorinaComposer({
	initialGoal = '',
	busy,
	onSubmit,
}: KursorinaComposerProps): ReactElement {
	const [goal, setGoal] = useState(initialGoal);

	const canSubmit = !busy && goal.trim().length >= 3;

	const handleApplyPreset = (preset: InvestigationPreset): void => {
		setGoal(preset.prompt);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			if (canSubmit) {
				void onSubmit(goal.trim());
			}
		}
	};

	return (
		<div
			className={cn(
				'flex h-full min-h-0 flex-1 flex-col overflow-y-auto',
				KURSORINA_CONTENT_PAD
			)}
		>
			<div className={cn(KURSORINA_CONTENT_SHELL, 'gap-7')}>
				{/* Hero Banner */}
				<div className="rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.08)_100%,var(--desktop-surface-soft))] p-6 sm:p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
					<div className="flex items-start gap-4 sm:gap-5">
						<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--desktop-accent-rgb))]/35 bg-[rgb(var(--desktop-accent-rgb))]/15 text-[rgb(var(--desktop-accent-rgb))]">
							<SparklesIcon className="size-6" />
						</div>
						<div className="min-w-0 space-y-2">
							<p className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)">
								Новое расследование
							</p>
							<h1 className="text-xl font-semibold tracking-tight text-(--desktop-text-primary) sm:text-2xl">
								Сформулируйте цель
							</h1>
							<p className="max-w-4xl text-sm leading-relaxed text-(--desktop-text-secondary)">
								Рынок, ПО, юнит-экономика, KBSEW или корпоративный аудит —
								Курсорина спланирует шаги, соберёт первоисточники и подготовит
								отчёт.
							</p>
						</div>
					</div>

					{/* Capabilities Row */}
					<div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-(--desktop-border-subtle)/70 pt-5 sm:grid-cols-3 lg:grid-cols-6">
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<GlobeAltIcon className="h-4 w-4 text-sky-400 shrink-0" />
							<span>Веб и первоисточники</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<BookOpenIcon className="h-4 w-4 text-emerald-400 shrink-0" />
							<span>Библиотека & KBSEW</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<CommandLineIcon className="h-4 w-4 text-amber-400 shrink-0" />
							<span>Python & Финмодели</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<TableCellsIcon className="h-4 w-4 text-purple-400 shrink-0" />
							<span>SWOT & Риск-матрицы</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<DocumentChartBarIcon className="h-4 w-4 text-indigo-400 shrink-0" />
							<span>Бенчмарк & Roadmap</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-(--desktop-text-secondary)">
							<SparklesIcon className="h-4 w-4 text-cyan-400 shrink-0" />
							<span>Стандарты & HTML</span>
						</div>
					</div>
				</div>

				{/* Quick Presets */}
				<div className="space-y-2.5">
					<span className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
						Готовые шаблоны
					</span>
					<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
						{PRESET_TEMPLATES.map((preset) => (
							<button
								key={preset.id}
								type="button"
								onClick={() => handleApplyPreset(preset)}
								className="group flex flex-col items-start gap-1.5 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3.5 text-left transition-colors hover:border-[rgb(var(--desktop-accent-rgb))]/40 hover:bg-(--desktop-surface-soft)"
							>
								<div className="flex w-full items-center justify-between">
									<span className="text-xs font-semibold text-(--desktop-text-primary) group-hover:text-[rgb(var(--desktop-accent-rgb))]">
										{preset.title}
									</span>
									<span className="rounded bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] text-(--desktop-text-muted)">
										{preset.badge}
									</span>
								</div>
								<p className="line-clamp-2 text-xs text-(--desktop-text-muted)">
									{preset.prompt}
								</p>
							</button>
						))}
					</div>
				</div>

				{/* Composer Form */}
				<div className="flex flex-col gap-3 rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 p-4 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
					<div className="flex items-center justify-between">
						<label
							htmlFor="kursorina-goal-input"
							className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)"
						>
							Формулировка цели
						</label>
						<span className="text-xs tabular-nums text-(--desktop-text-muted)">
							{goal.trim().length} символов
						</span>
					</div>

					<textarea
						id="kursorina-goal-input"
						rows={5}
						value={goal}
						onChange={(e) => setGoal(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={busy}
						placeholder="Что нужно выяснить? Опишите предметную область, список вопросов, требования к расчетам, таблицам или источникам..."
						className="w-full resize-y rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3.5 text-sm leading-relaxed text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors focus:border-[rgb(var(--desktop-accent-rgb))]/60 focus:ring-1 focus:ring-[rgb(var(--desktop-accent-rgb))]/30"
					/>

					<div className="flex flex-wrap items-center justify-between gap-3 pt-1">
						<div className="text-xs text-(--desktop-text-muted)">
							<kbd className="rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 py-0.5 font-mono text-[11px]">
								Ctrl
							</kbd>{' '}
							+{' '}
							<kbd className="rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 py-0.5 font-mono text-[11px]">
								Enter
							</kbd>{' '}
							для быстрого запуска
						</div>

						<DesktopAppButton
							type="button"
							variant="accent"
							disabled={!canSubmit}
							onClick={() => void onSubmit(goal.trim())}
							className="gap-2 px-5 py-2 font-medium shadow-sm"
						>
							{busy ? (
								<>
									<div className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-white/20 border-t-white" />
									<span>Запуск…</span>
								</>
							) : (
								<>
									<span>Запустить расследование</span>
									<ArrowRightIcon className="h-4 w-4" />
								</>
							)}
						</DesktopAppButton>
					</div>
				</div>
			</div>
		</div>
	);
}
