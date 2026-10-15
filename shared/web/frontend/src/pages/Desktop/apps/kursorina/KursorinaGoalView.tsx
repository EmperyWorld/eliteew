/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Goal and parameters view for Kursorina: inspect original prompt, mission metadata, clone action.
 *
 * Invariants:
 * - Read-only inspection with safe copy actions.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/types.ts
 */

import { useState, type ReactElement } from 'react';
import {
	CheckIcon,
	ClipboardDocumentIcon,
	DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	KURSORINA_CONTENT_PAD,
	KURSORINA_CONTENT_SHELL,
} from './kursorinaLayout';
import { copyToClipboard, formatFullDate, statusLabel } from './kursorinaUtils';
import type { MissionPublicView } from './types';

interface KursorinaGoalViewProps {
	mission: MissionPublicView;
	onCloneGoal: (goal: string) => void;
}

export function KursorinaGoalView({
	mission,
	onCloneGoal,
}: KursorinaGoalViewProps): ReactElement {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (): Promise<void> => {
		const ok = await copyToClipboard(mission.goal);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div
			className={cn(
				'flex h-full min-h-0 flex-1 flex-col overflow-y-auto',
				KURSORINA_CONTENT_PAD
			)}
		>
			<div className={cn(KURSORINA_CONTENT_SHELL, 'gap-6')}>
				{/* Goal Prompt Card */}
				<div className="space-y-4 rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-(--desktop-text-muted)">
							Исходная постановка цели
						</span>

						<div className="flex items-center gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => void handleCopy()}
								className="gap-1.5 text-xs"
							>
								{copied ? (
									<>
										<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
										<span className="text-emerald-400">Скопировано</span>
									</>
								) : (
									<>
										<ClipboardDocumentIcon className="h-3.5 w-3.5" />
										<span>Копировать</span>
									</>
								)}
							</DesktopAppButton>

							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								onClick={() => onCloneGoal(mission.goal)}
								className="gap-1.5 text-xs"
							>
								<DocumentDuplicateIcon className="h-3.5 w-3.5" />
								<span>Редактировать в новой задаче</span>
							</DesktopAppButton>
						</div>
					</div>

					<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm text-(--desktop-text-primary) whitespace-pre-wrap leading-relaxed">
						{mission.goal}
					</div>
				</div>

				{/* Metadata Grid */}
				<div className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-5 shadow-sm space-y-4">
					<span className="text-xs font-semibold uppercase tracking-wider text-(--desktop-text-muted)">
						Технические параметры
					</span>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
						<div className="space-y-1">
							<div className="text-(--desktop-text-muted)">
								Идентификатор задачи
							</div>
							<div className="font-mono text-(--desktop-text-secondary) select-all">
								{mission.id}
							</div>
						</div>

						<div className="space-y-1">
							<div className="text-(--desktop-text-muted)">Текущий статус</div>
							<div className="font-medium text-(--desktop-text-primary)">
								{statusLabel(mission.status)}
							</div>
						</div>

						<div className="space-y-1">
							<div className="text-(--desktop-text-muted)">Время создания</div>
							<div className="text-(--desktop-text-secondary)">
								{formatFullDate(mission.created_at)}
							</div>
						</div>

						<div className="space-y-1">
							<div className="text-(--desktop-text-muted)">
								Последнее обновление
							</div>
							<div className="text-(--desktop-text-secondary)">
								{formatFullDate(mission.updated_at)}
							</div>
						</div>

						{mission.progress ? (
							<div className="space-y-1 sm:col-span-2">
								<div className="text-(--desktop-text-muted)">
									Статус прогресса
								</div>
								<div className="text-(--desktop-text-secondary)">
									{mission.progress}
								</div>
							</div>
						) : null}

						{mission.block_reason ? (
							<div className="space-y-1 sm:col-span-2">
								<div className="text-amber-400">Причина остановки</div>
								<div className="text-amber-200">{mission.block_reason}</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
