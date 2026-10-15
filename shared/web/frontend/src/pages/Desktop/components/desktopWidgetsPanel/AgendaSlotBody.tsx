/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Agenda widget: open Assistant plan tasks grouped by due date (no calendar grid).
 *
 * Invariants:
 * - Same projection as the plan slot; no widget-todos; no third-party calendar.
 *
 * Related:
 * - utils/desktopWidgetSurfacePolicy.ts
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopAssistantPlanProjection } from '../../hooks/useDesktopAssistantPlanProjection';
import type { DesktopWidgetAgendaBucketId } from '../../utils/desktopWidgetSurfacePolicy';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export function AgendaSlotBody({
	compact,
	projection,
	onOpenAssistant,
}: {
	compact: boolean;
	projection: DesktopAssistantPlanProjection;
	onOpenAssistant: () => void;
}) {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'settingsPanel.widgetsPanel',
	});
	const limit = compact ? 4 : 8;

	if (projection.visibility === 'hide-disabled') {
		return <p className={DESKTOP_TYPOGRAPHY.caption}>{t('planDisabled')}</p>;
	}

	if (projection.loading && !projection.bundle?.plan) {
		return <p className={DESKTOP_TYPOGRAPHY.caption}>{t('loading')}</p>;
	}

	if (projection.visibility === 'empty-cta') {
		return (
			<div className="flex flex-col gap-2">
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{projection.error ? t('planLoadError') : t('agendaEmpty')}
				</p>
				<DesktopChromeTooltip
					content={t('openAssistant')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton type="button" size="sm" onClick={onOpenAssistant}>
						{t('openAssistant')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</div>
		);
	}

	const buckets = projection.agendaBuckets.filter(
		(bucket) => bucket.tasks.length > 0
	);
	let remaining = limit;
	const visible: Array<{
		bucketId: DesktopWidgetAgendaBucketId;
		id: string;
		title: string;
	}> = [];
	for (const bucket of buckets) {
		for (const task of bucket.tasks) {
			if (remaining <= 0) break;
			visible.push({
				bucketId: bucket.id,
				id: task.id,
				title: task.title,
			});
			remaining -= 1;
		}
		if (remaining <= 0) break;
	}

	if (visible.length === 0) {
		return (
			<p className={DESKTOP_TYPOGRAPHY.caption}>{t('agendaNoDatedTasks')}</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{projection.error ? (
				<p className={DESKTOP_TYPOGRAPHY.caption} role="alert">
					{projection.forbidden ? t('planForbidden') : t('planActionError')}
				</p>
			) : null}
			<ul className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
				{visible.map((task) => (
					<li key={task.id}>
						<label
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'flex cursor-pointer items-start gap-2 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1 text-(--desktop-text-secondary)'
							)}
						>
							<input
								type="checkbox"
								className={cn(
									'mt-0.5 size-3.5 shrink-0 rounded border-(--desktop-border-strong)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								checked={false}
								disabled={projection.completingTaskId === task.id}
								onChange={() => {
									void projection.completeTask(task.id);
								}}
								aria-label={t('completeTaskAria', { title: task.title })}
							/>
							<span className="min-w-0 flex-1 wrap-break-word">
								<span className="mr-1 text-(--desktop-text-dim)">
									{t(`agendaBucket.${task.bucketId}`)}
								</span>
								{task.title}
							</span>
						</label>
					</li>
				))}
			</ul>
		</div>
	);
}
