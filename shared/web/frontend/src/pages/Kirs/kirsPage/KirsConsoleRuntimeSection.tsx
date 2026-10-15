/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS console tab: runtime status, handoff, background jobs, lifecycle actions, health.
 *
 * Invariants:
 * - Guided tour anchors runtime-status, client-handoff, runtime-actions preserved.
 * - RuntimeDisabledActionsHintCard telemetry hook unchanged.
 *
 * Related:
 * - KirsDetailPanel.tsx
 * - ../kirsRuntimeGuards.ts
 */

import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { RuntimeDisabledActionsHintCard } from '@/pages/Desktop/components/RuntimeDisabledActionsHintCard';
import { GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
	formatKirsGroupedCountSr,
	formatKirsHiddenCountSr,
	formatKirsToggleAnnouncement,
} from './kirsPageConstants';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsConsoleRuntimeSection({ k }: Props) {
	if (!k.inst) return null;

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs uppercase tracking-wide text-(--desktop-text-muted)">
					Статус: {k.inst.status}
				</span>
				{k.inst.public_url ? (
					<a
						href={k.inst.public_url}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-sm text-sky-300 hover:underline"
						title="Открывает публичную страницу сайта, которую видят клиенты и посетители."
					>
						<GlobeAltIcon className="size-4" />
						Открыть публичную витрину
					</a>
				) : null}
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					disabled={!k.adminShellReady}
					onClick={() => k.setPanelTab('admin')}
					title="Открывает внутреннюю админку сайта в Desktop. Здесь меняют контент, заказы и настройки."
				>
					<ShieldCheckIcon className="size-4" aria-hidden />
					Открыть админку (Desktop)
				</DesktopAppButton>
			</div>
			<DesktopAppSurface
				data-kirs-curation-guide="runtime-status"
				variant="soft"
				padding="sm"
				className="space-y-2"
			>
				<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
					Операционный статус
				</div>
				<div className="flex flex-wrap gap-2 text-xs">
					<span className="rounded-md border border-(--desktop-border) px-2 py-1 text-(--desktop-text-secondary)">
						runtime: {k.runtimeUi.isRunning ? 'running' : k.inst.status}
					</span>
					<span className="rounded-md border border-(--desktop-border) px-2 py-1 text-(--desktop-text-secondary)">
						api: {k.runtimeUi.apiOk ? 'ok' : 'offline'}
					</span>
					<span className="rounded-md border border-(--desktop-border) px-2 py-1 text-(--desktop-text-secondary)">
						public: {k.runtimeUi.publicOk ? 'ok' : 'offline'}
					</span>
					<span className="rounded-md border border-(--desktop-border) px-2 py-1 text-(--desktop-text-secondary)">
						visibility: {k.runtimeUi.isPublished ? 'open' : 'closed'}
					</span>
				</div>
				<div className="text-xs leading-relaxed text-(--desktop-text-secondary)">
					{k.runtimeUi.nextStepHint}
				</div>
			</DesktopAppSurface>
			<DesktopAppSurface
				data-kirs-curation-guide="client-handoff"
				variant="soft"
				padding="sm"
				className="space-y-3"
			>
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						Клиентская готовность
					</div>
					<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
						Статус для handoff: подготовка, ревью, публикация, approval и
						заметки оператора перед выдачей доступа к админке.
					</p>
				</div>
				<div className="grid gap-2 md:grid-cols-2">
					<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
						<span>Готовность</span>
						<select
							value={k.readinessStatus}
							onChange={(event) => k.setReadinessStatus(event.target.value)}
							className="w-full rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-3 py-2 text-sm text-(--desktop-text-primary)"
						>
							<option value="preparing">preparing</option>
							<option value="ready_for_review">ready for review</option>
							<option value="published">published</option>
							<option value="paused">paused</option>
						</select>
					</label>
					<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
						<span>Approval</span>
						<select
							value={k.approvalStatus}
							onChange={(event) => k.setApprovalStatus(event.target.value)}
							className="w-full rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-3 py-2 text-sm text-(--desktop-text-primary)"
						>
							<option value="not_requested">not requested</option>
							<option value="requested">requested</option>
							<option value="approved">approved</option>
							<option value="changes_requested">changes requested</option>
						</select>
					</label>
				</div>
				<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
					<span>Заметки оператора</span>
					<textarea
						value={k.operatorNotes}
						onChange={(event) => k.setOperatorNotes(event.target.value)}
						rows={3}
						className="w-full rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-3 py-2 text-sm text-(--desktop-text-primary)"
						placeholder="Что осталось проверить перед передачей клиенту"
					/>
				</label>
				<div className="flex flex-wrap items-center gap-2">
					<DesktopAppButton
						type="button"
						size="sm"
						variant="accent"
						disabled={k.collaborationMut.isPending}
						onClick={() => k.collaborationMut.mutate()}
					>
						Сохранить handoff
					</DesktopAppButton>
					{k.collaborationQuery.data ? (
						<span className="text-xs text-(--desktop-text-muted)">
							Сейчас: {k.collaborationQuery.data.readiness_status} ·{' '}
							{k.collaborationQuery.data.approval_status}
						</span>
					) : null}
				</div>
			</DesktopAppSurface>
			<DesktopAppSurface variant="soft" padding="sm" className="space-y-2">
				<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
					Фоновые задачи
				</div>
				<div className="grid gap-2 text-xs text-(--desktop-text-secondary) md:grid-cols-3">
					<div>
						<div className="text-(--desktop-text-dim)">Исполнитель</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{k.healthQuery.data?.worker_ready
								? 'готов'
								: 'нет свежего сигнала'}
						</div>
						{k.healthQuery.data?.worker_last_seen_age_seconds != null ? (
							<div className="mt-1">
								последний сигнал{' '}
								{k.healthQuery.data.worker_last_seen_age_seconds} сек. назад
							</div>
						) : null}
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">Текущая задача</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{k.kirsPendingJobSummary || 'нет активной задачи'}
						</div>
						{k.healthQuery.data?.pending_job?.id ? (
							<div className="mt-1 break-all">
								job: {k.healthQuery.data.pending_job.id}
							</div>
						) : null}
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">Последняя задача</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{k.kirsLastJobSummary || 'задач ещё не было'}
						</div>
						{k.healthQuery.data?.last_job?.last_error ? (
							<div className="mt-1 text-red-200">
								{k.healthQuery.data.last_job.last_error}
							</div>
						) : null}
					</div>
				</div>
			</DesktopAppSurface>
			<div
				data-kirs-curation-guide="runtime-actions"
				className="flex flex-wrap gap-2"
			>
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={!k.runtimeUi.canProvision}
					onClick={() => k.provisionMut.mutate()}
					title={k.runtimeUi.provisionTitle}
				>
					Подготовить сайт
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 active:bg-emerald-500/30"
					size="sm"
					disabled={!k.runtimeUi.canStart}
					onClick={() => k.startMut.mutate()}
					title={k.runtimeUi.startTitle}
				>
					Запустить сайт
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="danger"
					size="sm"
					disabled={!k.runtimeUi.canStop}
					onClick={() => k.stopMut.mutate()}
					title={k.runtimeUi.stopTitle}
				>
					Поставить на паузу
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					className="border-amber-400/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 active:bg-amber-500/30"
					size="sm"
					disabled={!k.runtimeUi.canRedeploy}
					onClick={() => k.redeployMut.mutate()}
					title={k.runtimeUi.redeployTitle}
				>
					Обновить сайт
				</DesktopAppButton>
			</div>
			<RuntimeDisabledActionsHintCard
				title="Почему часть действий недоступна"
				hints={k.runtimeUi.disabledActionHints}
				announceChanges
				showRawToggle
				groupedCountLabel="Причин"
				hiddenCountLabel="Скрыто"
				detailsCountLabel="Строк"
				groupedCountSrFormatter={formatKirsGroupedCountSr}
				hiddenCountSrFormatter={formatKirsHiddenCountSr}
				summaryScrollHintLabel="Прокрутите, чтобы увидеть все причины"
				detailsScrollHintLabel="Прокрутите, чтобы увидеть все строки"
				overflowTopHintLabel="Выше есть строки"
				overflowBottomHintLabel="Ниже есть строки"
				overflowFadeStrength="strong"
				rowDensity="compact"
				scrollThreshold={5}
				rawListTitle="Подробно по действиям"
				toggleShowRawLabel="Показать подробный список"
				toggleHideRawLabel="Скрыть подробный список"
				toggleExpandedSrLabel={formatKirsToggleAnnouncement(
					true,
					k.runtimeUi.disabledActionHints.length
				)}
				toggleCollapsedSrLabel={formatKirsToggleAnnouncement(
					false,
					k.runtimeUi.disabledActionHints.length
				)}
				toggleStateStorageKey="kirs.runtimeDisabledReasons.showDetailed"
				onToggleRawHints={k.handleRuntimeHintsToggle}
			/>
			{k.healthQuery.data ? (
				<div className="rounded-md border border-(--desktop-border) p-2 text-xs text-(--desktop-text-muted)">
					<div>
						API:{' '}
						{k.healthQuery.data.api_ok ? 'ok' : k.healthQuery.data.api_error}
					</div>
					<div>
						Public:{' '}
						{k.healthQuery.data.public_ok
							? 'ok'
							: k.healthQuery.data.public_error}
					</div>
				</div>
			) : null}
		</>
	);
}
