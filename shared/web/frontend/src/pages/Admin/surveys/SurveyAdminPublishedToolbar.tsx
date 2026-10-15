/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Published survey operator toolbar: deadline, GAF queue, and archive.
 *
 * Invariants:
 * - Only closes_at is mutable on published surveys (server-enforced).
 *
 * Related:
 * - SurveysAdminSection.tsx
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { formatSurveyDateLabel } from '@/features/surveys/desktop/surveyHubUserUtils';
import {
	surveyDatetimeLocalValueToIso,
	surveyIsoToDatetimeLocalValue,
} from './surveyAdminDateTimeUtils';

type Props = {
	closesAt: string | null;
	savePending: boolean;
	archivePending: boolean;
	gafUndeliveredPending: boolean;
	gafRemindPending: boolean;
	onSaveDeadline: (closesAtIso: string | null) => void;
	onGafUndelivered: () => void;
	onGafRemind: () => void;
	onArchive: () => void;
};

const INPUT_CLASS = cn(
	'w-full max-w-xs rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

export function SurveyAdminPublishedToolbar({
	closesAt,
	savePending,
	archivePending,
	gafUndeliveredPending,
	gafRemindPending,
	onSaveDeadline,
	onGafUndelivered,
	onGafRemind,
	onArchive,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const [localValue, setLocalValue] = React.useState(() =>
		surveyIsoToDatetimeLocalValue(closesAt)
	);

	React.useEffect(() => {
		setLocalValue(surveyIsoToDatetimeLocalValue(closesAt));
	}, [closesAt]);

	const currentLabel = formatSurveyDateLabel(closesAt);

	return (
		<DesktopAppPanel className="flex flex-col gap-4 p-4">
			<div>
				<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{t('admin.publishedToolbar.heading')}
				</h3>
				<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
					{t('admin.publishedToolbar.hint')}
				</p>
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<label className="block min-w-56 flex-1 space-y-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('admin.closesAt')}
					</span>
					<input
						type="datetime-local"
						className={INPUT_CLASS}
						value={localValue}
						onChange={(e) => setLocalValue(e.target.value)}
					/>
					<p className={DESKTOP_TYPOGRAPHY.caption}>
						{currentLabel
							? t('admin.publishedToolbar.currentDeadline', {
									date: currentLabel,
								})
							: t('admin.closesAtHint')}
					</p>
				</label>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={savePending}
					onClick={() =>
						onSaveDeadline(surveyDatetimeLocalValueToIso(localValue))
					}
				>
					{t('admin.publishedToolbar.saveDeadline')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					disabled={savePending}
					onClick={() => {
						setLocalValue('');
						onSaveDeadline(null);
					}}
				>
					{t('admin.publishedToolbar.clearDeadline')}
				</DesktopAppButton>
			</div>
			<div className="flex flex-col gap-2 border-t border-(--desktop-border-subtle) pt-3">
				<div>
					<h4 className={DESKTOP_TYPOGRAPHY.caption}>
						{t('admin.gafActions.heading')}
					</h4>
					<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
						{t('admin.gafActions.hint')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={gafUndeliveredPending}
						onClick={onGafUndelivered}
					>
						{t('admin.gafActions.undelivered')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={gafRemindPending}
						onClick={onGafRemind}
					>
						{t('admin.gafActions.remind')}
					</DesktopAppButton>
				</div>
			</div>
			<div className="flex flex-wrap gap-2 border-t border-(--desktop-border-subtle) pt-3">
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={archivePending}
					onClick={onArchive}
				>
					{t('admin.archive')}
				</DesktopAppButton>
			</div>
		</DesktopAppPanel>
	);
}
