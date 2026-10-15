/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline Assistant plan widget: live goals/tasks from companion-plans, checkbox complete.
 *
 * Invariants:
 * - No widget-todos fallback. Disabled/empty/error are honest.
 * - Complete does not check the box until POST succeeds.
 *
 * Related:
 * - hooks/useDesktopAssistantPlanProjection.ts
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 */

import { companionPlanStatusLabelKey } from '@/features/ewa/companionPlanStripUi';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopAssistantPlanProjection } from '../../hooks/useDesktopAssistantPlanProjection';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export function AssistantPlanSlotBody({
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
	const { t: tPlan } = useTranslation('marketing');
	const limit = compact ? 3 : 6;

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
					{projection.error ? t('planLoadError') : t('planEmpty')}
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

	const shown = projection.openTasks.slice(0, limit);

	return (
		<div className="flex flex-col gap-2">
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-secondary)'
				)}
			>
				{projection.bundle?.plan?.title ?? t('planUntitled')}
				{' · '}
				{tPlan(companionPlanStatusLabelKey(projection.fsmStatus))}
				{' · '}
				{tPlan('ewaCompanion.planProgress', { percent: projection.progress })}
			</p>
			{projection.error ? (
				<p className={DESKTOP_TYPOGRAPHY.caption} role="alert">
					{projection.forbidden ? t('planForbidden') : t('planActionError')}
				</p>
			) : null}
			{shown.length === 0 ? (
				<p className={DESKTOP_TYPOGRAPHY.caption}>{t('planTasksEmpty')}</p>
			) : (
				<ul className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
					{shown.map((task) => (
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
									{task.title}
								</span>
							</label>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
