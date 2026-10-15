/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal admin preview of the user survey runner journey (no submit persistence).
 *
 * Invariants:
 * - Uses SurveyRunner previewMode; closes without API writes.
 *
 * Related:
 * - surveyAdminUserPreview.ts
 * - features/surveys/desktop/SurveyRunner.tsx
 */
import { cn } from '@/utils/cn';
import { XMarkIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SurveyRunner } from '@/features/surveys/desktop/SurveyRunner';
import type { SurveyUserDetail } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

type Props = {
	open: boolean;
	survey: SurveyUserDetail | null;
	onClose: () => void;
};

export function SurveyAdminUserPreviewDialog({
	open,
	survey,
	onClose,
}: Props): React.ReactElement | null {
	const { t } = useTranslation('surveys');

	React.useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	if (!open || !survey) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="survey-admin-user-preview-title"
		>
			<div
				className={cn(
					'flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden',
					'rounded-t-(--desktop-radius-lg) border border-(--desktop-border-subtle) sm:rounded-(--desktop-radius-lg)',
					'bg-(--desktop-surface-panel) shadow-2xl'
				)}
			>
				<header className="flex items-start justify-between gap-3 border-b border-(--desktop-border-subtle) px-4 py-3">
					<div className="min-w-0 space-y-1">
						<p className={DESKTOP_TYPOGRAPHY.labelOverline}>
							{t('admin.userPreview.label')}
						</p>
						<h2
							id="survey-admin-user-preview-title"
							className="truncate font-medium text-(--desktop-text-primary)"
						>
							{survey.title}
						</h2>
						{survey.description_user ? (
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'max-w-2xl')}>
								{survey.description_user}
							</p>
						) : null}
					</div>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						aria-label={t('admin.userPreview.close')}
						onClick={onClose}
					>
						<XMarkIcon
							className="size-5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto">
					<SurveyRunner
						survey={survey}
						previewMode
						onCancel={onClose}
						onDone={onClose}
					/>
				</div>
			</div>
		</div>
	);
}
